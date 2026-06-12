import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { GroupModel } from "../models/Group.js";
import { TodoModel } from "../models/Todo.js";
import { resolveOwnerNames } from "../lib/owners.js";
import { slugify } from "../lib/slug.js";
import { parse } from "../lib/validate.js";

export const groupsRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// requireUser (mounted in app.ts) guarantees userId is present here.
const userIdOf = (req: Request): string => getAuth(req).userId!;

const groupName = z
  .string({ error: "name is required" })
  .trim()
  .min(1, "name is required")
  .max(200);
const createGroupSchema = z.object({ name: groupName });
const updateGroupSchema = z
  .object({ name: groupName.optional(), isPublic: z.boolean().optional() })
  .refine((d) => d.name !== undefined || d.isPublic !== undefined, {
    message: "Nothing to update",
  });

// A slug from `name`, unique within the user's groups ("groceries", "groceries-2").
async function uniqueSlug(
  userId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; ; n++) {
    const clash = await GroupModel.exists({
      userId,
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return slug;
    slug = `${base}-${n}`;
  }
}

// Discovery: every public group across all users, with owner, progress, and
// its tasks. Declared before "/:id" routes (none are GET, but keep it explicit).
groupsRouter.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const groups = await GroupModel.find({ isPublic: true })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const groupIds = groups.map((g) => g._id);
    const todos = await TodoModel.find({ groupId: { $in: groupIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Bucket todos by their group.
    const byGroup = new Map<string, typeof todos>();
    for (const t of todos) {
      const key = String(t.groupId);
      const list = byGroup.get(key);
      if (list) list.push(t);
      else byGroup.set(key, [t]);
    }

    const names = await resolveOwnerNames([
      ...new Set(groups.map((g) => g.userId)),
    ]);

    res.json(
      groups.map((g) => {
        const items = byGroup.get(String(g._id)) ?? [];
        return {
          _id: g._id,
          name: g.name,
          ownerId: g.userId,
          ownerName: names.get(g.userId) ?? "Unknown user",
          total: items.length,
          completed: items.filter((t) => t.completed).length,
          todos: items.map((t) => ({
            _id: t._id,
            title: t.title,
            completed: t.completed,
          })),
        };
      })
    );
  })
);

// List the current user's groups (newest first).
groupsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const groups = await GroupModel.find({ userId: userIdOf(req) }).sort({
      createdAt: -1,
    });
    res.json(groups);
  })
);

// Create a group.
groupsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parse(createGroupSchema, req.body, res);
    if (!data) return;

    const userId = userIdOf(req);
    const slug = await uniqueSlug(userId, data.name);
    const group = await GroupModel.create({ userId, name: data.name, slug });
    res.status(201).json(group);
  })
);

// Update a group (rename and/or toggle public).
groupsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = parse(updateGroupSchema, req.body, res);
    if (!data) return;

    const userId = userIdOf(req);
    const update: { name?: string; slug?: string; isPublic?: boolean } = {};
    if (data.name !== undefined) {
      update.name = data.name;
      // Keep the slug in step with the name (still unique per user).
      update.slug = await uniqueSlug(userId, data.name, req.params.id);
    }
    if (data.isPublic !== undefined) update.isPublic = data.isPublic;

    const group = await GroupModel.findOneAndUpdate(
      { _id: req.params.id, userId },
      update,
      { new: true, runValidators: true }
    );
    if (!group) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(group);
  })
);

// Delete a group and all of its todos.
groupsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const group = await GroupModel.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!group) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await TodoModel.deleteMany({ groupId: group._id, userId });
    res.status(204).end();
  })
);
