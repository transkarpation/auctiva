import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import {
  createConnectionToken,
  personalChannelFor,
  publishToUser,
} from "../lib/centrifugo.js";
import { parse } from "../lib/validate.js";

export const realtimeRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// requireUser (mounted in app.ts) guarantees userId is present here.
const userIdOf = (req: Request): string => getAuth(req).userId!;

// Issues a short-lived Centrifugo connection token for the signed-in user,
// plus the name of their personal channel so the client knows what to subscribe
// to. Called on connect and on Centrifugo's refresh requests.
realtimeRouter.get(
  "/centrifugo-token",
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    res.json({
      token: createConnectionToken(userId),
      personalChannel: personalChannelFor(userId),
    });
  })
);

// Demo/dev helper: publish a message to the caller's own personal channel so
// the realtime path can be exercised end-to-end from the UI.
const notifySchema = z.object({ message: z.string().trim().min(1).max(2000) });

realtimeRouter.post(
  "/notify-self",
  asyncHandler(async (req, res) => {
    const data = parse(notifySchema, req.body, res);
    if (!data) return;
    await publishToUser(userIdOf(req), {
      type: "notification",
      message: data.message,
      at: new Date().toISOString(),
    });
    res.status(202).json({ ok: true });
  })
);
