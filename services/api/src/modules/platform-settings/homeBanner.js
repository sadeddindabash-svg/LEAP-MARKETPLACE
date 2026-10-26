// The home page banner. Beside the "Find parts for your car" box the home page shows EITHER the headline and sub-headline OR this banner: up to 10 advertisement slides, each with an ENGLISH photo and an ARABIC photo
// (the website and the app show the one for their language, and the other when one is missing), its own number of seconds on screen, and an optional link (to a part, to a category or to a web page).
// One JSON value in the generic platform_settings store (like the home texts and pictures):
//   { "mode": "headline" | "banner", "slides": [ { "id", "imageEn", "imageAr", "altEn", "altAr", "link": { "type": "none"|"part"|"category"|"url", "value" }, "seconds" } ] }
// Anyone may READ it (the website and the app need it): only slides that have a photo, and "banner" only when there is at least one such slide (otherwise the headline is shown, never an empty space).
// Only an admin may change it. A photo must be EXACTLY 1250 x 500 px (the admin screen crops and resizes it so), a real JPEG/PNG/WebP, not over 10 MB. Every change is its own small, locked step (two admins cannot overwrite each other).
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, inspectImage, saveImage, removeLocalImage } = require('../uploads/imageRules');

const SETTING_KEY = 'storefront_home_banner';
const MODES = ['headline', 'banner'];
const LINK_TYPES = ['none', 'part', 'category', 'url'];
const LANGS = ['en', 'ar'];
const MAX_SLIDES = 10; const MIN_SECONDS = 2; const MAX_SECONDS = 30; const DEFAULT_SECONDS = 5;
const WIDTH_PX = 1250; const HEIGHT_PX = 500;
const MAX_ALT = 140; const MAX_URL = 500; const MAX_ID = 100;
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => (ALLOWED_MIME_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))),
});
class Refusal extends Error { constructor(status, message) { super(message); this.status = status; } }

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanImage = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const cleanSeconds = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n)) : DEFAULT_SECONDS; };
/** A stored link as { type, value }; anything damaged or unsafe (not http/https, too long) becomes "no link". */
function cleanLink(link) {
  const none = { type: 'none', value: '' };
  if (!link || typeof link !== 'object') return none;
  const value = typeof link.value === 'string' ? link.value.trim() : '';
  if (link.type === 'part' || link.type === 'category') return value && value.length <= MAX_ID ? { type: link.type, value } : none;
  if (link.type === 'url') { try { const u = new URL(value); return (u.protocol === 'https:' || u.protocol === 'http:') && value.length <= MAX_URL ? { type: 'url', value } : none; } catch { return none; } }
  return none;
}
/** What is stored, as { mode, slides } (a missing or damaged value means "headline, no slides", never an error). */
function parseStored(raw) {
  let stored = {};
  try { const v = JSON.parse(raw); if (v && typeof v === 'object' && !Array.isArray(v)) stored = v; } catch { /* nothing stored */ }
  const slides = (Array.isArray(stored.slides) ? stored.slides : []).filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '').slice(0, MAX_SLIDES).map((s) => ({
    id: s.id, imageEn: cleanImage(s.imageEn), imageAr: cleanImage(s.imageAr), altEn: cleanText(s.altEn, MAX_ALT), altAr: cleanText(s.altAr, MAX_ALT), link: cleanLink(s.link), seconds: cleanSeconds(s.seconds),
  }));
  return { mode: MODES.includes(stored.mode) ? stored.mode : 'headline', slides };
}
async function read() {
  const { rows } = await db.query('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY]);
  return parseStored(rows.length ? rows[0].value : null);
}
/** One locked change: `change(state)` returns the new state (or throws a Refusal). The row is locked meanwhile, so two admins changing different things at the same moment cannot overwrite each other. */
async function mutate(change) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, '{}', now()) ON CONFLICT (key) DO NOTHING", [SETTING_KEY]);
    const { rows } = await client.query('SELECT value FROM platform_settings WHERE key = $1 FOR UPDATE', [SETTING_KEY]);
    const before = parseStored(rows[0].value);
    const result = await change(before, client);
    await client.query('UPDATE platform_settings SET value = $2, updated_at = now() WHERE key = $1', [SETTING_KEY, JSON.stringify(result.state)]);
    await client.query('COMMIT');
    return { before, ...result };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
/** A link from a request, checked: a part and a category must really exist; a web page must be a full http(s) address. Throws a Refusal the admin can act on. */
async function checkedLink(link, q) {
  if (link === undefined || link === null) return { type: 'none', value: '' };
  if (typeof link !== 'object' || Array.isArray(link) || !LINK_TYPES.includes(link.type)) throw new Refusal(400, `The link must be one of: ${LINK_TYPES.join(', ')}`);
  if (link.type === 'none') return { type: 'none', value: '' };
  const value = typeof link.value === 'string' ? link.value.trim() : '';
  if (!value) throw new Refusal(400, 'Choose where the link goes');
  if (link.type === 'part') {
    if (value.length > MAX_ID || (await q.query('SELECT 1 FROM products WHERE id = $1', [value])).rowCount === 0) throw new Refusal(400, 'That part was not found');
    return { type: 'part', value };
  }
  if (link.type === 'category') {
    if (value.length > MAX_ID || (await q.query('SELECT 1 FROM product_categories WHERE id = $1', [value])).rowCount === 0) throw new Refusal(400, 'That category was not found');
    return { type: 'category', value };
  }
  let u; try { u = new URL(value); } catch { throw new Refusal(400, 'The web page address must be complete, for example https://example.com/sale'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Refusal(400, 'The web page address must start with https:// or http://');
  if (value.length > MAX_URL) throw new Refusal(400, `The web page address is too long (at most ${MAX_URL} characters)`);
  return { type: 'url', value };
}
const checkedSeconds = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < MIN_SECONDS || n > MAX_SECONDS) throw new Refusal(400, `Seconds must be a whole number from ${MIN_SECONDS} to ${MAX_SECONDS}`); return n; };
const checkedAlt = (v, what) => { if (typeof v !== 'string') throw new Refusal(400, `${what} must be text`); if (v.trim().length > MAX_ALT) throw new Refusal(400, `${what} is too long (at most ${MAX_ALT} characters)`); return v.trim(); };
const fail = (res, err, next) => (err instanceof Refusal ? res.status(err.status).json({ error: err.message }) : next(err));
const admin = [requireAuth, requireRole('admin')];
const limits = { maxSlides: MAX_SLIDES, minSeconds: MIN_SECONDS, maxSeconds: MAX_SECONDS, defaultSeconds: DEFAULT_SECONDS, width: WIDTH_PX, height: HEIGHT_PX, maxAlt: MAX_ALT };
const urlsOf = (s) => [s.imageEn, s.imageAr].filter(Boolean);

// GET /platform-settings/home-banner  ->  { mode: "headline"|"banner", slides: [...], width, height }      (public: only slides with a photo; "banner" only when there is one)
router.get('/', async (req, res, next) => {
  try {
    const { mode, slides } = await read();
    const shown = slides.filter((s) => s.imageEn || s.imageAr);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ mode: mode === 'banner' && shown.length > 0 ? 'banner' : 'headline', slides: shown, width: WIDTH_PX, height: HEIGHT_PX });
  } catch (err) { next(err); }
});
// GET /platform-settings/home-banner/admin  ->  { mode, slides (all of them), limits }      (admin: what is really stored)
router.get('/admin', ...admin, async (req, res, next) => { try { res.json({ ...(await read()), limits }); } catch (err) { next(err); } });

// PUT /platform-settings/home-banner/mode  { mode }      (admin)
router.put('/mode', ...admin, async (req, res, next) => {
  try {
    const mode = req.body && req.body.mode; if (!MODES.includes(mode)) throw new Refusal(400, `The mode must be one of: ${MODES.join(', ')}`);
    const r = await mutate((state) => ({ state: { ...state, mode } }));
    await logAdminAction(req, 'home_banner_mode_changed', 'platform_setting', SETTING_KEY, { from: r.before.mode, to: mode });
    res.json({ ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});
// PUT /platform-settings/home-banner/order  { ids: [every slide id, in the new order] }      (admin)
router.put('/order', ...admin, async (req, res, next) => {
  try {
    const ids = req.body && req.body.ids;
    const r = await mutate((state) => {
      if (!Array.isArray(ids) || ids.length !== state.slides.length || new Set(ids).size !== ids.length || !ids.every((id) => state.slides.some((s) => s.id === id))) throw new Refusal(400, 'The order must list every slide exactly once');
      return { state: { ...state, slides: ids.map((id) => state.slides.find((s) => s.id === id)) } };
    });
    await logAdminAction(req, 'home_banner_reordered', 'platform_setting', SETTING_KEY, { ids });
    res.json({ ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});
// POST /platform-settings/home-banner/slides  { seconds?, link?, altEn?, altAr? }  ->  the new slide (it has no photo yet, so the website does not show it until it has one)      (admin)
router.post('/slides', ...admin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const r = await mutate(async (state, q) => {
      if (state.slides.length >= MAX_SLIDES) throw new Refusal(409, `The banner can have at most ${MAX_SLIDES} photos`);
      const slide = { id: crypto.randomUUID(), imageEn: null, imageAr: null, altEn: body.altEn === undefined ? '' : checkedAlt(body.altEn, 'The English description'), altAr: body.altAr === undefined ? '' : checkedAlt(body.altAr, 'The Arabic description'),
        link: await checkedLink(body.link, q), seconds: body.seconds === undefined ? DEFAULT_SECONDS : checkedSeconds(body.seconds) };
      return { state: { ...state, slides: [...state.slides, slide] }, slide };
    });
    await logAdminAction(req, 'home_banner_slide_added', 'platform_setting', SETTING_KEY, { slide: r.slide.id });
    res.status(201).json({ slide: r.slide, ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});
// PUT /platform-settings/home-banner/slides/:id  { seconds?, link?, altEn?, altAr? }  (only what is sent changes)      (admin)
router.put('/slides/:id', ...admin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const r = await mutate(async (state, q) => {
      const i = state.slides.findIndex((s) => s.id === req.params.id); if (i < 0) throw new Refusal(404, 'Slide not found');
      const s = { ...state.slides[i] };
      if (body.seconds !== undefined) s.seconds = checkedSeconds(body.seconds);
      if (body.link !== undefined) s.link = await checkedLink(body.link, q);
      if (body.altEn !== undefined) s.altEn = checkedAlt(body.altEn, 'The English description');
      if (body.altAr !== undefined) s.altAr = checkedAlt(body.altAr, 'The Arabic description');
      const slides = state.slides.slice(); slides[i] = s; return { state: { ...state, slides }, slide: s };
    });
    await logAdminAction(req, 'home_banner_slide_changed', 'platform_setting', SETTING_KEY, { slide: req.params.id, fields: Object.keys(body) });
    res.json({ slide: r.slide, ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});
// DELETE /platform-settings/home-banner/slides/:id  (its photos are deleted from the server too)      (admin)
router.delete('/slides/:id', ...admin, async (req, res, next) => {
  try {
    const r = await mutate((state) => {
      const gone = state.slides.find((s) => s.id === req.params.id); if (!gone) throw new Refusal(404, 'Slide not found');
      return { state: { ...state, slides: state.slides.filter((s) => s.id !== req.params.id) }, gone };
    });
    urlsOf(r.gone).forEach(removeLocalImage);
    await logAdminAction(req, 'home_banner_slide_removed', 'platform_setting', SETTING_KEY, { slide: req.params.id });
    res.json({ ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});
const knownLang = (req, res, next) => (LANGS.includes(req.params.lang) ? next() : res.status(404).json({ error: `Unknown language "${req.params.lang}". Expected one of: ${LANGS.join(', ')}` }));
const FIELD = { en: 'imageEn', ar: 'imageAr' };
// PUT /platform-settings/home-banner/slides/:id/image/:lang  (multipart, field "image", exactly 1250 x 500 px)  ->  { slide, ... }      (admin)
router.put('/slides/:id/image/:lang', ...admin, knownLang, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The picture is larger than 10 MB' : err.message });
    if (!req.file) return res.status(400).json({ error: 'No picture provided (expected field name "image")' });
    try {
      const checked = inspectImage(req.file.buffer, Math.min(WIDTH_PX, HEIGHT_PX));
      if (!checked.ok) return res.status(400).json({ error: checked.error });
      if (checked.width !== WIDTH_PX || checked.height !== HEIGHT_PX) return res.status(400).json({ error: `The picture must be exactly ${WIDTH_PX} x ${HEIGHT_PX} px (it is ${checked.width} x ${checked.height}). Crop it in the admin screen` });
      if (!(await read()).slides.some((s) => s.id === req.params.id)) return res.status(404).json({ error: 'Slide not found' });
      const saved = await saveImage(req.file.buffer, checked.mime);
      let r;
      try { r = await mutate((state) => { const i = state.slides.findIndex((s) => s.id === req.params.id); if (i < 0) throw new Refusal(404, 'Slide not found'); const slides = state.slides.slice(); slides[i] = { ...slides[i], [FIELD[req.params.lang]]: saved.url }; return { state: { ...state, slides }, slide: slides[i] }; }); }
      catch (e) { removeLocalImage(saved.url); throw e; }
      const old = r.before.slides.find((s) => s.id === req.params.id)[FIELD[req.params.lang]];
      if (old && old !== saved.url) removeLocalImage(old);
      await logAdminAction(req, 'home_banner_photo_changed', 'platform_setting', SETTING_KEY, { slide: req.params.id, lang: req.params.lang, url: saved.url });
      res.json({ slide: r.slide, ...r.state, limits });
    } catch (e) { fail(res, e, next); }
  });
});
// DELETE /platform-settings/home-banner/slides/:id/image/:lang  ->  { slide, ... }      (admin)
router.delete('/slides/:id/image/:lang', ...admin, knownLang, async (req, res, next) => {
  try {
    const r = await mutate((state) => { const i = state.slides.findIndex((s) => s.id === req.params.id); if (i < 0) throw new Refusal(404, 'Slide not found'); const slides = state.slides.slice(); slides[i] = { ...slides[i], [FIELD[req.params.lang]]: null }; return { state: { ...state, slides }, slide: slides[i] }; });
    const old = r.before.slides.find((s) => s.id === req.params.id)[FIELD[req.params.lang]]; if (old) removeLocalImage(old);
    await logAdminAction(req, 'home_banner_photo_removed', 'platform_setting', SETTING_KEY, { slide: req.params.id, lang: req.params.lang });
    res.json({ slide: r.slide, ...r.state, limits });
  } catch (err) { fail(res, err, next); }
});

module.exports = router;
module.exports.parseStored = parseStored;
module.exports.LIMITS = limits;
