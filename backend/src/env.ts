import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex address");
const ethPrivateKey = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 64-hex private key");

// An optional non-empty string that also treats an empty/whitespace .env value
// (e.g. "AWS_ACCESS_KEY_ID=") as absent, since dotenv yields "" rather than
// undefined for a present-but-blank key.
const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional()
);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z
    .string()
    .min(1)
    .default("mongodb://admin:secret@localhost:27017/crm?authSource=admin"),

  // Clerk
  CLERK_PUBLISHABLE_KEY: z.string().default(""),
  CLERK_SECRET_KEY: z.string().default(""),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().default(""),

  // App-owned wallet.
  INTERNAL_WALLET_ADDRESS: ethAddress,
  INTERNAL_WALLET_PRIVATE: ethPrivateKey,

  // Blockchain RPC endpoints and chain name (e.g. "base-sepolia").
  BC_HTTP: z.url(),
  BC_WSS: z.url(),
  BC_NAME: z.string().min(1),

  // Redis connection for the BullMQ deploy queue (optional). When unset, the
  // contract deploy runs synchronously inside the request instead.
  REDIS_URL: z.string().min(1).optional(),

  // Shared HMAC secret used to sign Centrifugo connection tokens. Must match
  // CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY in the Centrifugo container.
  CENTRIFUGO_TOKEN_HMAC_SECRET: z.string().min(1).default("secret"),

  // Centrifugo HTTP API — used by the backend to publish into channels.
  // CENTRIFUGO_API_KEY must match CENTRIFUGO_HTTP_API_KEY in the container.
  CENTRIFUGO_API_URL: z.url().default("http://localhost:8000/api"),
  CENTRIFUGO_API_KEY: z.string().min(1).default("secret"),

  // --- File storage (S3 + CloudFront signed URLs) -------------------------
  // All optional: when storage is unconfigured the file routes return 503.
  // AWS_ACCESS_KEY_ID/SECRET fall back to the default AWS credential chain
  // (shared config, env, or instance role) when left blank.
  AWS_REGION: optionalStr,
  AWS_ACCESS_KEY_ID: optionalStr,
  AWS_SECRET_ACCESS_KEY: optionalStr,
  // Private S3 bucket uploads are stored in (Block Public Access on).
  S3_BUCKET: optionalStr,
  // Max accepted upload size in bytes (default 10 MiB).
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // CloudFront distribution domain fronting the bucket, e.g.
  // "d111111abcdef8.cloudfront.net" (no scheme, no trailing slash).
  CLOUDFRONT_DOMAIN: optionalStr,
  // CloudFront public-key id used to sign URLs (e.g. "K2JCJMDEHXQW5F").
  CLOUDFRONT_KEY_PAIR_ID: optionalStr,
  // PEM private key matching that public key. Supports literal "\n" escapes so
  // it can sit on a single .env line.
  CLOUDFRONT_PRIVATE_KEY: optionalStr,
  // Signed-URL lifetime in seconds. Minted once at upload time and stored with
  // the file (default 7 days).
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const e = parsed.data;

// Validated, typed environment — import this anywhere instead of process.env.
export const env = {
  port: e.PORT,
  nodeEnv: e.NODE_ENV,
  isProduction: e.NODE_ENV === "production",
  mongoUri: e.MONGO_URI,
  clerkPublishableKey: e.CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: e.CLERK_SECRET_KEY,
  clerkWebhookSecret: e.CLERK_WEBHOOK_SIGNING_SECRET,
  internalWalletAddress: e.INTERNAL_WALLET_ADDRESS,
  internalWalletPrivate: e.INTERNAL_WALLET_PRIVATE,
  bcHttp: e.BC_HTTP,
  bcWss: e.BC_WSS,
  bcName: e.BC_NAME,
  redisUrl: e.REDIS_URL,
  centrifugoTokenSecret: e.CENTRIFUGO_TOKEN_HMAC_SECRET,
  centrifugoApiUrl: e.CENTRIFUGO_API_URL,
  centrifugoApiKey: e.CENTRIFUGO_API_KEY,
  awsRegion: e.AWS_REGION,
  awsAccessKeyId: e.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: e.AWS_SECRET_ACCESS_KEY,
  s3Bucket: e.S3_BUCKET,
  uploadMaxBytes: e.UPLOAD_MAX_BYTES,
  cloudfrontDomain: e.CLOUDFRONT_DOMAIN,
  cloudfrontKeyPairId: e.CLOUDFRONT_KEY_PAIR_ID,
  // Restore newlines so a single-line .env value parses as a valid PEM.
  cloudfrontPrivateKey: e.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  signedUrlTtlSeconds: e.SIGNED_URL_TTL_SECONDS,
} as const;

// True only when every piece needed to upload + sign is present. The file
// routes check this and return 503 when storage isn't configured.
export const fileStorageEnabled = Boolean(
  env.awsRegion &&
    env.s3Bucket &&
    env.cloudfrontDomain &&
    env.cloudfrontKeyPairId &&
    env.cloudfrontPrivateKey
);

if (!env.clerkSecretKey) {
  console.warn(
    "Warning: CLERK_SECRET_KEY is not set — authenticated routes will reject all requests."
  );
}
