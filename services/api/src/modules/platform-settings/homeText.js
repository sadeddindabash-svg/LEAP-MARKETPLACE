// The editable texts of the storefront's home page: the message in the top bar, the headline ("Find the right part for your car") and the sub-headline ("Real parts from verified suppliers..."),
// each in English and Arabic; the headline and the sub-headline also have a FONT and a SIZE. One JSON value in the generic platform_settings store (like the announcements and the home pictures).
// A text that is empty means "use the website's own wording", so nothing is lost if the admin clears it. Anyone may READ them (the website needs them); only an admin may change them.
const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');

const SETTING_KEY = 'storefront_home_text';
const FONTS = ['default', 'inter', 'poppins', 'montserrat', 'cairo', 'tajawal'];
const SIZES = ['small', 'medium', 'large', 'xlarge'];
const DEFAULT_SIZE = { headline: 'large', subheadline: 'medium' };       // what the website uses today
const MAX_LENGTH = { topBar: 160, headline: 120, subheadline: 240 };
const router = express.Router();

const cleanText = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
function block(name, raw, withStyle) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const out = { en: cleanText(b.en), ar: cleanText(b.ar) };
  if (withStyle) { out.font = FONTS.includes(b.font) ? b.font : 'default'; out.size = SIZES.includes(b.size) ? b.size : DEFAULT_SIZE[name]; }
  return out;
}
/** What is stored, read safely: always { topBar, headline, subheadline } with every field present (a missing or damaged value means "all defaults"). */
function normalize(raw) {
  let stored = {};
  try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; if (v && typeof v === 'object' && !Array.isArray(v)) stored = v; } catch { /* all defaults */ }
  return { topBar: block('topBar', stored.topBar, false), headline: block('headline', stored.headline, true), subheadline: block('subheadline', stored.subheadline, true) };
}
/** Checks what an admin sent; returns { error } or { value }. A wrong font or size is refused (never silently changed), a text that is too long is refused. */
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected an object with topBar, headline and subheadline' };
  for (const name of ['topBar', 'headline', 'subheadline']) {
    const b = body[name];
    if (b === undefined || b === null) continue;
    if (typeof b !== 'object' || Array.isArray(b)) return { error: `${name} must be an object` };
    for (const lang of ['en', 'ar']) {
      if (b[lang] !== undefined && b[lang] !== null && typeof b[lang] !== 'string') return { error: `${name}.${lang} must be text` };
      if (typeof b[lang] === 'string' && b[lang].trim().length > MAX_LENGTH[name]) return { error: `${name}.${lang} is too long (at most ${MAX_LENGTH[name]} characters)` };
    }
    if (name !== 'topBar') {
      if (b.font !== undefined && !FONTS.includes(b.font)) return { error: `${name}.font must be one of: ${FONTS.join(', ')}` };
      if (b.size !== undefined && !SIZES.includes(b.size)) return { error: `${name}.size must be one of: ${SIZES.join(', ')}` };
    }
  }
  return { value: normalize(body) };
}

// GET /platform-settings/home-text  ->  { text: { topBar, headline, subheadline } }      (public)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY]);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ text: normalize(rows.length ? rows[0].value : null), fonts: FONTS, sizes: SIZES });
  } catch (err) { next(err); }
});

// PUT /platform-settings/home-text  (JSON)  ->  { text }      (admin; replaces all three blocks at once, so "Reset to default" is simply an empty block)
router.put('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const checked = validate(req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [SETTING_KEY, JSON.stringify(checked.value)]);
    await logAdminAction(req, 'home_text_changed', 'platform_setting', SETTING_KEY, { text: checked.value });
    res.json({ text: checked.value });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.FONTS = FONTS;
module.exports.SIZES = SIZES;
module.exports.normalize = normalize;
module.exports.validate = validate;
