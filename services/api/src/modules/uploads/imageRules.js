// Shared by the vehicle and category screens' photo door (POST /fitment/catalog-image) and by the Excel import: what makes a picture acceptable, and where it is kept.
//
// IMPORTANT: this does NOT change the rule for any other photo. Product, hub and review photos still go through POST /uploads/product-image with its 800 px minimum
// (uploads/routes.js, untouched). Only vehicle photos (brand, year, version) and category photos use the lower minimum below.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const { isCloudStorageConfigured, uploadToCloud } = require('../storage/client');

const MIN_CATALOG_DIMENSION_PX = 400;           // shortest side, for vehicle and category photos
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;   // 10 MB, as for every other photo
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** What the bytes REALLY are (not what a file name or an upload header claims): 'image/png', 'image/jpeg', 'image/webp' or null. */
function sniffMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** A picture cut off half way (a broken upload) still has a readable header, so also check that it ENDS properly: a PNG with its closing chunk, a JPEG with its end marker. */
function looksComplete(buffer, mime) {
  if (mime === 'image/png') return buffer.length >= 20 && buffer.subarray(buffer.length - 12).equals(Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]));
  if (mime === 'image/jpeg') {
    const tail = buffer.subarray(Math.max(0, buffer.length - 64));
    for (let i = 0; i < tail.length - 1; i++) if (tail[i] === 0xff && tail[i + 1] === 0xd9) return true;
    return false;
  }
  return true;                                                                  // WebP: its size field is checked by the image reader
}

/** Checks a picture: a real PNG/JPEG/WebP, not over 10 MB, shortest side at least `minPx`. Returns { ok: true, width, height, mime } or { ok: false, error }. */
function inspectImage(buffer, minPx = MIN_CATALOG_DIMENSION_PX) {
  const mime = sniffMime(buffer);
  if (!mime) return { ok: false, error: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
  if (buffer.length > MAX_FILE_SIZE_BYTES) return { ok: false, error: 'The picture is larger than 10 MB' };
  if (!looksComplete(buffer, mime)) return { ok: false, error: 'The picture file looks damaged or incomplete. Please choose it again' };
  let size;
  try { size = imageSize(buffer); } catch { return { ok: false, error: 'Could not read image dimensions — file may be corrupt or not a real image' }; }
  if (Math.min(size.width, size.height) < minPx) return { ok: false, error: `Image resolution too low (${size.width}x${size.height}). Shortest side must be at least ${minPx}px.` };
  return { ok: true, width: size.width, height: size.height, mime };
}

/** Keeps a picture (cloud storage when configured, else the local uploads folder, exactly as product photos are) and returns { url, storage }. */
async function saveImage(buffer, mime) {
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  if (isCloudStorageConfigured()) {
    try {
      return { url: await uploadToCloud(buffer, filename, mime), storage: 'cloud' };
    } catch (err) {
      console.error('Cloud storage upload failed, falling back to local disk:', err.message);
    }
  }
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { url: `/uploads/${filename}`, storage: 'local' };
}

/** Best effort: removes a picture that was kept locally (used when an import fails half way). Cloud pictures are left (reported, not guessed at). */
function removeLocalImage(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return false;
  try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(url))); return true; } catch { return false; }
}

module.exports = { MIN_CATALOG_DIMENSION_PX, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, sniffMime, inspectImage, saveImage, removeLocalImage };
