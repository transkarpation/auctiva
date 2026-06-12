import { Schema, model, type InferSchemaType } from "mongoose";

// A local mirror of a Clerk user, kept in sync via Clerk webhooks
// (user.created / user.updated / user.deleted). Clerk remains the source of
// truth; this collection exists so the app can list/look up users and join on
// them without calling the Clerk API on every request.
const userSchema = new Schema(
  {
    // Clerk user id (e.g. "user_3Eyvk..."). The stable primary identifier.
    clerkId: { type: String, required: true, unique: true, index: true },
    // Primary email address, when available.
    email: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    username: { type: String },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model("User", userSchema);
