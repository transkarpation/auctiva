import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { AuctionModel } from "../models/Auction.js";
import { resolveOwnerNames } from "../lib/owners.js";
import { parse } from "../lib/validate.js";
import { chainEnabled, deploySimpleAuction } from "../lib/auctionContract.js";
import { queueEnabled, enqueueDeploy } from "../queue/deployQueue.js";

const DEFAULT_BIDDING_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MIN_BIDDING_SECONDS = 60;

export const auctionsRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// requireUser (mounted in app.ts) guarantees userId is present here.
const userIdOf = (req: Request): string => getAuth(req).userId!;

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
});

// Public feed: every authenticated user can browse public auctions, but only
// those whose on-chain contract is actually deployed (pending/failed/off-chain
// auctions are hidden from the feed).
// Declared before "/:id" routes (none are GET, but keep it explicit).
auctionsRouter.get(
  "/public",
  asyncHandler(async (_req, res) => {
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

    res.json(
      auctions.map((a) => ({
        ...a,
        ownerId: a.userId,
        ownerName: names.get(a.userId) ?? "Unknown user",
      }))
    );
  })
);

// List the current user's auctions (newest first).
auctionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const auctions = await AuctionModel.find({ userId: userIdOf(req) }).sort({
      createdAt: -1,
    });
    res.json(auctions);
  })
);

// Create an auction.
auctionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parse(createAuctionSchema, req.body, res);
    if (!data) return;
    const userId = userIdOf(req);

    // Off-chain: no deployment.
    if (!chainEnabled()) {
      const auction = await AuctionModel.create({
        userId,
        ...data,
        deploymentStatus: "none",
      });
      res.status(201).json(auction);
      return;
    }

    const biddingTimeSeconds = data.endsAt
      ? Math.max(
          MIN_BIDDING_SECONDS,
          Math.floor((data.endsAt.getTime() - Date.now()) / 1000)
        )
      : DEFAULT_BIDDING_SECONDS;

    // Preferred path: create as "pending" and deploy asynchronously via BullMQ.
    if (queueEnabled()) {
      const auction = await AuctionModel.create({
        userId,
        ...data,
        chain: "base-sepolia",
        deploymentStatus: "pending",
      });
      await enqueueDeploy({
        auctionId: auction.id,
        startingPriceWei: data.startingPrice,
        biddingTimeSeconds,
        beneficiary: data.walletAddress,
        minBidIncrementWei: data.minBidIncrement,
      });
      res.status(201).json(auction);
      return;
    }

    // Fallback (no Redis): deploy synchronously within the request.
    try {
      const result = await deploySimpleAuction({
        startingPriceWei: data.startingPrice,
        biddingTimeSeconds,
        beneficiary: data.walletAddress,
        minBidIncrementWei: data.minBidIncrement,
      });
      const auction = await AuctionModel.create({
        userId,
        ...data,
        ...result,
        chain: "base-sepolia",
        deploymentStatus: "deployed",
      });
      res.status(201).json(auction);
    } catch (err) {
      console.error("Auction contract deployment failed:", err);
      res.status(502).json({ error: "Failed to deploy auction contract" });
    }
  })
);

// Delete one of the user's auctions.
auctionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await AuctionModel.findOneAndDelete({
      _id: req.params.id,
      userId: userIdOf(req),
    });
    if (!result) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  })
);
