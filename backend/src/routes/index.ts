import express, { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { env } from "../env.js";
import { requireUser } from "../middleware/requireUser.js";
import { healthRouter } from "./health.router.js";
import { groupsRouter } from "./groups.router.js";
import { todosRouter } from "./todos.router.js";
import { auctionsRouter } from "./auctions.router.js";
import { notificationsRouter } from "./notifications.router.js";
import { realtimeRouter } from "./realtime.router.js";
import { filesRouter } from "./files.router.js";
import { webhooksRouter } from "./webhooks.router.js";

// Single entry point for the API: owns body parsing, auth, and all route mounts
// so app.ts only deals with app-level concerns (cors, logging, error handling).
export const apiRouter = Router();

// Webhooks must be verified against the RAW body, so register them with a
// raw parser BEFORE express.json() rewrites req.body.
apiRouter.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  webhooksRouter
);

apiRouter.use(express.json());

// Parses the Clerk session from the request (Authorization: Bearer <token>).
apiRouter.use(
  clerkMiddleware({
    publishableKey: env.clerkPublishableKey,
    secretKey: env.clerkSecretKey,
  })
);

// Public.
apiRouter.use("/health", healthRouter);

// Protected: requireUser returns 401 JSON for unauthenticated requests.
apiRouter.use("/groups", requireUser, groupsRouter);
apiRouter.use("/todos", requireUser, todosRouter);
apiRouter.use("/auctions", requireUser, auctionsRouter);
apiRouter.use("/notifications", requireUser, notificationsRouter);
apiRouter.use("/realtime", requireUser, realtimeRouter);
apiRouter.use("/files", requireUser, filesRouter);
