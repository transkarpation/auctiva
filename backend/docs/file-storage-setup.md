# File storage: S3 + CloudFront signed URLs

This feature lets a signed-in user upload a file through the API and stores it
in a **private** S3 bucket. At upload time the backend mints a **CloudFront
signed URL** (7-day expiry), persists it on the file record, and returns it in
the upload response so the client can read the file immediately. Direct S3
access is blocked; the signed URL stops working once it expires.

```
client ──POST /files (multipart)──▶ backend ──PutObject──▶ S3 (private, OAC)
                                            └─sign(7d)──▶ store + return { url, expiresAt }
client ──GET  <signed url>────────▶ CloudFront ──OAC──────▶ S3   (200 until expiry, 403 after)
```

## API

| Method & path        | Body / params                | Result                                            |
| -------------------- | ---------------------------- | ------------------------------------------------- |
| `POST /files`        | `multipart/form-data`, field `file` | `201 { id, key, originalName, contentType, size, url, expiresAt, createdAt }` |
| `GET /files`         | —                            | `200` array of the caller's files (each with its stored `url`/`expiresAt`) |
| `DELETE /files/:id`  | —                            | `204` (removes S3 object + metadata)              |

The `url` is a CloudFront signed URL valid until `expiresAt`
(`SIGNED_URL_TTL_SECONDS`, default 7 days). It is generated once and stored — no
separate "get URL" call is needed.

All routes require a Clerk session and are scoped to the caller. When the AWS
env vars are not fully set, every route returns `503`.

## AWS setup (one time)

### 1. S3 bucket (private)
- Create a bucket, e.g. `your-private-uploads-bucket`.
- **Block Public Access: ON** (all four settings). No bucket ACLs, no public
  policy. The app uploads with no ACL.

### 2. CloudFront key group (for signing)
- Generate a key pair locally:
  ```bash
  openssl genrsa -out cloudfront_private.pem 2048
  openssl rsa -pubout -in cloudfront_private.pem -out cloudfront_public.pem
  ```
- CloudFront → **Key management → Public keys → Create** → paste
  `cloudfront_public.pem`. Note the **public key ID** (e.g. `K2JCJMDEHXQW5F`).
- CloudFront → **Key management → Key groups → Create** → add that public key.

### 3. CloudFront distribution
- **Origin**: the S3 bucket, using **Origin Access Control (OAC)** (recommended
  over legacy OAI). Create an OAC and attach it to the origin.
- **Viewer protocol policy**: Redirect HTTP→HTTPS (or HTTPS only).
- **Require signed access** on the cache behavior. In the current console this is
  under the behavior's **Restrict viewer access** setting: choose **Yes**, set
  trusted signer type to **Trusted key groups**, and add the **key group** from
  step 2. (Older docs/console label this "Restrict viewer access: Yes"; the
  underlying control is the trusted key group on the behavior.) This forces
  every request to carry a valid signature.
- Deploy and note the distribution domain (e.g. `d111111abcdef8.cloudfront.net`).

### 4. Bucket policy for OAC
After creating the OAC, CloudFront shows a bucket policy to copy. It looks like:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-private-uploads-bucket/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>"
      }
    }
  }]
}
```
Only CloudFront (this distribution) can read the objects — no public principal.

### 5. IAM for the backend uploader
The backend needs `s3:PutObject` and `s3:DeleteObject` on
`arn:aws:s3:::your-private-uploads-bucket/*`. Use an IAM user's access keys
(`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) or, in AWS, an instance/task role
(leave both blank to use the default credential chain).

## Backend env

Set these in `backend/.env` (see `.env.example`):

| Var | Example | Notes |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | Bucket region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | Optional; default chain if blank |
| `S3_BUCKET` | `your-private-uploads-bucket` | Private bucket |
| `UPLOAD_MAX_BYTES` | `10485760` | Max upload (10 MiB) |
| `CLOUDFRONT_DOMAIN` | `d111111abcdef8.cloudfront.net` | No scheme |
| `CLOUDFRONT_KEY_PAIR_ID` | `K2JCJMDEHXQW5F` | Public key ID from step 2 |
| `CLOUDFRONT_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n…` | PEM, single line with `\n` escapes |
| `SIGNED_URL_TTL_SECONDS` | `604800` | Signed-URL lifetime (default 7 days) |

To put the PEM on one line:
```bash
awk 'NF {printf "%s\\n", $0}' cloudfront_private.pem
```
Copy that output as the value of `CLOUDFRONT_PRIVATE_KEY`.

## Verifying the acceptance criteria

```bash
TOKEN="<clerk session jwt>"
API=http://localhost:4000

# Upload — the response already contains the signed CloudFront URL:
curl -s -X POST "$API/files" -H "Authorization: Bearer $TOKEN" \
  -F "file=@./photo.png"
# → { "id": "...", "key": "uploads/<user>/<uuid>.png",
#     "url": "https://d111....cloudfront.net/uploads/...?Expires=...&Signature=...&Key-Pair-Id=...",
#     "expiresAt": "2026-06-21T...Z", ... }

# Direct S3 access is denied (object is private):
curl -I "https://your-private-uploads-bucket.s3.amazonaws.com/uploads/<user>/<uuid>.png"
# → HTTP/1.1 403 Forbidden

# The returned url works while valid:
curl -I "<url>"            # → HTTP/1.1 200 OK

# After it expires (SIGNED_URL_TTL_SECONDS, default 7 days), the same URL is rejected:
curl -I "<url>"            # → HTTP/1.1 403 Forbidden
```
