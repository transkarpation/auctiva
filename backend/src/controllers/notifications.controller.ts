import { type Request, type Response } from "express";
import { z } from "zod";
import { NotificationModel } from "../models/Notification.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/http.js";

// List the current user's notifications (newest first).
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const notifications = await NotificationModel.find({ userId: userIdOf(req) })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(notifications);
}

const updateNotificationSchema = z.object({ read: z.boolean() });

// Update a notification's read state.
export async function updateNotification(req: Request, res: Response): Promise<void> {
  const data = parse(updateNotificationSchema, req.body, res);
  if (!data) return;

  const notification = await NotificationModel.findOneAndUpdate(
    { _id: req.params.id, userId: userIdOf(req) },
    { read: data.read },
    { new: true }
  );
  if (!notification) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(notification);
}

// Mark all of the user's unread notifications as read.
// Declared before "/:id" so "read-all" isn't matched as an id.
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const result = await NotificationModel.updateMany(
    { userId: userIdOf(req), read: false },
    { read: true }
  );
  res.json({ updated: result.modifiedCount });
}

// Delete a notification.
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const result = await NotificationModel.findOneAndDelete({
    _id: req.params.id,
    userId: userIdOf(req),
  });
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
}
