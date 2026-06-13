import { Schema, model, type InferSchemaType } from "mongoose";

const auctionSchema = new Schema(
  {
    // Clerk user id — owns this auction.
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    // Minimum first bid, in wei. Stored as a decimal integer string because wei
    // amounts routinely exceed JS's safe integer range (1 ETH = 1e18 wei).
    startingPrice: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^\d+$/.test(v),
        message: "startingPrice must be a non-negative integer string (wei)",
      },
    },
    // Minimum amount (wei) by which each subsequent bid must exceed the highest.
    minBidIncrement: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^\d+$/.test(v),
        message: "minBidIncrement must be a non-negative integer string (wei)",
      },
    },
    // Seller's Ethereum wallet address (from MetaMask), stored lowercased.
    walletAddress: { type: String, required: true },
    // When true, any authenticated user can see this auction.
    isPublic: { type: Boolean, default: false, index: true },
    // Optional close time.
    endsAt: { type: Date },
    // On-chain deployment (Base Sepolia). Absent until deployment succeeds.
    contractAddress: { type: String },
    deploymentTxHash: { type: String },
    chain: { type: String },
    // pending = queued; deployed/failed = terminal.
    deploymentStatus: {
      type: String,
      enum: ["pending", "deployed", "failed"],
      default: "pending",
    },
    // Set once the worker has handled the bidding window closing (notified the
    // owner it's finalizable, or observed it already settled). Prevents
    // re-notifying on every scan.
    endNotifiedAt: { type: Date },
  },
  { timestamps: true }
);

export type Auction = InferSchemaType<typeof auctionSchema>;

export const AuctionModel = model("Auction", auctionSchema);
