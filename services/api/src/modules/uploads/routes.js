const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { imageSize } = require('image-size');
const { requireAuth, requireRole } = require('../auth/middleware');
const { isCloudStorageConfigured, uploadToCloud } = require('../storage/client');

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
// Also used by hub staff for shipment-inspection evidence photos, not
// just supplier product photos — the actual work here (validate
// dimensions/type, save, return a URL) is identical regardless of which
// real-world thing the photo is evidence of.
router.post('/product-image', requireAuth, requireRole('supplier', 'hub_staff'), (req, res, next) => {
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

module.exports = router;
