import type { Response } from "express";
import { z } from "zod";

// Validates `data` against `schema`. On failure, sends a 400 with the first
// issue's message and returns undefined; otherwise returns the parsed value.
export function parse<S extends z.ZodType>(
  schema: S,
  data: unknown,
  res: Response
): z.infer<S> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: firstMessage(result.error) });
    return undefined;
  }
  return result.data;
}

function firstMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

// Reusable schema for a Mongo ObjectId-shaped string.
export const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid id");
