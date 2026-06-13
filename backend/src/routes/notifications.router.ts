import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listNotifications,
  updateNotification,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", asyncHandler(listNotifications));
// Declared before "/:id" so "read-all" isn't matched as an id.
notificationsRouter.patch("/read-all", asyncHandler(markAllNotificationsRead));
notificationsRouter.patch("/:id", asyncHandler(updateNotification));
notificationsRouter.delete("/:id", asyncHandler(deleteNotification));
