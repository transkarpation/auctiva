import { Router } from "express";
import { handleClerkWebhook } from "../controllers/webhooks.controller.js";

export const webhooksRouter = Router();

webhooksRouter.post("/clerk", handleClerkWebhook);
