import { type Request, type Response } from "express";
import mongoose from "mongoose";

export function getHealth(_req: Request, res: Response): void {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.json({
    status: "ok",
    db: dbState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
}
