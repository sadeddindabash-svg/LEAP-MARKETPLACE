const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { imageSize } = require('image-size');
const { requireAuth, requireRole } = require('../auth/middleware');

/**
 * Product image upload — SUP-011-ish ("mandatory 3 high-quality photos").
 *
 * HONEST LIMITATION, not hidden: this stores uploaded files on the
 * backend server's own local disk (services/api/uploads/), served
 * statically at /uploads/... (see index.js). That is a REAL, WORKING
 * upload — not a stub — but production would want real object storage
 * (S3, Cloudinary, etc.) instead: local disk doesn't survive a server
 * redeploy, doesn't scale across multiple server instances, and has no
 * CDN in front of it. Swapping the storage backend later only touches
 * this one file — the upload contract (POST -> { url }) stays the same.
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
router.post('/product-image', requireAuth, requireRole('supplier'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
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
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

    res.status(201).json({ url: `/uploads/${filename}`, width: dimensions.width, height: dimensions.height });
  });
});

module.exports = router;
