import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { env } from "../env.js";

export type SignedUrl = {
  url: string;
  // Absolute expiry as an ISO timestamp, for the client to display/cache.
  expiresAt: string;
};

// Produces a CloudFront signed URL for one object key, valid for
// SIGNED_URL_TTL_SECONDS. CloudFront enforces the embedded expiry: once it
// passes, CloudFront returns 403 (access denied) for that URL. The bucket
// itself is private (OAC), so this signed URL is the only way to read the file.
export function signObjectUrl(key: string): SignedUrl {
  const expiresMs = Date.now() + env.signedUrlTtlSeconds * 1000;
  // CloudFront serves over https; key has no leading slash, so add one.
  const resource = `https://${env.cloudfrontDomain}/${key}`;

  const url = getSignedUrl({
    url: resource,
    keyPairId: env.cloudfrontKeyPairId!,
    privateKey: env.cloudfrontPrivateKey!,
    dateLessThan: new Date(expiresMs).toISOString(),
  });

  return { url, expiresAt: new Date(expiresMs).toISOString() };
}
