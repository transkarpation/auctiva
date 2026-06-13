import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./env.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Application {
  const app = express();

  app.use(cors());

  // HTTP request logging: concise colorized output in dev, Apache-style
  // "combined" logs in production. Registered first so every request is logged.
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  // All routing (body parsing, auth, and route mounts) lives in the api router.
  app.use(apiRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler (async route rejections land here).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
