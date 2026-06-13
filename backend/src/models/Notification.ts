import { Schema, model, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    // Clerk user id of the recipient.
    userId: { type: String, required: true, index: true },
    // Notification kind (extensible).
    type: {
      type: String,
      required: true,
      enum: ["bid.placed", "auction.ended", "auction.endable"],
    },
    // Whether the recipient has seen/read it.
    read: { type: Boolean, default: false, index: true },
    // Human-readable summary shown in the UI.
    message: { type: String, required: true },
    // The auction this notification relates to, if any.
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", index: true },
    // The on-chain transaction this notification was derived from, if any. Used
    // to de-duplicate notifications produced from the same event by different
    // sources (the bid-confirm endpoint and the chain-event watcher).
    transactionHash: { type: String },
    // Type-specific payload (e.g. bidder, amount, transactionHash for bids).
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// At most one notification per (recipient, type, transaction). Partial so
// notifications without a transactionHash are not constrained.
notificationSchema.index(
  { userId: 1, type: 1, transactionHash: 1 },
  { unique: true, partialFilterExpression: { transactionHash: { $exists: true } } }
);

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
