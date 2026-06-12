import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.json({
    status: "ok",
    db: dbState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});
