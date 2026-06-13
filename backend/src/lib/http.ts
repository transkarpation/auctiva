import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

// Wrap async handlers so rejected promises reach Express' error handler.
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// requireUser (mounted in app.ts) guarantees userId is present here.
export const userIdOf = (req: Request): string => getAuth(req).userId!;
