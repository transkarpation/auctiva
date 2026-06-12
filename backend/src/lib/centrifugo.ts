import { createHmac } from "node:crypto";
import { env } from "../env.js";

// Base64url without padding, as required by JWT.
function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

type ConnectionTokenOptions = {
  // Seconds until the token expires. Centrifugo refreshes the connection
  // before this, so it can stay short. Defaults to one hour.
  ttlSeconds?: number;
  // Optional extra data Centrifugo attaches to the connection (visible to the
  // server and, depending on config, to other clients in presence).
  info?: Record<string, unknown>;
};

// Mints a Centrifugo connection JWT (HS256) for a user. `sub` is the user
// identity Centrifugo uses for the connection; it must be signed with the same
// secret Centrifugo verifies against (CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY).
//
// Signed manually with crypto to avoid pulling in a JWT dependency for a single
// well-defined claim set.
export function createConnectionToken(
  userId: string,
  { ttlSeconds = 60 * 60, info }: ConnectionTokenOptions = {}
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: Record<string, unknown> = {
    sub: userId,
    iat: now,
    exp: now + ttlSeconds,
  };
  if (info) payload.info = info;

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;
  const signature = base64url(
    createHmac("sha256", env.centrifugoTokenSecret).update(signingInput).digest()
  );

  return `${signingInput}.${signature}`;
}

// A user's personal channel. The "#" boundary makes it user-limited in
// Centrifugo: only the user whose id follows "#" may subscribe (configured via
// the "personal" namespace with allow_user_limited_channels in docker-compose).
export function personalChannelFor(userId: string): string {
  return `personal:#${userId}`;
}

// Publishes a message into a channel via the Centrifugo HTTP API. Server-side
// publishing bypasses channel permissions — it's authorized by the API key.
export async function publish(
  channel: string,
  data: unknown
): Promise<void> {
  const res = await fetch(`${env.centrifugoApiUrl}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.centrifugoApiKey,
    },
    body: JSON.stringify({ channel, data }),
  });

  if (!res.ok) {
    throw new Error(`Centrifugo publish failed: HTTP ${res.status}`);
  }
  // Centrifugo returns 200 with an { error } body on logical failures.
  const body = (await res.json()) as { error?: { message?: string } };
  if (body.error) {
    throw new Error(`Centrifugo publish error: ${body.error.message}`);
  }
}

// Convenience: publish a message to a specific user's personal channel.
export function publishToUser(userId: string, data: unknown): Promise<void> {
  return publish(personalChannelFor(userId), data);
}
