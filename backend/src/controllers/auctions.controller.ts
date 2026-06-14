import { type Request, type Response } from "express";
import { z } from "zod";
import { AuctionModel } from "../models/Auction.js";
import { BidModel } from "../models/Bid.js";
import { FileModel } from "../models/File.js";
import { notifyNewBid } from "../lib/notifications.js";
import { resolveOwnerNames } from "../lib/owners.js";
import { parse, objectId } from "../lib/validate.js";
import { env } from "../env.js";
import { userIdOf } from "../lib/http.js";
import {
  deploySimpleAuction,
  getAuctionOnChainState,
  readAuctionState,
  confirmBidTransaction,
} from "../lib/auctionContract.js";
import { queueEnabled, enqueueDeploy } from "../queue/deployQueue.js";

const DEFAULT_BIDDING_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MIN_BIDDING_SECONDS = 60;

const createAuctionSchema = z.object({
  title: z.string({ error: "title is required" }).trim().min(1, "title is required").max(200),
  description: z.string().trim().max(2000).optional().default(""),
  // Wei amounts as non-negative integer strings (1 ETH = 1e18 wei). Strings
  // because wei routinely exceeds JS's safe integer range.
  startingPrice: z
    .string({ error: "startingPrice is required" })
    .trim()
    .regex(/^\d+$/, "startingPrice must be a wei amount (non-negative integer string)"),
  minBidIncrement: z
    .string({ error: "minBidIncrement is required" })
    .trim()
    .regex(/^\d+$/, "minBidIncrement must be a wei amount (non-negative integer string)"),
  isPublic: z.boolean().optional().default(false),
  endsAt: z.coerce.date().optional(),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "A valid wallet address is required")
    .transform((s) => s.toLowerCase()),
  // Ids of the user's already-uploaded files (POST /files) to attach as images.
  imageFileIds: z.array(objectId).max(8).optional(),
});

// Editing a draft: every field optional, same validation rules, but NO defaults
// — an omitted field must leave the stored value untouched (not reset it).
const updateAuctionSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  startingPrice: z
    .string()
    .trim()
    .regex(/^\d+$/, "startingPrice must be a wei amount (non-negative integer string)")
    .optional(),
  minBidIncrement: z
    .string()
    .trim()
    .regex(/^\d+$/, "minBidIncrement must be a wei amount (non-negative integer string)")
    .optional(),
  isPublic: z.boolean().optional(),
  endsAt: z.coerce.date().optional(),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "A valid wallet address is required")
    .transform((s) => s.toLowerCase())
    .optional(),
  imageFileIds: z.array(objectId).max(8).optional(),
});

// Public feed: every authenticated user can browse public auctions, but only
// those whose on-chain contract is actually deployed (pending/failed/off-chain
// auctions are hidden from the feed).
export async function listPublicAuctions(_req: Request, res: Response): Promise<void> {
  const auctions = await AuctionModel.find({
    isPublic: true,
    deploymentStatus: "deployed",
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const names = await resolveOwnerNames([
    ...new Set(auctions.map((a) => a.userId)),
  ]);

  // Read each auction's live on-chain state in parallel (ethers batches these
  // through the shared provider). One contract failing to read shouldn't break
  // the whole feed, so a failed read just yields a null state for that auction.
  const states = await Promise.all(
    auctions.map((a) =>
      a.contractAddress
        ? readAuctionState(a.contractAddress).catch(() => null)
        : Promise.resolve(null)
    )
  );

  res.json(
    auctions.map((a, i) => ({
      ...a,
      ownerId: a.userId,
      ownerName: names.get(a.userId) ?? "Unknown user",
      state: states[i],
    }))
  );
}

// List the current user's auctions (newest first).
export async function listAuctions(req: Request, res: Response): Promise<void> {
  const auctions = await AuctionModel.find({ userId: userIdOf(req) }).sort({
    createdAt: -1,
  });
  res.json(auctions);
}

// Create an auction.
// Resolves attached file ids (only the user's own) into image snapshots, in the
// order the client sent them. Each snapshot freezes the file's signed URL.
async function resolveImages(
  userId: string,
  imageFileIds: string[] | undefined
): Promise<{ fileId: string; url: string }[]> {
  if (!imageFileIds?.length) return [];
  const files = await FileModel.find({ _id: { $in: imageFileIds }, userId });
  const byId = new Map(files.map((f) => [f.id as string, f]));
  return imageFileIds.flatMap((id) => {
    const f = byId.get(id);
    return f ? [{ fileId: f.id, url: f.signedUrl }] : [];
  });
}

// Create an auction as a DRAFT — owner-only, editable, and not yet on chain.
// Publishing it later (POST /:id/publish) is what triggers deployment.
export async function createAuction(req: Request, res: Response): Promise<void> {
  const data = parse(createAuctionSchema, req.body, res);
  if (!data) return;
  const userId = userIdOf(req);
  const { imageFileIds, ...auctionData } = data;

  const auction = await AuctionModel.create({
    userId,
    ...auctionData,
    images: await resolveImages(userId, imageFileIds),
    status: "draft",
    deploymentStatus: "none",
  });
  res.status(201).json(auction);
}

// Edit a draft auction. Only the owner, and only while still a draft (a
// published auction is on chain and immutable here). Any provided field is
// updated; omitted fields are left as-is.
export async function updateAuction(req: Request, res: Response): Promise<void> {
  if (!objectId.safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const data = parse(updateAuctionSchema, req.body, res);
  if (!data) return;
  const userId = userIdOf(req);

  const auction = await AuctionModel.findOne({ _id: req.params.id, userId });
  if (!auction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (auction.status !== "draft") {
    res.status(409).json({ error: "Only draft auctions can be edited" });
    return;
  }

  const { imageFileIds, ...fields } = data;
  Object.assign(auction, fields);
  if (imageFileIds !== undefined) {
    auction.set("images", await resolveImages(userId, imageFileIds));
  }
  await auction.save();
  res.json(auction);
}

// Publish a draft: flip it to "published" and enqueue the on-chain deploy. Only
// the owner, and only from the draft state.
export async function publishAuction(req: Request, res: Response): Promise<void> {
  if (!objectId.safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = userIdOf(req);

  const auction = await AuctionModel.findOne({ _id: req.params.id, userId });
  if (!auction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (auction.status !== "draft") {
    res.status(409).json({ error: "Auction is already published" });
    return;
  }

  const biddingTimeSeconds = auction.endsAt
    ? Math.max(
      MIN_BIDDING_SECONDS,
      Math.floor((auction.endsAt.getTime() - Date.now()) / 1000)
    )
    : DEFAULT_BIDDING_SECONDS;

  auction.status = "published";
  auction.deploymentStatus = "pending";
  auction.chain = env.bcName;
  await auction.save();

  await enqueueDeploy({
    auctionId: auction.id,
    startingPriceWei: auction.startingPrice,
    biddingTimeSeconds,
    beneficiary: auction.walletAddress,
    minBidIncrementWei: auction.minBidIncrement,
  });
  res.json(auction);
}

// Delete one of the user's auctions. A deployed auction can only be removed once
// its on-chain auction has ended AND received no bids — deleting one with bids
// would hide a contract still holding bidders' funds, and deleting a live one
// removes it mid-auction. A "failed" auction never made it on-chain (no bids, no
// contract) so it's always safe to delete; a "pending" one may still be
// mid-deploy and is blocked until it resolves.
export async function deleteAuction(req: Request, res: Response): Promise<void> {
  const auction = await AuctionModel.findOne({
    _id: req.params.id,
    userId: userIdOf(req),
  });
  if (!auction) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Drafts never made it on chain, so they're always safe to delete.
  if (auction.status === "draft") {
    await auction.deleteOne();
    res.status(204).end();
    return;
  }

  if (auction.deploymentStatus === "pending") {
    res
      .status(409)
      .json({ error: "Auction is still being deployed and cannot be deleted yet" });
    return;
  }

  if (auction.deploymentStatus === "deployed") {
    if (!auction.contractAddress) {
      res.status(409).json({ error: "Auction has no on-chain contract to verify" });
      return;
    }

    let state;
    try {
      state = await getAuctionOnChainState(auction.contractAddress);
    } catch (err) {
      console.error("Failed to read auction on-chain state:", err);
      res.status(502).json({ error: "Could not verify auction state on-chain" });
      return;
    }

    if (!state.ended) {
      res
        .status(409)
        .json({ error: "Auction is still running and cannot be deleted before it ends" });
      return;
    }
    if (state.hasBids) {
      res
        .status(409)
        .json({ error: "Auctions that received bids cannot be deleted" });
      return;
    }
  }

  await auction.deleteOne();
  res.status(204).end();
}

// Live on-chain state of a deployed auction (highest bid, minimum next bid,
// end time, etc.), read server-side so the client doesn't need its own RPC.
export async function getAuctionState(req: Request, res: Response): Promise<void> {
  const auction = await AuctionModel.findById(req.params.id);
  if (!auction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (auction.deploymentStatus !== "deployed" || !auction.contractAddress) {
    res.status(409).json({ error: "Auction is not deployed on-chain" });
    return;
  }

  try {
    const state = await readAuctionState(auction.contractAddress);
    res.json(state);
  } catch (err) {
    console.error("Failed to read auction state on-chain:", err);
    res.status(502).json({ error: "Could not read auction state on-chain" });
  }
}

// True when the requester may view this auction: its owner, or anyone if it's
// public. Shared by the single-auction and bid-history endpoints.
function canView(auction: { userId: string; isPublic: boolean }, userId: string): boolean {
  return auction.userId === userId || auction.isPublic;
}

// Single auction detail. Visible to the owner, or to anyone when public.
// Returns the auction plus owner name and live on-chain state (if deployed),
// mirroring the shape of the public feed entries.
export async function getAuction(req: Request, res: Response): Promise<void> {
  if (!objectId.safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const auction = await AuctionModel.findById(req.params.id).lean();
  if (!auction || !canView(auction, userIdOf(req))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const names = await resolveOwnerNames([auction.userId]);
  const state =
    auction.deploymentStatus === "deployed" && auction.contractAddress
      ? await readAuctionState(auction.contractAddress).catch(() => null)
      : null;

  res.json({
    ...auction,
    ownerId: auction.userId,
    ownerName: names.get(auction.userId) ?? "Unknown user",
    state,
  });
}

// Bid history for one auction (most recent first). Same visibility rules as the
// auction itself.
export async function listAuctionBids(req: Request, res: Response): Promise<void> {
  if (!objectId.safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const auction = await AuctionModel.findById(req.params.id).lean();
  if (!auction || !canView(auction, userIdOf(req))) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const bids = await BidModel.find({ auctionId: auction._id })
    .sort({ blockNumber: -1, createdAt: -1 })
    .limit(200)
    .lean();
  res.json(bids);
}

const confirmBidSchema = z.object({
  transactionHash: z
    .string({ error: "transactionHash is required" })
    .regex(/^0x[a-fA-F0-9]{64}$/, "transactionHash must be a 0x-prefixed 32-byte hash"),
});

// Confirms a bid that the user placed on-chain directly from their wallet. The
// client submits the bid transaction, then posts its hash here. The backend
// verifies on-chain that the transaction succeeded, was sent to this auction's
// contract, and actually placed a bid (via the HighestBidIncreased event), then
// records it. Idempotent: re-confirming the same transaction returns the stored
// bid rather than creating a duplicate.
export async function confirmBid(req: Request, res: Response): Promise<void> {
  const data = parse(confirmBidSchema, req.body, res);
  if (!data) return;
  const transactionHash = data.transactionHash.toLowerCase();

  const auction = await AuctionModel.findById(req.params.id);
  if (!auction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (auction.userId === userIdOf(req)) {
    res.status(403).json({ error: "You cannot bid on your own auction" });
    return;
  }
  if (auction.deploymentStatus !== "deployed" || !auction.contractAddress) {
    res.status(409).json({ error: "Auction is not deployed on-chain" });
    return;
  }

  // Already recorded — return it without re-reading the chain.
  const existing = await BidModel.findOne({ transactionHash });
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  let result;
  try {
    result = await confirmBidTransaction(transactionHash, auction.contractAddress);
  } catch (err) {
    console.error("Failed to verify bid transaction on-chain:", err);
    res.status(502).json({ error: "Could not verify transaction on-chain" });
    return;
  }

  switch (result.status) {
    case "not_found":
      res.status(404).json({ error: "Transaction not found or not yet mined" });
      return;
    case "reverted":
      res.status(400).json({ error: "Transaction reverted on-chain" });
      return;
    case "wrong_contract":
      res
        .status(400)
        .json({ error: "Transaction was not sent to this auction's contract" });
      return;
    case "no_bid_event":
      res
        .status(400)
        .json({ error: "Transaction did not place a bid on this auction" });
      return;
  }

  try {
    const bid = await BidModel.create({
      auctionId: auction.id,
      userId: userIdOf(req),
      contractAddress: auction.contractAddress,
      bidder: result.bidder.toLowerCase(),
      amount: result.amountWei,
      transactionHash,
      blockNumber: result.blockNumber,
    });

    // Notify the owner and other participants (best-effort — never fail the bid
    // over a notification problem).
    await notifyNewBid({
      auction: { id: auction.id, userId: auction.userId, title: auction.title },
      bid: {
        userId: bid.userId,
        bidder: bid.bidder,
        amount: bid.amount,
        transactionHash: bid.transactionHash,
      },
    }).catch((err) => console.error("Failed to create bid notifications:", err));

    res.status(201).json(bid);
  } catch (err) {
    // Unique-index race: a concurrent request recorded the same tx first.
    if ((err as { code?: number }).code === 11000) {
      const bid = await BidModel.findOne({ transactionHash });
      res.status(200).json(bid);
      return;
    }
    throw err;
  }
}
