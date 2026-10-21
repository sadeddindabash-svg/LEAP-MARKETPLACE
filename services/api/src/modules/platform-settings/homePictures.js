// The four pictures beside "Parts", "Brands", "Models" and "Countries" on the storefront's home page. One JSON value in the generic platform_settings store (like the announcements):
//   { "parts": "/uploads/..jpg" | null, "brands": ..., "models": ..., "countries": ... }
// Anyone may READ them (the website needs them); only an admin may change them. A picture must be EXACTLY 600 x 600 px (the admin screen crops and resizes it so), a real JPEG/PNG/WebP, not over 10 MB.
const express = require('express');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, inspectImage, saveImage, removeLocalImage } = require('../uploads/imageRules');

const SLOTS = ['parts', 'brands', 'models', 'countries'];
const SETTING_KEY = 'storefront_home_pictures';
const PICTURE_PX = 600;
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => (ALLOWED_MIME_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))),
});

/** What is stored, as { parts, brands, models, countries } (a missing or damaged value means "no pictures": the website then shows its icons). */
function parseStored(raw) {
  let stored = {};
  try { const v = JSON.parse(raw); if (v && typeof v === 'object' && !Array.isArray(v)) stored = v; } catch { /* no pictures */ }
  const out = {};
  for (const slot of SLOTS) out[slot] = typeof stored[slot] === 'string' && stored[slot].trim() !== '' ? stored[slot] : null;
  return out;
}
async function readPictures() {
  const { rows } = await db.query('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY]);
  return parseStored(rows.length ? rows[0].value : null);
}
/** Sets one slot (a url, or null to clear it) without touching the others. The row is locked while it is changed, so two admins changing different slots at the same moment cannot overwrite
 *  each other, and a damaged stored value is simply replaced by a good one (never an error). */
async function writeSlot(slot, url) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, '{}', now()) ON CONFLICT (key) DO NOTHING", [SETTING_KEY]);
    const { rows } = await client.query('SELECT value FROM platform_settings WHERE key = $1 FOR UPDATE', [SETTING_KEY]);
    const merged = { ...parseStored(rows[0].value), [slot]: url };
    await client.query('UPDATE platform_settings SET value = $2, updated_at = now() WHERE key = $1', [SETTING_KEY, JSON.stringify(merged)]);
    await client.query('COMMIT');
    return merged;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
const knownSlot = (req, res, next) => (SLOTS.includes(req.params.slot) ? next() : res.status(404).json({ error: `Unknown picture "${req.params.slot}". Expected one of: ${SLOTS.join(', ')}` }));

// GET /platform-settings/home-pictures  ->  { pictures: { parts, brands, models, countries }, size: 600 }      (public)
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ pictures: await readPictures(), size: PICTURE_PX });
  } catch (err) { next(err); }
});

// PUT /platform-settings/home-pictures/:slot  (multipart/form-data, field "image")  ->  { slot, url, pictures }      (admin)
router.put('/:slot', requireAuth, requireRole('admin'), knownSlot, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The picture is larger than 10 MB' : err.message });
    if (!req.file) return res.status(400).json({ error: 'No picture provided (expected field name "image")' });
    try {
      const checked = inspectImage(req.file.buffer, PICTURE_PX);
      if (!checked.ok) return res.status(400).json({ error: checked.error });
      if (checked.width !== PICTURE_PX || checked.height !== PICTURE_PX) return res.status(400).json({ error: `The picture must be exactly ${PICTURE_PX} x ${PICTURE_PX} px (it is ${checked.width} x ${checked.height}). The admin screen crops and resizes it for you.` });
      const before = (await readPictures())[req.params.slot];
      const saved = await saveImage(req.file.buffer, checked.mime);
      const pictures = await writeSlot(req.params.slot, saved.url);
      if (before && before !== saved.url) removeLocalImage(before);
      await logAdminAction(req, 'home_picture_changed', 'platform_setting', SETTING_KEY, { slot: req.params.slot, url: saved.url });
      res.json({ slot: req.params.slot, url: saved.url, pictures });
    } catch (e) { next(e); }
  });
});

// DELETE /platform-settings/home-pictures/:slot  ->  { slot, url: null, pictures }      (admin; the website goes back to its icon)
router.delete('/:slot', requireAuth, requireRole('admin'), knownSlot, async (req, res, next) => {
  try {
    const before = (await readPictures())[req.params.slot];
    const pictures = await writeSlot(req.params.slot, null);
    if (before) removeLocalImage(before);
    await logAdminAction(req, 'home_picture_removed', 'platform_setting', SETTING_KEY, { slot: req.params.slot, url: before });
    res.json({ slot: req.params.slot, url: null, pictures });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.SLOTS = SLOTS;
module.exports.PICTURE_PX = PICTURE_PX;
module.exports.parseStored = parseStored;
