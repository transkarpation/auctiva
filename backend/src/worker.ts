import { connectDB } from "./config/db.js";
import { startDeployWorker } from "./queue/deployQueue.js";
import { env } from "./env.js";

// Standalone worker process: connects to Mongo and drains the BullMQ deploy
// queue. Run separately from the API server (`npm run worker`).
async function start(): Promise<void> {
  if (!env.redisUrl) {
    console.error(
      "REDIS_URL is not set — the worker has no queue to process. Exiting."
    );
    process.exit(1);
  }

  try {
    await connectDB();
    const worker = startDeployWorker();
    if (!worker) {
      console.error("Failed to start the deploy worker.");
      process.exit(1);
    }
    console.log("Deploy worker started and listening for jobs.");

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`Received ${signal}, shutting down worker...`);
      await worker.close();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start worker:", err);
    process.exit(1);
  }
}

void start();
