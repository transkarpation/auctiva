import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { env } from "../env.js";
import { asyncHandler } from "../lib/http.js";
import {
  uploadFile,
  listFiles,
  deleteFile,
} from "../controllers/files.controller.js";

export const filesRouter = Router();

// In-memory upload: the buffer is streamed straight to S3, so nothing touches
// local disk. Size is capped by UPLOAD_MAX_BYTES.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxBytes },
});

// Translates multer's own errors (e.g. file too large) into 400s instead of
// letting them fall through to the generic 500 handler.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `File exceeds the ${env.uploadMaxBytes}-byte limit`
          : err.message;
      res.status(400).json({ error: msg });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

filesRouter.get("/", asyncHandler(listFiles));
filesRouter.post("/", handleUpload, asyncHandler(uploadFile));
filesRouter.delete("/:id", asyncHandler(deleteFile));
