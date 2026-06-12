import { Schema, model, type InferSchemaType } from "mongoose";

const groupSchema = new Schema(
  {
    // Clerk user id — owns this group.
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    // URL-friendly identifier, unique per user (used in /tasks/:slug).
    slug: { type: String },
    // When true, this group's name is revealed alongside its public tasks.
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique per user, but only for docs that actually have a slug (so existing
// slug-less documents don't trip the constraint).
groupSchema.index(
  { userId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } }
);

export type Group = InferSchemaType<typeof groupSchema>;

export const GroupModel = model("Group", groupSchema);
