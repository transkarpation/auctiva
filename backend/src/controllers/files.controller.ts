import { type Request, type Response } from "express";
import { fileStorageEnabled } from "../env.js";
import { FileModel } from "../models/File.js";
import { buildObjectKey, putObject, deleteObject } from "../lib/s3.js";
import { signObjectUrl } from "../lib/cloudfront.js";
import { objectId } from "../lib/validate.js";
import { userIdOf } from "../lib/http.js";

// Shared guard: every file route is unusable until S3 + CloudFront are wired.
function ensureConfigured(res: Response): boolean {
  if (!fileStorageEnabled) {
    res.status(503).json({ error: "File storage is not configured" });
    return false;
  }
  return true;
}

// Shape returned to clients — includes the stored CloudFront signed URL so the
// file is immediately accessible, but never leaks the raw bucket location.
function serialize(doc: InstanceType<typeof FileModel>) {
  return {
    id: doc._id,
    key: doc.key,
    originalName: doc.originalName,
    contentType: doc.contentType,
    size: doc.size,
    url: doc.signedUrl,
    expiresAt: doc.signedUrlExpiresAt,
    createdAt: doc.createdAt,
  };
}

// POST /files  (multipart/form-data, field "file")
// Buffers the upload (multer memoryStorage), stores it in the private bucket,
// then mints a CloudFront signed URL (7-day default) and persists it so the
// response can hand the client an immediately usable link.
export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!ensureConfigured(res)) return;

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded (expected field 'file')" });
    return;
  }

  const userId = userIdOf(req);
  const key = buildObjectKey(userId, file.originalname);
  const contentType = file.mimetype || "application/octet-stream";

  await putObject({ key, body: file.buffer, contentType });

  const signed = signObjectUrl(key);
  const doc = await FileModel.create({
    userId,
    key,
    originalName: file.originalname,
    contentType,
    size: file.size,
    signedUrl: signed.url,
    signedUrlExpiresAt: signed.expiresAt,
  });

  res.status(201).json(serialize(doc));
}

// GET /files — list the current user's uploaded files (newest first).
export async function listFiles(req: Request, res: Response): Promise<void> {
  if (!ensureConfigured(res)) return;
  const files = await FileModel.find({ userId: userIdOf(req) }).sort({
    createdAt: -1,
  });
  res.json(files.map(serialize));
}

// DELETE /files/:id — remove the S3 object and its metadata.
export async function deleteFile(req: Request, res: Response): Promise<void> {
  if (!ensureConfigured(res)) return;

  const id = objectId.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const file = await FileModel.findOne({
    _id: id.data,
    userId: userIdOf(req),
  });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  await deleteObject(file.key);
  await file.deleteOne();
  res.status(204).end();
}
