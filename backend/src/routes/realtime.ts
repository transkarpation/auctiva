import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import {
  getCentrifugoToken,
  notifySelf,
} from "../controllers/realtime.controller.js";

export const realtimeRouter = Router();

realtimeRouter.get("/centrifugo-token", asyncHandler(getCentrifugoToken));
realtimeRouter.post("/notify-self", asyncHandler(notifySelf));
