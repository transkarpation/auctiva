import {
  WebSocketProvider,
  Contract,
  formatEther,
  type ContractEventPayload,
} from "ethers";
import { env } from "../env.js";
import { SimpleAuctionArtifact } from "../SimpleAuction.js";
import { AuctionModel } from "../models/Auction.js";
import { BidModel } from "../models/Bid.js";
import { readAuctionState } from "./auctionContract.js";
import { logger } from "./logger.js";
import {
  notifyAuctionParticipants,
  notifyAuctionEnded,
  notifyAuctionEndable,
} from "./notifications.js";

const { abi } = SimpleAuctionArtifact;
const log = logger.child({ component: "auction-watcher" });

// How often to (a) reconcile subscriptions against newly-deployed auctions and
// (b) health-check the websocket, reconnecting if it has gone dead.
const REFRESH_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 5_000;

type AuctionMeta = {
  id: string;
  userId: string;
  title: string;
  contractAddress: string;
};

let provider: WebSocketProvider | null = null;
let timer: NodeJS.Timeout | null = null;
let stopped = false;
// contractAddress (lowercased) -> Contract we have listeners attached to.
const watched = new Map<string, Contract>();

// Starts the chain-event watcher: subscribes to every deployed auction's
// contract and turns HighestBidIncreased / AuctionEnded events into stored +
// pushed notifications for the owner and participants.
export function startAuctionWatcher(): void {
  stopped = false;
  connect();
}

export async function stopAuctionWatcher(): Promise<void> {
  stopped = true;
  if (timer) clearInterval(timer);
  timer = null;
  await teardownProvider();
}

function connect(): void {
  provider = new WebSocketProvider(env.bcWss);
  provider.on("error", (err) => log.error({ err }, "Provider error"));
  log.info("Connecting to chain websocket");

  void syncSubscriptions();
  timer = setInterval(() => void tick(), REFRESH_INTERVAL_MS);
}

// Periodic: confirm the socket is alive and pick up newly-deployed auctions.
async function tick(): Promise<void> {
  if (!provider || stopped) return;
  try {
    await withTimeout(provider.getBlockNumber(), 10_000);
  } catch {
    log.warn("Websocket appears dead — reconnecting");
    await reconnect();
    return;
  }
  await syncSubscriptions();
  await scanEndableAuctions();
}

async function reconnect(): Promise<void> {
  await teardownProvider();
  if (stopped) return;
  setTimeout(() => {
    if (!stopped) connect();
  }, RECONNECT_DELAY_MS);
}

async function teardownProvider(): Promise<void> {
  for (const contract of watched.values()) {
    try {
      await contract.removeAllListeners();
    } catch {
      // ignore — provider is going away anyway
    }
  }
  watched.clear();
  if (provider) {
    try {
      await provider.destroy();
    } catch {
      // ignore
    }
    provider = null;
  }
}

// Attach listeners for any deployed auction we aren't already watching.
async function syncSubscriptions(): Promise<void> {
  if (!provider) return;

  let auctions;
  try {
    auctions = await AuctionModel.find({
      deploymentStatus: "deployed",
      contractAddress: { $type: "string" },
    })
      .select("contractAddress userId title")
      .lean();
  } catch (err) {
    log.error({ err }, "Failed to load auctions for subscription");
    return;
  }

  for (const a of auctions) {
    if (!a.contractAddress) continue;
    const key = a.contractAddress.toLowerCase();
    if (watched.has(key)) continue;

    const meta: AuctionMeta = {
      id: String(a._id),
      userId: a.userId,
      title: a.title,
      contractAddress: a.contractAddress,
    };
    const contract = new Contract(a.contractAddress, [...abi], provider);

    await contract.on(
      "HighestBidIncreased",
      (bidder: string, amount: bigint, payload: ContractEventPayload) =>
        void handleHighestBid(meta, bidder, amount, payload)
    );
    await contract.on(
      "AuctionEnded",
      (winner: string, amount: bigint, payload: ContractEventPayload) =>
        void handleAuctionEnded(meta, winner, amount, payload)
    );

    watched.set(key, contract);
    log.info({ contract: key, auctionId: meta.id }, "Watching auction contract");
  }
}

// Time-based: the contract emits no event when the bidding window simply
// expires, so we poll. For each deployed auction we haven't handled yet, once
// its window has closed we notify the owner it can be finalized (unless it was
// already settled on-chain) and mark it so we never notify twice.
async function scanEndableAuctions(): Promise<void> {
  let candidates;
  try {
    candidates = await AuctionModel.find({
      deploymentStatus: "deployed",
      contractAddress: { $type: "string" },
      endNotifiedAt: { $exists: false },
    })
      .select("contractAddress userId title")
      .lean();
  } catch (err) {
    log.error({ err }, "Failed to load auctions for endable scan");
    return;
  }

  for (const a of candidates) {
    if (!a.contractAddress) continue;
    try {
      const state = await readAuctionState(a.contractAddress);
      if (Date.now() < state.endTime * 1000) continue; // still running

      // Claim it atomically so we notify exactly once even across restarts.
      const claim = await AuctionModel.updateOne(
        { _id: a._id, endNotifiedAt: { $exists: false } },
        { $set: { endNotifiedAt: new Date() } }
      );
      // If already settled on-chain, the AuctionEnded event handler covers it —
      // here we only prompt the owner when finalization is still pending.
      if (claim.modifiedCount === 1 && !state.ended) {
        await notifyAuctionEndable({
          id: String(a._id),
          userId: a.userId,
          title: a.title,
        });
        log.info({ auctionId: String(a._id) }, "Notified owner auction is finalizable");
      }
    } catch (err) {
      log.error({ err, auctionId: String(a._id) }, "Failed endable check");
    }
  }
}

async function handleHighestBid(
  meta: AuctionMeta,
  bidder: string,
  amount: bigint,
  payload: ContractEventPayload
): Promise<void> {
  try {
    const transactionHash = payload.log.transactionHash.toLowerCase();

    // Map the bidder wallet to a Clerk user (if they ever confirmed a bid here)
    // so we don't notify them about their own bid.
    const self = await BidModel.findOne({
      auctionId: meta.id,
      bidder: bidder.toLowerCase(),
    })
      .select("userId")
      .lean();

    await notifyAuctionParticipants({
      auctionId: meta.id,
      ownerId: meta.userId,
      excludeUserId: self?.userId,
      type: "bid.placed",
      message: `New bid of ${formatEther(amount)} ETH on "${meta.title}"`,
      data: {
        bidder: bidder.toLowerCase(),
        amount: amount.toString(),
        transactionHash,
      },
      transactionHash,
    });
  } catch (err) {
    log.error({ err, auctionId: meta.id }, "Failed to handle HighestBidIncreased");
  }
}

async function handleAuctionEnded(
  meta: AuctionMeta,
  winner: string,
  amount: bigint,
  payload: ContractEventPayload
): Promise<void> {
  try {
    await notifyAuctionEnded({
      auction: { id: meta.id, userId: meta.userId, title: meta.title },
      winner: String(winner).toLowerCase(),
      amountWei: amount.toString(),
      transactionHash: payload.log.transactionHash.toLowerCase(),
    });
  } catch (err) {
    log.error({ err, auctionId: meta.id }, "Failed to handle AuctionEnded");
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}
