import { Schema, model, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    // Clerk user id of the recipient.
    userId: { type: String, required: true, index: true },
    // Notification kind (extensible). Currently only new-bid notifications.
    type: { type: String, required: true, enum: ["bid.placed"] },
    // Whether the recipient has seen/read it.
    read: { type: Boolean, default: false, index: true },
    // Human-readable summary shown in the UI.
    message: { type: String, required: true },
    // The auction this notification relates to, if any.
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", index: true },
    // Type-specific payload (e.g. bidder, amount, transactionHash for bids).
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
