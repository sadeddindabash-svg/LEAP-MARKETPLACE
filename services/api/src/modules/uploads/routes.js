const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { imageSize } = require('image-size');
const { getVideoDurationInSeconds } = require('get-video-duration');
const { requireAuth, requireRole } = require('../auth/middleware');
const { isCloudStorageConfigured, uploadToCloud } = require('../storage/client');
const db = require('../../../db/pool');

/**
 * Product image upload — SUP-011-ish ("mandatory 3 high-quality photos").
 *
 * REAL CLOUD STORAGE, confirmed generic (works with AWS S3, Cloudflare
 * R2, or DigitalOcean Spaces — all speak the same S3 API, see
 * services/api/src/modules/storage/client.js for the full real
 * implementation and the real discussion behind building this
 * generically rather than committing to one provider). When real cloud
 * credentials are configured, uploads go there and the real returned
 * URL is a real cloud URL. When they aren't, this HONESTLY falls back
 * to the original local-disk behavior — local disk already worked
 * before this pass, so an unconfigured cloud setup doesn't break real
 * uploads, it just means they're not yet durable/scalable the way real
 * cloud storage would make them.
 *
 * "High-quality" is enforced as a real, checkable rule (minimum pixel
 * dimensions), not just accepted on faith — see MIN_DIMENSION_PX below.
 */
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_DIMENSION_PX = 800; // shortest side must be at least this many pixels
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(), // buffer in memory first so we can validate dimensions before writing to disk
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
    cb(null, true);
  },
});

// POST /uploads/product-image  (multipart/form-data, field name "image")
// Also used by hub staff for shipment-inspection evidence photos, by
// buyers for real review photos (migration 031), and by admins for
// real vehicle-brand and product-category photos (migration 046) --
// not just supplier product photos. The actual work here (validate
// dimensions/type, save, return a URL) is identical regardless of
// which real-world thing the photo is evidence of.
router.post('/product-image', requireAuth, requireRole('supplier', 'hub_staff', 'buyer', 'admin'), (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image file provided (expected field name "image")' });

    let dimensions;
    try {
      dimensions = imageSize(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Could not read image dimensions — file may be corrupt or not a real image' });
    }

    const shortestSide = Math.min(dimensions.width, dimensions.height);
    if (shortestSide < MIN_DIMENSION_PX) {
      return res.status(400).json({
        error: `Image resolution too low (${dimensions.width}x${dimensions.height}). Shortest side must be at least ${MIN_DIMENSION_PX}px.`,
      });
    }

    const ext = req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;

    if (isCloudStorageConfigured()) {
      try {
        const url = await uploadToCloud(req.file.buffer, filename, req.file.mimetype);
        return res.status(201).json({ url, width: dimensions.width, height: dimensions.height, storage: 'cloud' });
      } catch (cloudErr) {
        // Real cloud upload failure (bad credentials, bucket doesn't
        // exist, network issue) -- honestly fall back to local disk
        // rather than losing the upload entirely.
        console.error('Cloud storage upload failed, falling back to local disk:', cloudErr.message);
      }
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    res.status(201).json({ url: `/uploads/${filename}`, width: dimensions.width, height: dimensions.height, storage: 'local' });
  });
});

// ---------------- Video upload ----------------
// Confirmed with the person: exactly one product video, max 8 seconds
// by default but admin-configurable (see product_requirements,
// migration 071) -- this endpoint is the real, authoritative check
// (a client-side check also happens in the browser first, for fast
// feedback before a slow upload even starts, but that check alone
// could be bypassed, so this server-side check is the one that
// actually can't be).

const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB -- generous for an 8s mobile clip
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported video type: ${file.mimetype}. Allowed: ${ALLOWED_VIDEO_MIME_TYPES.join(', ')}`));
    }
    cb(null, true);
  },
});

// POST /uploads/product-video  (multipart/form-data, field name "video")
router.post('/product-video', requireAuth, requireRole('supplier', 'admin'), (req, res, next) => {
  videoUpload.single('video')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No video file provided (expected field name "video")' });

    // getVideoDurationInSeconds needs a real local file path (or
    // stream/URL), not a raw in-memory buffer -- confirmed directly
    // from its own README before using it, not guessed. Written to a
    // real temp file, always cleaned up afterward regardless of
    // whether validation passes or fails.
    const ext = req.file.mimetype === 'video/webm' ? '.webm' : req.file.mimetype === 'video/quicktime' ? '.mov' : '.mp4';
    const tempPath = path.join(os.tmpdir(), `${crypto.randomBytes(16).toString('hex')}${ext}`);
    fs.writeFileSync(tempPath, req.file.buffer);

    let durationSeconds;
    try {
      const { rows } = await db.query('SELECT max_video_duration_seconds FROM product_requirements WHERE id = 1');
      const maxDuration = rows[0]?.max_video_duration_seconds ?? 8;

      durationSeconds = await getVideoDurationInSeconds(tempPath);
      if (durationSeconds > maxDuration) {
        return res.status(400).json({
          error: `Video is too long (${durationSeconds.toFixed(1)}s). Must be ${maxDuration} seconds or less.`,
        });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Could not read video duration — file may be corrupt or not a real video' });
    } finally {
      fs.unlinkSync(tempPath);
    }

    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;

    if (isCloudStorageConfigured()) {
      try {
        const url = await uploadToCloud(req.file.buffer, filename, req.file.mimetype);
        return res.status(201).json({ url, durationSeconds, storage: 'cloud' });
      } catch (cloudErr) {
        console.error('Cloud storage upload failed, falling back to local disk:', cloudErr.message);
      }
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    res.status(201).json({ url: `/uploads/${filename}`, durationSeconds, storage: 'local' });
  });
});

module.exports = router;
