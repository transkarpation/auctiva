import { formatEther } from "ethers";
import { BidModel } from "../models/Bid.js";
import { NotificationModel } from "../models/Notification.js";
import { publishToUser } from "./centrifugo.js";

type NewBidInput = {
  auction: { id: string; userId: string; title: string };
  bid: { userId: string; bidder: string; amount: string; transactionHash: string };
};

// Notifies the people who care about a new bid: the auction's owner and every
// other user who has already bid on it — excluding whoever just bid. Stores a
// Notification per recipient and best-effort pushes it to their realtime
// channel so the UI can surface it without polling.
export async function notifyNewBid({ auction, bid }: NewBidInput): Promise<void> {
  // Prior bidders on this auction (the just-recorded bid is already included).
  const priorBidderIds = await BidModel.distinct("userId", {
    auctionId: auction.id,
  });

  const recipients = new Set<string>([auction.userId, ...priorBidderIds]);
  recipients.delete(bid.userId);
  if (recipients.size === 0) return;

  const message = `New bid of ${formatEther(BigInt(bid.amount))} ETH on "${auction.title}"`;
  const data = {
    bidder: bid.bidder,
    amount: bid.amount,
    transactionHash: bid.transactionHash,
  };

  const notifications = await NotificationModel.insertMany(
    [...recipients].map((userId) => ({
      userId,
      type: "bid.placed" as const,
      message,
      auctionId: auction.id,
      data,
    }))
  );

  // Realtime delivery is best-effort — a failed publish must not undo the
  // stored notifications or fail the bid.
  await Promise.all(
    notifications.map((n) =>
      publishToUser(n.userId, {
        type: "notification",
        notificationId: n.id,
        notificationType: n.type,
        message: n.message,
        auctionId: auction.id,
        at: new Date().toISOString(),
      }).catch((err) =>
        console.error(`Failed to publish notification to ${n.userId}:`, err)
      )
    )
  );
}
