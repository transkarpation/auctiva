import { formatEther } from "ethers";
import { Types } from "mongoose";
import { BidModel } from "../models/Bid.js";
import { NotificationModel } from "../models/Notification.js";
import { publishToUser } from "./centrifugo.js";

type NotificationType = "bid.placed" | "auction.ended" | "auction.endable";

type FanOutInput = {
  auctionId: string;
  ownerId: string;
  // A user to leave out of the recipients (e.g. the bidder for their own bid).
  excludeUserId?: string;
  type: NotificationType;
  message: string;
  data: Record<string, unknown>;
  // De-dup key. When set, the same (recipient, type, tx) is only ever
  // stored/pushed once (safe to call from multiple event sources). When omitted
  // (time-based events with no tx), the caller must guarantee a single call.
  transactionHash?: string;
};

// Stores and realtime-pushes a notification to everyone who cares about an
// auction: its owner plus every user who has bid on it (participants), minus an
// optional excluded user.
export async function notifyAuctionParticipants(input: FanOutInput): Promise<void> {
  const priorBidderIds = await BidModel.distinct("userId", {
    auctionId: input.auctionId,
  });

  const recipients = new Set<string>([input.ownerId, ...priorBidderIds]);
  if (input.excludeUserId) recipients.delete(input.excludeUserId);
  const ids = [...recipients];
  if (ids.length === 0) return;

  const auctionId = new Types.ObjectId(input.auctionId);
  // Recipients that got a freshly-created notification (so we only push those).
  let created: { userId: string; id: string }[];

  if (input.transactionHash) {
    // Idempotent upsert keyed on (userId, type, tx): re-processing the same
    // event is a no-op, so this is safe to call from multiple sources.
    const result = await NotificationModel.bulkWrite(
      ids.map((userId) => ({
        updateOne: {
          filter: { userId, type: input.type, transactionHash: input.transactionHash },
          update: {
            $setOnInsert: {
              userId,
              type: input.type,
              read: false,
              message: input.message,
              auctionId,
              transactionHash: input.transactionHash,
              data: input.data,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    created = Object.entries(result.upsertedIds ?? {}).map(([index, id]) => ({
      userId: ids[Number(index)],
      id: String(id),
    }));
  } else {
    // No de-dup key: plain insert (caller guarantees a single invocation).
    const docs = await NotificationModel.insertMany(
      ids.map((userId) => ({
        userId,
        type: input.type,
        read: false,
        message: input.message,
        auctionId,
        data: input.data,
      }))
    );
    created = docs.map((d) => ({ userId: d.userId, id: d.id }));
  }

  // Realtime push for the freshly-created notifications (best-effort).
  await Promise.all(
    created.map(({ userId, id }) =>
      publishToUser(userId, {
        type: "notification",
        notificationId: id,
        notificationType: input.type,
        message: input.message,
        auctionId: input.auctionId,
        at: new Date().toISOString(),
      }).catch((err) =>
        console.error(`Failed to publish notification to ${userId}:`, err)
      )
    )
  );
}

type NewBidInput = {
  auction: { id: string; userId: string; title: string };
  bid: { userId: string; bidder: string; amount: string; transactionHash: string };
};

// Notify the owner and other participants about a new bid (excluding the bidder).
export function notifyNewBid({ auction, bid }: NewBidInput): Promise<void> {
  return notifyAuctionParticipants({
    auctionId: auction.id,
    ownerId: auction.userId,
    excludeUserId: bid.userId,
    type: "bid.placed",
    message: `New bid of ${formatEther(BigInt(bid.amount))} ETH on "${auction.title}"`,
    data: {
      bidder: bid.bidder,
      amount: bid.amount,
      transactionHash: bid.transactionHash,
    },
    transactionHash: bid.transactionHash,
  });
}

// Notify the owner and all participants that an auction's bidding window has
// closed and it can now be finalized on-chain (auctionEnd is permissionless, so
// anyone here may call it to release funds). Called once per auction by the
// watcher's scan, so no de-dup key is needed.
export function notifyAuctionEndable(auction: {
  id: string;
  userId: string;
  title: string;
}): Promise<void> {
  return notifyAuctionParticipants({
    auctionId: auction.id,
    ownerId: auction.userId,
    type: "auction.endable",
    message: `Auction "${auction.title}" has ended — it can now be finalized to release funds.`,
    data: {},
  });
}

type AuctionEndedInput = {
  auction: { id: string; userId: string; title: string };
  winner: string;
  amountWei: string;
  transactionHash: string;
};

// Notify the owner and all participants that an auction has ended.
export function notifyAuctionEnded({
  auction,
  winner,
  amountWei,
  transactionHash,
}: AuctionEndedInput): Promise<void> {
  const hasWinner = BigInt(amountWei) > 0n;
  const message = hasWinner
    ? `Auction "${auction.title}" ended — winning bid ${formatEther(BigInt(amountWei))} ETH`
    : `Auction "${auction.title}" ended with no bids`;

  return notifyAuctionParticipants({
    auctionId: auction.id,
    ownerId: auction.userId,
    type: "auction.ended",
    message,
    data: { winner, amount: amountWei, transactionHash },
    transactionHash,
  });
}
