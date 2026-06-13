import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listPublicGroups,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from "../controllers/groups.controller.js";

export const groupsRouter = Router();

// Declared before "/:id" routes (none are GET, but keep it explicit).
groupsRouter.get("/public", asyncHandler(listPublicGroups));
groupsRouter.get("/", asyncHandler(listGroups));
groupsRouter.post("/", asyncHandler(createGroup));
groupsRouter.patch("/:id", asyncHandler(updateGroup));
groupsRouter.delete("/:id", asyncHandler(deleteGroup));
