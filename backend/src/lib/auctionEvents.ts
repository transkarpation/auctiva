import { publishToUser } from "./centrifugo.js";

type AuctionUpdate = {
  userId: string;
  auctionId: string;
  deploymentStatus: "pending" | "deployed" | "failed";
  title?: string;
  contractAddress?: string | null;
  deploymentTxHash?: string | null;
};

// Pushes an auction deployment-status change to the owner's personal channel so
// their UI can update without polling. Best-effort: realtime delivery must never
// block or fail the deployment itself, so callers should ignore rejections.
export function publishAuctionUpdate(a: AuctionUpdate): Promise<void> {
  return publishToUser(a.userId, {
    type: "auction.updated",
    auctionId: a.auctionId,
    deploymentStatus: a.deploymentStatus,
    title: a.title,
    contractAddress: a.contractAddress ?? undefined,
    deploymentTxHash: a.deploymentTxHash ?? undefined,
    at: new Date().toISOString(),
  });
}
