import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

// API-friendly auth guard: relies on clerkMiddleware() having run, and
// returns 401 JSON (rather than redirecting) when there is no signed-in user.
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
