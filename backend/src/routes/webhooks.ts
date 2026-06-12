import { Router, type Request, type Response } from "express";
import { Webhook } from "svix";
import { env } from "../env.js";
import { TodoModel } from "../models/Todo.js";
import { UserModel } from "../models/User.js";

export const webhooksRouter = Router();

// Subset of Clerk's user webhook payload we read.
type ClerkUserData = {
  id?: string;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  [key: string]: unknown;
};

// Subset of Clerk's webhook event shape we care about.
type ClerkEvent = {
  type: string;
  data: ClerkUserData;
};

// Upserts our local mirror of a Clerk user from a user.created/updated payload.
async function upsertUser(data: ClerkUserData): Promise<void> {
  const clerkId = data.id;
  if (!clerkId) return;

  const primaryEmail =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses?.[0]?.email_address;

  await UserModel.findOneAndUpdate(
    { clerkId },
    {
      clerkId,
      email: primaryEmail,
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
      username: data.username ?? undefined,
      imageUrl: data.image_url ?? undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// POST /api/webhooks/clerk
// NOTE: this route must receive the RAW body (see app.ts) — Svix verifies the
// signature over the exact bytes Clerk sent.
webhooksRouter.post("/clerk", async (req: Request, res: Response) => {
  if (!env.clerkWebhookSecret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  const payload = (req.body as Buffer).toString("utf8");
  const headers = {
    "svix-id": req.header("svix-id") ?? "",
    "svix-timestamp": req.header("svix-timestamp") ?? "",
    "svix-signature": req.header("svix-signature") ?? "",
  };

  let event: ClerkEvent;
  try {
    const wh = new Webhook(env.clerkWebhookSecret);
    event = wh.verify(payload, headers) as ClerkEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  // Handle the events we care about; ack everything else with 200.
  switch (event.type) {
    case "user.deleted": {
      const userId = event.data.id;
      if (userId) {
        await UserModel.deleteOne({ clerkId: userId });
        const { deletedCount } = await TodoModel.deleteMany({ userId });
        console.log(`user.deleted ${userId} — removed ${deletedCount} todos`);
      }
      break;
    }
    case "user.created":
    case "user.updated":
      await upsertUser(event.data);
      console.log(`${event.type}: ${event.data.id}`);
      break;
    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }

  res.status(200).json({ received: true });
});
