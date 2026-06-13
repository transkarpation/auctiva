import pino from "pino";
import { env } from "../env.js";

// Shared application logger. Pretty, colorized output in development; structured
// JSON (one line per log) in production for log aggregators to ingest.
export const logger = pino({
  level: env.isProduction ? "info" : "debug",
  ...(env.isProduction
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true } } }),
});
