import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";
import { AuctionModel } from "../models/Auction.js";
import { deploySimpleAuction } from "../lib/auctionContract.js";
import { publishAuctionUpdate } from "../lib/auctionEvents.js";

export type DeployJobData = {
  auctionId: string;
  startingPriceWei: string;
  biddingTimeSeconds: number;
  beneficiary: string;
  minBidIncrementWei: string;
};

const QUEUE_NAME = "auction-deploy";

// The queue is only used when Redis is configured; otherwise the caller falls
// back to a synchronous deploy.
export function queueEnabled(): boolean {
  return Boolean(env.redisUrl);
}

// BullMQ requires maxRetriesPerRequest: null on its connections. (Cast because
// bullmq bundles its own ioredis copy — same library at runtime.)
function newConnection(): ConnectionOptions {
  return new Redis(env.redisUrl!, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;
}

let queue: Queue<DeployJobData> | null = null;

function getQueue(): Queue<DeployJobData> {
  if (!queue) {
    queue = new Queue<DeployJobData>(QUEUE_NAME, { connection: newConnection() });
  }
  return queue;
}

export async function enqueueDeploy(data: DeployJobData): Promise<void> {
  await getQueue().add("deploy", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

// Starts the worker that performs deployments. Call once at server start.
export function startDeployWorker(): Worker<DeployJobData> | null {
  if (!queueEnabled()) return null;

  const worker = new Worker<DeployJobData>(
    QUEUE_NAME,
    async (job: Job<DeployJobData>) => {
      const result = await deploySimpleAuction({
        startingPriceWei: job.data.startingPriceWei,
        biddingTimeSeconds: job.data.biddingTimeSeconds,
        beneficiary: job.data.beneficiary,
        minBidIncrementWei: job.data.minBidIncrementWei,
      });
      const auction = await AuctionModel.findByIdAndUpdate(
        job.data.auctionId,
        {
          contractAddress: result.contractAddress,
          deploymentTxHash: result.deploymentTxHash,
          chain: "base-sepolia",
          deploymentStatus: "deployed",
        },
        { new: true }
      );

      // Notify the owner in realtime. Best-effort — a failed publish must not
      // fail the (already successful) deploy job and trigger a re-deploy.
      if (auction) {
        await publishAuctionUpdate({
          userId: auction.userId,
          auctionId: auction.id,
          deploymentStatus: "deployed",
          title: auction.title,
          contractAddress: auction.contractAddress,
          deploymentTxHash: auction.deploymentTxHash,
        }).catch((e) =>
          console.error("Failed to publish auction deployed event:", e)
        );
      }
    },
    { connection: newConnection() }
  );

  worker.on("ready", () => console.log("Auction deploy worker ready"));
  worker.on("failed", (job, err) => {
    console.error(`Deploy job ${job?.id} failed:`, err.message);
    // Mark the auction failed only once retries are exhausted, then notify the
    // owner so their UI can leave the "pending" state.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void AuctionModel.findByIdAndUpdate(
        job.data.auctionId,
        { deploymentStatus: "failed" },
        { new: true }
      )
        .then((auction) => {
          if (!auction) return;
          return publishAuctionUpdate({
            userId: auction.userId,
            auctionId: auction.id,
            deploymentStatus: "failed",
            title: auction.title,
          });
        })
        .catch((e) => console.error("Failed to mark/publish auction failed:", e));
    }
  });

  return worker;
}
