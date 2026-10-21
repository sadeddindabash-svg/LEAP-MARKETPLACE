// The storefront's footer, edited in the admin portal (Settings):
//   text    the tagline, the copyright line, the four column titles and the wording / visibility of the six "Useful links"        (JSON in platform_settings: storefront_footer_text)
//   social  up to 8 social media icons: a name, a link and a square picture each                                                 (storefront_social_links)
//   pages   the six pages those links open INSIDE the storefront (About us, Terms, ...): a title and a text, English and Arabic   (storefront_legal_pages)
// Anyone may READ them (the website needs them); only an admin may change them. A text that is empty means "use the website's own wording".
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES, inspectImage, saveImage, removeLocalImage } = require('../uploads/imageRules');

const KEY_TEXT = 'storefront_footer_text';
const KEY_SOCIAL = 'storefront_social_links';
const KEY_PAGES = 'storefront_legal_pages';
/** The six pages: the key the admin and the website use, and the address it has on the storefront (the same as on the old website). */
const PAGES = { about: 'about-us', terms: 'terms-conditions', delivery: 'delivery-shipping-policy', refund: 'refund-policy', privacy: 'privacy-policy', cancellation: 'cancellation-replacement-policy' };
const PAGE_KEYS = Object.keys(PAGES);
const TITLE_KEYS = ['shop', 'account', 'help', 'useful'];
const MAX = { tagline: 160, copyright: 160, title: 40, linkLabel: 40, socialName: 40, socialUrl: 300, pageTitle: 120, pageBody: 60000 };
const MAX_SOCIAL = 8;
const ICON_PX = 256;
const router = express.Router();

const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const pair = (v) => ({ en: clean(v && v.en), ar: clean(v && v.ar) });
const parse = (raw, fallback) => { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return v && typeof v === 'object' ? v : fallback; } catch { return fallback; } };

// ---------- text ----------
function normalizeText(raw) {
  const s = parse(raw, {}); const titles = {}; const links = {};
  for (const k of TITLE_KEYS) titles[k] = pair(s.titles && s.titles[k]);
  for (const k of PAGE_KEYS) { const l = (s.links && s.links[k]) || {}; links[k] = { ...pair(l), shown: l.shown !== false }; }
  return { tagline: pair(s.tagline), copyright: pair(s.copyright), titles, links };
}
function validateText(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected an object with tagline, copyright, titles and links' };
  const check = (where, p, max) => {
    if (p === undefined || p === null) return null;
    if (typeof p !== 'object' || Array.isArray(p)) return `${where} must be an object`;
    for (const lang of ['en', 'ar']) {
      if (p[lang] !== undefined && p[lang] !== null && typeof p[lang] !== 'string') return `${where}.${lang} must be text`;
      if (typeof p[lang] === 'string' && p[lang].trim().length > max) return `${where}.${lang} is too long (at most ${max} characters)`;
    }
    return null;
  };
  let err = check('tagline', body.tagline, MAX.tagline) || check('copyright', body.copyright, MAX.copyright);
  for (const k of TITLE_KEYS) err = err || check(`titles.${k}`, body.titles && body.titles[k], MAX.title);
  for (const k of PAGE_KEYS) {
    const l = body.links && body.links[k]; err = err || check(`links.${k}`, l, MAX.linkLabel);
    if (!err && l && l.shown !== undefined && typeof l.shown !== 'boolean') err = `links.${k}.shown must be true or false`;
  }
  return err ? { error: err } : { value: normalizeText(body) };
}

// ---------- social ----------
const normalizeSocial = (raw) => { const list = parse(raw, []); return (Array.isArray(list) ? list : []).filter((i) => i && typeof i.id === 'string' && clean(i.name)).slice(0, MAX_SOCIAL).map((i) => ({ id: i.id, name: clean(i.name), url: clean(i.url), icon: clean(i.icon) })); };
const isWebAddress = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; } };
function validateSocial(body) {
  const items = body && body.items;
  if (!Array.isArray(items)) return { error: 'Expected { items: [ { id?, name, url } ] }' };
  if (items.length > MAX_SOCIAL) return { error: `At most ${MAX_SOCIAL} social media icons` };
  for (const [i, it] of items.entries()) {
    if (!it || typeof it !== 'object') return { error: `items[${i}] must be an object` };
    if (!clean(it.name)) return { error: `items[${i}].name is required (it is what a screen reader says)` };
    if (it.name.trim().length > MAX.socialName) return { error: `items[${i}].name is too long (at most ${MAX.socialName} characters)` };
    if (it.url !== undefined && it.url !== null && typeof it.url !== 'string') return { error: `items[${i}].url must be text` };
    const url = clean(it.url);
    if (url && (url.length > MAX.socialUrl || !isWebAddress(url))) return { error: `items[${i}].url must be a web address starting with https:// (or http://)` };
  }
  return { value: items };
}

// ---------- pages ----------
const emptyPage = () => ({ title: { en: null, ar: null }, body: { en: null, ar: null }, updatedAt: null });
const normalizePages = (raw) => { const s = parse(raw, {}); const out = {}; for (const k of PAGE_KEYS) { const p = s[k] || {}; out[k] = { title: pair(p.title), body: pair(p.body), updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null }; } return out; };
const hasContent = (p) => Boolean(p.body.en || p.body.ar);
function validatePage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Expected { title: { en, ar }, body: { en, ar } }' };
  for (const [name, max] of [['title', MAX.pageTitle], ['body', MAX.pageBody]]) {
    const p = body[name]; if (p === undefined || p === null) continue;
    if (typeof p !== 'object' || Array.isArray(p)) return { error: `${name} must be an object` };
    for (const lang of ['en', 'ar']) {
      if (p[lang] !== undefined && p[lang] !== null && typeof p[lang] !== 'string') return { error: `${name}.${lang} must be text` };
      if (typeof p[lang] === 'string' && p[lang].trim().length > max) return { error: `${name}.${lang} is too long (at most ${max} characters)` };
    }
  }
  return { value: { title: pair(body.title), body: pair(body.body) } };
}

// ---------- storage: every change locks the row, so two admins cannot overwrite each other ----------
async function read(key) { const { rows } = await db.query('SELECT value FROM platform_settings WHERE key = $1', [key]); return rows.length ? rows[0].value : null; }
async function mutate(key, empty, change) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO NOTHING', [key, empty]);
    const { rows } = await client.query('SELECT value FROM platform_settings WHERE key = $1 FOR UPDATE', [key]);
    const { next, after } = await change(rows[0].value);
    await client.query('UPDATE platform_settings SET value = $2, updated_at = now() WHERE key = $1', [key, JSON.stringify(next)]);
    await client.query('COMMIT');
    return after !== undefined ? after : next;
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; } finally { client.release(); }
}
const knownPage = (req, res, next) => (PAGE_KEYS.includes(req.params.key) ? next() : res.status(404).json({ error: `Unknown page "${req.params.key}". Expected one of: ${PAGE_KEYS.join(', ')}` }));
const admin = [requireAuth, requireRole('admin')];

// GET /platform-settings/footer  ->  { text, social, pages: { about: true|false, ... }, slugs }      (public)
router.get('/', async (req, res, next) => {
  try {
    const pages = normalizePages(await read(KEY_PAGES)); const flags = {}; for (const k of PAGE_KEYS) flags[k] = hasContent(pages[k]);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ text: normalizeText(await read(KEY_TEXT)), social: normalizeSocial(await read(KEY_SOCIAL)), pages: flags, slugs: PAGES });
  } catch (err) { next(err); }
});

// PUT /platform-settings/footer/text  (JSON)  ->  { text }      (admin)
router.put('/text', ...admin, async (req, res, next) => {
  try {
    const checked = validateText(req.body); if (checked.error) return res.status(400).json({ error: checked.error });
    await db.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [KEY_TEXT, JSON.stringify(checked.value)]);
    await logAdminAction(req, 'footer_text_changed', 'platform_setting', KEY_TEXT, {});
    res.json({ text: checked.value });
  } catch (err) { next(err); }
});

// PUT /platform-settings/footer/social  (JSON { items: [{ id?, name, url }] })  ->  { social }      (admin; the order sent is the order shown; a picture stays with its item)
router.put('/social', ...admin, async (req, res, next) => {
  try {
    const checked = validateSocial(req.body); if (checked.error) return res.status(400).json({ error: checked.error });
    let removedIcons = [];
    const social = await mutate(KEY_SOCIAL, '[]', async (raw) => {
      const existing = normalizeSocial(raw); const byId = new Map(existing.map((i) => [i.id, i])); const keep = new Set();
      const next = checked.value.map((it) => {
        const old = typeof it.id === 'string' ? byId.get(it.id) : null; const id = old ? old.id : crypto.randomBytes(6).toString('hex'); keep.add(id);
        return { id, name: clean(it.name), url: clean(it.url), icon: old ? old.icon : null };
      });
      removedIcons = existing.filter((i) => !keep.has(i.id) && i.icon).map((i) => i.icon);
      return { next };
    });
    for (const url of removedIcons) removeLocalImage(url);
    await logAdminAction(req, 'footer_social_changed', 'platform_setting', KEY_SOCIAL, { count: social.length });
    res.json({ social });
  } catch (err) { next(err); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter: (req, file, cb) => (ALLOWED_MIME_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))) });
// PUT /platform-settings/footer/social/:id/icon  (multipart, field "image", exactly 256 x 256)  ->  { id, icon, social }      (admin)
router.put('/social/:id/icon', ...admin, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The picture is larger than 10 MB' : err.message });
    if (!req.file) return res.status(400).json({ error: 'No picture provided (expected field name "image")' });
    try {
      if (!normalizeSocial(await read(KEY_SOCIAL)).some((i) => i.id === req.params.id)) return res.status(404).json({ error: 'Unknown social media icon' });
      const checked = inspectImage(req.file.buffer, ICON_PX); if (!checked.ok) return res.status(400).json({ error: checked.error });
      if (checked.width !== ICON_PX || checked.height !== ICON_PX) return res.status(400).json({ error: `The picture must be exactly ${ICON_PX} x ${ICON_PX} px (it is ${checked.width} x ${checked.height}). The admin screen crops and resizes it for you.` });
      const saved = await saveImage(req.file.buffer, checked.mime); let old = null;
      const social = await mutate(KEY_SOCIAL, '[]', async (raw) => { const list = normalizeSocial(raw); const item = list.find((i) => i.id === req.params.id); if (!item) throw Object.assign(new Error('gone'), { gone: true }); old = item.icon; item.icon = saved.url; return { next: list }; })
        .catch((e) => { removeLocalImage(saved.url); if (e.gone) return null; throw e; });
      if (!social) return res.status(404).json({ error: 'Unknown social media icon' });
      if (old && old !== saved.url) removeLocalImage(old);
      await logAdminAction(req, 'footer_social_icon_changed', 'platform_setting', KEY_SOCIAL, { id: req.params.id, url: saved.url });
      res.json({ id: req.params.id, icon: saved.url, social });
    } catch (e) { next(e); }
  });
});
// DELETE /platform-settings/footer/social/:id/icon  ->  { id, icon: null, social }      (admin; the website shows the Leap logo again)
router.delete('/social/:id/icon', ...admin, async (req, res, next) => {
  try {
    let old = null; let found = true;
    const social = await mutate(KEY_SOCIAL, '[]', async (raw) => { const list = normalizeSocial(raw); const item = list.find((i) => i.id === req.params.id); if (!item) { found = false; return { next: list }; } old = item.icon; item.icon = null; return { next: list }; });
    if (!found) return res.status(404).json({ error: 'Unknown social media icon' });
    if (old) removeLocalImage(old);
    res.json({ id: req.params.id, icon: null, social });
  } catch (err) { next(err); }
});

// GET /platform-settings/footer/pages/:key  ->  { key, slug, title, body, updatedAt, hasContent }      (public)
router.get('/pages/:key', knownPage, async (req, res, next) => {
  try {
    const page = normalizePages(await read(KEY_PAGES))[req.params.key];
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ key: req.params.key, slug: PAGES[req.params.key], ...page, hasContent: hasContent(page) });
  } catch (err) { next(err); }
});
// PUT /platform-settings/footer/pages/:key  (JSON { title, body })  ->  the page      (admin; the "last updated" date is set by the server)
router.put('/pages/:key', ...admin, knownPage, async (req, res, next) => {
  try {
    const checked = validatePage(req.body); if (checked.error) return res.status(400).json({ error: checked.error });
    const page = await mutate(KEY_PAGES, '{}', async (raw) => {
      const all = normalizePages(raw); all[req.params.key] = { ...checked.value, updatedAt: new Date().toISOString() };
      return { next: all, after: all[req.params.key] };
    });
    await logAdminAction(req, 'footer_page_changed', 'platform_setting', KEY_PAGES, { page: req.params.key });
    res.json({ key: req.params.key, slug: PAGES[req.params.key], ...page, hasContent: hasContent(page) });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.PAGES = PAGES;
module.exports.MAX_SOCIAL = MAX_SOCIAL;
module.exports.normalizeText = normalizeText;
module.exports.normalizeSocial = normalizeSocial;
module.exports.emptyPage = emptyPage;
