import { Schema, model, type InferSchemaType } from "mongoose";

// Metadata for a user-uploaded file. The bytes live in a private S3 bucket;
// this document records who owns the object and how to read it. A CloudFront
// signed URL is minted once at upload time and stored here, so the client can
// access the file immediately without a second round-trip. The raw S3 key is
// never exposed publicly.
const fileSchema = new Schema(
  {
    // Clerk user id of the uploader/owner.
    userId: { type: String, required: true, index: true },
    // S3 object key (e.g. "uploads/<userId>/<uuid>.png"). Unique per object.
    key: { type: String, required: true, unique: true },
    // Original client-provided filename, for display/download only.
    originalName: { type: String, required: true },
    // MIME type stored on the S3 object.
    contentType: { type: String, required: true },
    // Size in bytes.
    size: { type: Number, required: true },
    // CloudFront signed URL granting read access to the object.
    signedUrl: { type: String, required: true },
    // When the signed URL stops working (CloudFront returns 403 afterwards).
    signedUrlExpiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type FileDoc = InferSchemaType<typeof fileSchema>;

export const FileModel = model("File", fileSchema);
