import { Schema, model, type InferSchemaType } from "mongoose";

const bidSchema = new Schema(
  {
    // The auction this bid was placed on.
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true, index: true },
    // Clerk user id of the authenticated user who confirmed the bid.
    userId: { type: String, required: true, index: true },
    // The auction's on-chain contract the bid transaction was sent to.
    contractAddress: { type: String, required: true },
    // Bidder's wallet address taken from the on-chain event, lowercased.
    bidder: { type: String, required: true },
    // Bid amount in wei (decimal integer string — wei exceeds JS safe ints).
    amount: { type: String, required: true },
    // Bid transaction hash, lowercased. Unique so the same on-chain bid is only
    // ever recorded once (makes confirmation idempotent).
    transactionHash: { type: String, required: true, unique: true },
    // Block the bid transaction was mined in.
    blockNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

export type Bid = InferSchemaType<typeof bidSchema>;

export const BidModel = model("Bid", bidSchema);
