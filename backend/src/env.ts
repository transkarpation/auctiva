import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex address");
const ethPrivateKey = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 64-hex private key");

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

  // App-owned wallet (optional; validated when present).
  INTERNAL_WALLET_ADDRESS: ethAddress.optional(),
  INTERNAL_WALLET_PRIVATE: ethPrivateKey.optional(),

  // Base Sepolia RPC endpoints (optional; validated as URLs when present).
  BASE_SEPOLIA_HTTP: z.url().optional(),
  BASE_SEPOLIA_WSS: z.url().optional(),

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
  baseSepoliaHttp: e.BASE_SEPOLIA_HTTP,
  baseSepoliaWss: e.BASE_SEPOLIA_WSS,
  redisUrl: e.REDIS_URL,
  centrifugoTokenSecret: e.CENTRIFUGO_TOKEN_HMAC_SECRET,
  centrifugoApiUrl: e.CENTRIFUGO_API_URL,
  centrifugoApiKey: e.CENTRIFUGO_API_KEY,
} as const;

if (!env.clerkSecretKey) {
  console.warn(
    "Warning: CLERK_SECRET_KEY is not set — authenticated routes will reject all requests."
  );
}
