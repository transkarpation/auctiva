import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listTodos,
  createTodo,
  reorderTodos,
  updateTodo,
  deleteTodo,
} from "../controllers/todos.controller.js";

export const todosRouter = Router();

todosRouter.get("/", asyncHandler(listTodos));
todosRouter.post("/", asyncHandler(createTodo));
// Declared before "/:id" so "reorder" isn't matched as an id.
todosRouter.patch("/reorder", asyncHandler(reorderTodos));
todosRouter.patch("/:id", asyncHandler(updateTodo));
todosRouter.delete("/:id", asyncHandler(deleteTodo));
