// The photo of each loyalty tier (migration 125), shown instead of the tier's icon on the website when there is one. Only an admin may change it; anyone
// reads it with the tiers (GET /pricing/loyalty-tiers and /loyalty/me send photoUrl). Same rules as the home page pictures: EXACTLY 600 x 600 px (the admin
// screen crops and resizes it so), a real JPEG/PNG/WebP, not over 10 MB.
const express = require('express');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, inspectImage, saveImage, removeLocalImage } = require('../uploads/imageRules');

const PICTURE_PX = 600;
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => (ALLOWED_MIME_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))),
});

async function tierById(id) {
  const { rows } = await db.query('SELECT id, name, photo_url FROM loyalty_tiers WHERE id::text = $1', [String(id)]);
  return rows[0] || null;
}

// PUT /loyalty-tier-photos/:id  (multipart/form-data, field "image")  ->  { id, photoUrl }      (admin)
router.put('/:id', requireAuth, requireRole('admin'), (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The picture is larger than 10 MB' : err.message });
    if (!req.file) return res.status(400).json({ error: 'No picture provided (expected field name "image")' });
    try {
      const tier = await tierById(req.params.id);
      if (!tier) return res.status(404).json({ error: 'Tier not found.' });
      const checked = inspectImage(req.file.buffer, PICTURE_PX);
      if (!checked.ok) return res.status(400).json({ error: checked.error });
      if (checked.width !== PICTURE_PX || checked.height !== PICTURE_PX) return res.status(400).json({ error: `The picture must be exactly ${PICTURE_PX} x ${PICTURE_PX} px (it is ${checked.width} x ${checked.height}).` });
      const saved = await saveImage(req.file.buffer, checked.mime);
      await db.query('UPDATE loyalty_tiers SET photo_url = $1 WHERE id = $2', [saved.url, tier.id]);
      if (tier.photo_url && tier.photo_url !== saved.url) removeLocalImage(tier.photo_url);
      await logAdminAction(req, 'loyalty_tier_photo_changed', 'loyalty_tier', String(tier.id), { name: tier.name, url: saved.url });
      res.json({ id: tier.id, photoUrl: saved.url });
    } catch (e) { next(e); }
  });
});

// DELETE /loyalty-tier-photos/:id  ->  { id, photoUrl: null }      (admin; the website goes back to the tier's icon)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const tier = await tierById(req.params.id);
    if (!tier) return res.status(404).json({ error: 'Tier not found.' });
    await db.query('UPDATE loyalty_tiers SET photo_url = NULL WHERE id = $1', [tier.id]);
    if (tier.photo_url) removeLocalImage(tier.photo_url);
    await logAdminAction(req, 'loyalty_tier_photo_removed', 'loyalty_tier', String(tier.id), { name: tier.name, url: tier.photo_url });
    res.json({ id: tier.id, photoUrl: null });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.PICTURE_PX = PICTURE_PX;
