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
    // Attached images. Each entry references an uploaded File and snapshots its
    // CloudFront signed URL so the card can render without a second lookup.
    images: {
      type: [
        new Schema(
          {
            fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
            url: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // When true, any authenticated user can see this auction.
    isPublic: { type: Boolean, default: false, index: true },
    // Lifecycle. A "draft" is owner-only, freely editable/deletable, and not on
    // chain. Publishing flips it to "published" and kicks off deployment.
    // Defaults to "published" so pre-existing auctions keep their behaviour.
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    // Optional close time.
    endsAt: { type: Date },
    // On-chain deployment (Base Sepolia). Absent until deployment succeeds.
    contractAddress: { type: String },
    deploymentTxHash: { type: String },
    chain: { type: String },
    // none = draft (not deployed); pending = queued; deployed/failed = terminal.
    deploymentStatus: {
      type: String,
      enum: ["none", "pending", "deployed", "failed"],
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
