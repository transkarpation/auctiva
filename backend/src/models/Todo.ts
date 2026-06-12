import { Schema, model, type InferSchemaType } from "mongoose";

const todoSchema = new Schema(
  {
    // Clerk user id (e.g. "user_xxx") — owns this todo.
    userId: { type: String, required: true, index: true },
    // The group this todo belongs to (owned by the same user).
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    completed: { type: Boolean, default: false },
    // Manual sort position within the group (ascending). Lower = higher up.
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type Todo = InferSchemaType<typeof todoSchema>;

export const TodoModel = model("Todo", todoSchema);
