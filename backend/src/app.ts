import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./env.js";
import { requireUser } from "./middleware/requireUser.js";
import { healthRouter } from "./routes/health.js";
import { groupsRouter } from "./routes/groups.js";
import { todosRouter } from "./routes/todos.js";
import { auctionsRouter } from "./routes/auctions.js";
import { realtimeRouter } from "./routes/realtime.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp(): Application {
  const app = express();

  app.use(cors());

  // HTTP request logging: concise colorized output in dev, Apache-style
  // "combined" logs in production. Registered first so every request is logged.
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  // Webhooks must be verified against the RAW body, so register them with a
  // raw parser BEFORE express.json() rewrites req.body.
  app.use(
    "/api/webhooks",
    express.raw({ type: "application/json" }),
    webhooksRouter
  );

  app.use(express.json());

  // Parses the Clerk session from the request (Authorization: Bearer <token>).
  app.use(
    clerkMiddleware({
      publishableKey: env.clerkPublishableKey,
      secretKey: env.clerkSecretKey,
    })
  );

  // Public.
  app.use("/health", healthRouter);

  // Protected: requireUser returns 401 JSON for unauthenticated requests.
  app.use("/groups", requireUser, groupsRouter);
  app.use("/todos", requireUser, todosRouter);
  app.use("/auctions", requireUser, auctionsRouter);
  app.use("/realtime", requireUser, realtimeRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler (async route rejections land here).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
