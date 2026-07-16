const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Real, generic S3-compatible cloud storage (confirmed choice: build
 * generically rather than commit to one provider yet). AWS S3,
 * Cloudflare R2, and DigitalOcean Spaces all speak the exact same S3
 * API — this is ONE real implementation that works with whichever the
 * person picks later, purely by setting different environment
 * variables. No code change needed when that decision is made.
 *
 * Real environment variables (all required together for cloud storage
 * to activate):
 *   S3_ENDPOINT          - e.g. https://<account_id>.r2.cloudflarestorage.com (R2),
 *                           https://<region>.digitaloceanspaces.com (DO Spaces),
 *                           or omit entirely for real AWS S3 (uses AWS's own default endpoint)
 *   S3_BUCKET            - the real bucket/space name
 *   S3_ACCESS_KEY_ID     - real access key
 *   S3_SECRET_ACCESS_KEY - real secret key
 *   S3_REGION            - defaults to 'auto' (correct for R2; AWS/DO should set their real region)
 *   S3_PUBLIC_URL_BASE   - the real base URL to construct public-facing
 *                           image URLs (varies by provider/CDN setup,
 *                           e.g. a real R2 public bucket URL or a real
 *                           CloudFront/CDN domain in front of S3)
 *
 * HONEST FALLBACK, unlike the payment gateways or translation service:
 * local disk storage already works today for this project, so if cloud
 * credentials aren't configured, the caller (uploads/routes.js) falls
 * back to the EXISTING local-disk behavior rather than breaking photo
 * uploads entirely — cloud storage is additive, not a replacement that
 * breaks things when unconfigured.
 */

function isCloudStorageConfigured() {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_PUBLIC_URL_BASE
  );
}

let cachedClient = null;
function getClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined, // undefined = real AWS S3's own default endpoint resolution
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
}

/**
 * Uploads a real file buffer to whichever real S3-compatible bucket is
 * configured. Returns the real, final public URL to store and serve —
 * never a fabricated one; if this throws, the caller should fall back
 * to local disk rather than silently returning a broken URL.
 */
async function uploadToCloud(buffer, key, contentType) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  const base = process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, '');
  return `${base}/${key}`;
}

module.exports = { isCloudStorageConfigured, uploadToCloud };
