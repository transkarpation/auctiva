import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../env.js";

// Lazily created so importing this module never throws when AWS env is unset
// (the file routes guard on fileStorageEnabled before calling in here).
let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.awsRegion,
      // Pass explicit creds only when both are set; otherwise fall back to the
      // default AWS credential provider chain (shared config / instance role).
      ...(env.awsAccessKeyId && env.awsSecretAccessKey
        ? {
            credentials: {
              accessKeyId: env.awsAccessKeyId,
              secretAccessKey: env.awsSecretAccessKey,
            },
          }
        : {}),
    });
  }
  return client;
}

// Builds an opaque, collision-free object key. We keep the original extension
// so CloudFront/browsers infer a sensible content type, but never trust the
// original filename for the key itself.
export function buildObjectKey(userId: string, originalName: string): string {
  const ext = extname(originalName).toLowerCase().slice(0, 12);
  return `uploads/${userId}/${randomUUID()}${ext}`;
}

// Uploads a buffer to the private bucket. No ACL is set — the bucket has Block
// Public Access on and is reachable only through CloudFront (OAC).
export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(
    new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key })
  );
}
