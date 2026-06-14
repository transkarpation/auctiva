import { connectDB } from "./config/db.js";
import { startDeployWorker } from "./queue/deployQueue.js";
import {
  scheduleUrlRefresh,
  startUrlRefreshWorker,
} from "./queue/refreshUrlsQueue.js";
import { startAuctionWatcher, stopAuctionWatcher } from "./lib/auctionWatcher.js";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";

// Standalone background process: connects to Mongo, watches auction contracts
// for on-chain events (turning them into notifications), and — when Redis is
// configured — drains the BullMQ deploy queue. Run via `npm run worker`.
async function start(): Promise<void> {
  try {
    await connectDB();

    startAuctionWatcher();
    logger.info("Auction chain-event watcher started.");

    const deployWorker = env.redisUrl ? startDeployWorker() : null;
    if (deployWorker) {
      logger.info("Deploy worker started and listening for jobs.");
    } else {
      logger.warn(
        "REDIS_URL not set — deploy queue worker disabled (chain watcher still running)."
      );
    }

    // Every-5-days cron that re-signs file CloudFront URLs before they expire.
    const urlRefreshWorker = env.redisUrl ? startUrlRefreshWorker() : null;
    if (urlRefreshWorker) {
      await scheduleUrlRefresh();
      logger.info("File URL refresh worker started; refresh scheduled every 5 days.");
    }

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down...`);
      await stopAuctionWatcher();
      if (deployWorker) await deployWorker.close();
      if (urlRefreshWorker) await urlRefreshWorker.close();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    logger.error({ err }, "Failed to start worker");
    process.exit(1);
  }
}

void start();
