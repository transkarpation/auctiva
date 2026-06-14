import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";
import { refreshExpiringSignedUrls } from "../lib/fileUrls.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "url-refresh-worker" });

const QUEUE_NAME = "file-url-refresh";

// Cron cadence: run every 5 days. The refresh-ahead window (6 days) must exceed
// this gap, and the signed-URL TTL (SIGNED_URL_TTL_SECONDS, default 7 days) must
// exceed the window — so: cadence (5d) < ahead (6d) < TTL (7d). That ordering
// guarantees a stored URL is always re-signed before it can expire.
const REFRESH_EVERY_MS = 5 * 24 * 60 * 60 * 1000;
const REFRESH_AHEAD_MS = 6 * 24 * 60 * 60 * 1000;

// Backed by Redis, like the deploy queue — repeatable schedules persist there,
// so the cron survives worker restarts (a plain setInterval would not).
export function refreshQueueEnabled(): boolean {
  return Boolean(env.redisUrl);
}

// BullMQ requires maxRetriesPerRequest: null on its connections.
function newConnection(): ConnectionOptions {
  return new Redis(env.redisUrl!, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;
}

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: newConnection() });
  }
  return queue;
}

// Registers the every-5-days repeatable job. Idempotent: BullMQ derives a
// deterministic repeat key from the options, so calling this on each start does
// not create duplicate schedules.
export async function scheduleUrlRefresh(): Promise<void> {
  if (!refreshQueueEnabled()) return;
  await getQueue().add(
    "refresh",
    {},
    {
      repeat: { every: REFRESH_EVERY_MS },
      removeOnComplete: 50,
      removeOnFail: 100,
    }
  );
}

// Starts the worker that performs the refresh. Call once at worker start.
export function startUrlRefreshWorker(): Worker | null {
  if (!refreshQueueEnabled()) return null;

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const stats = await refreshExpiringSignedUrls({ aheadMs: REFRESH_AHEAD_MS });
      log.info(stats, "Signed-URL refresh complete");
    },
    { connection: newConnection() }
  );

  worker.on("ready", () => log.info("File URL refresh worker ready"));
  worker.on("failed", (job, err) =>
    log.error({ err, jobId: job?.id }, "URL refresh job failed")
  );

  return worker;
}
