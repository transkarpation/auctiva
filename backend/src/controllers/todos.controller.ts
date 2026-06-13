import { type Request, type Response } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { TodoModel } from "../models/Todo.js";
import { GroupModel } from "../models/Group.js";
import { parse, objectId } from "../lib/validate.js";
import { userIdOf } from "../lib/http.js";

const todoTitle = z
  .string({ error: "title is required" })
  .trim()
  .min(1, "title is required")
  .max(500);
const createTodoSchema = z.object({ groupId: objectId, title: todoTitle });
const updateTodoSchema = z
  .object({ title: todoTitle.optional(), completed: z.boolean().optional() })
  .refine((d) => d.title !== undefined || d.completed !== undefined, {
    message: "Nothing to update",
  });
const reorderSchema = z.object({
  groupId: objectId,
  orderedIds: z.array(objectId),
});

// Confirms the group exists and belongs to the user. Returns true if valid.
async function ownsGroup(userId: string, groupId: string): Promise<boolean> {
  if (!isValidObjectId(groupId)) return false;
  const group = await GroupModel.exists({ _id: groupId, userId });
  return group !== null;
}

// List the current user's todos, optionally filtered to one group (?groupId=).
export async function listTodos(req: Request, res: Response): Promise<void> {
  const userId = userIdOf(req);
  const filter: { userId: string; groupId?: string } = { userId };

  const groupId = req.query.groupId;
  if (typeof groupId === "string" && groupId) {
    if (!(await ownsGroup(userId, groupId))) {
      res.status(400).json({ error: "Invalid groupId" });
      return;
    }
    filter.groupId = groupId;
  }

  const todos = await TodoModel.find(filter).sort({ order: 1, createdAt: 1 });
  res.json(todos);
}

// Create a todo within one of the user's groups.
export async function createTodo(req: Request, res: Response): Promise<void> {
  const data = parse(createTodoSchema, req.body, res);
  if (!data) return;
  const { groupId, title } = data;

  const userId = userIdOf(req);
  if (!(await ownsGroup(userId, groupId))) {
    res.status(400).json({ error: "Invalid groupId" });
    return;
  }

  // Place new todos at the bottom of the group.
  const last = await TodoModel.findOne({ userId, groupId })
    .sort({ order: -1 })
    .select("order")
    .lean();
  const order = (last?.order ?? -1) + 1;

  const todo = await TodoModel.create({ userId, groupId, title, order });
  res.status(201).json(todo);
}

// Reorder a group's todos. Body: { groupId, orderedIds: string[] }.
export async function reorderTodos(req: Request, res: Response): Promise<void> {
  const data = parse(reorderSchema, req.body, res);
  if (!data) return;
  const { groupId, orderedIds } = data;

  const userId = userIdOf(req);
  if (!(await ownsGroup(userId, groupId))) {
    res.status(400).json({ error: "Invalid groupId" });
    return;
  }

  // Set order = position; the filter keeps it scoped to the user's group so a
  // foreign or mismatched id simply matches nothing.
  if (orderedIds.length > 0) {
    await TodoModel.bulkWrite(
      orderedIds.map((id, i) => ({
        updateOne: {
          filter: { _id: id, userId, groupId },
          update: { $set: { order: i } },
        },
      }))
    );
  }

  const todos = await TodoModel.find({ userId, groupId }).sort({
    order: 1,
    createdAt: 1,
  });
  res.json(todos);
}

// Update a todo (title and/or completed).
export async function updateTodo(req: Request, res: Response): Promise<void> {
  const update = parse(updateTodoSchema, req.body, res);
  if (!update) return;

  const todo = await TodoModel.findOneAndUpdate(
    { _id: req.params.id, userId: userIdOf(req) },
    update,
    { new: true, runValidators: true }
  );
  if (!todo) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(todo);
}

// Delete a todo.
export async function deleteTodo(req: Request, res: Response): Promise<void> {
  const result = await TodoModel.findOneAndDelete({
    _id: req.params.id,
    userId: userIdOf(req),
  });
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
}
