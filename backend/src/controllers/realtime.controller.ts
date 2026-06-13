import { type Request, type Response } from "express";
import { z } from "zod";
import {
  createConnectionToken,
  personalChannelFor,
  publishToUser,
} from "../lib/centrifugo.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/http.js";

// Issues a short-lived Centrifugo connection token for the signed-in user,
// plus the name of their personal channel so the client knows what to subscribe
// to. Called on connect and on Centrifugo's refresh requests.
export async function getCentrifugoToken(req: Request, res: Response): Promise<void> {
  const userId = userIdOf(req);
  res.json({
    token: createConnectionToken(userId),
    personalChannel: personalChannelFor(userId),
  });
}

// Demo/dev helper: publish a message to the caller's own personal channel so
// the realtime path can be exercised end-to-end from the UI.
const notifySchema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function notifySelf(req: Request, res: Response): Promise<void> {
  const data = parse(notifySchema, req.body, res);
  if (!data) return;
  await publishToUser(userIdOf(req), {
    type: "notification",
    message: data.message,
    at: new Date().toISOString(),
  });
  res.status(202).json({ ok: true });
}
