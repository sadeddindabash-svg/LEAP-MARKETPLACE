// OPTIONAL: until a section or part has its own picture, show the main photo of one of its products instead of the "photo coming soon" tile. A switch in the admin portal (Categories > Photos), OFF until turned on.
// It only changes what the website's PUBLIC lists give back; the admin portal still sees the real state (so the coverage numbers stay true).
const db = require('../../../db/pool');
const { isPlaceholder } = require('../catalogImport/placeholders');

const KEY = 'catalog_photo_fallback';
const CACHE_MS = 30000;
let cache = { at: 0, on: false };
const clearFallbackCache = () => { cache = { at: 0, on: false }; };
async function isOn() {
  if (Date.now() - cache.at < CACHE_MS) return cache.on;
  let on = false;
  try { const { rows } = await db.query('SELECT value FROM platform_settings WHERE key = $1', [KEY]); on = rows.length > 0 && JSON.parse(rows[0].value).on === true; } catch { on = false; }
  cache = { at: Date.now(), on }; return on;
}
async function setOn(on) {
  await db.query(`INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [KEY, JSON.stringify({ on: Boolean(on) })]);
  clearFallbackCache(); return Boolean(on);
}
// The first picture of the best-rated live product of each section / part.
const FIRST_IMAGE = '(SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1)';
/** Rows of product_categories, with the placeholder replaced by a product's photo where there is one (when the switch is on). */
async function withFallbackSections(rows) {
  if (!rows.some((r) => isPlaceholder(r.photo_url)) || !(await isOn())) return rows;
  const { rows: found } = await db.query(`SELECT DISTINCT ON (p.category) p.category AS key, ${FIRST_IMAGE} AS url FROM products p WHERE p.status = 'active' AND p.category = ANY($1) AND ${FIRST_IMAGE} IS NOT NULL ORDER BY p.category, p.rating DESC NULLS LAST, p.id ASC`, [rows.map((r) => r.id)]);
  const photo = new Map(found.map((f) => [f.key, f.url]));
  return rows.map((r) => (isPlaceholder(r.photo_url) && photo.has(r.id) ? { ...r, photo_url: photo.get(r.id) } : r));
}
/** Rows of category_parts of one section, the same way. */
async function withFallbackParts(rows, categoryId) {
  if (!rows.some((r) => isPlaceholder(r.photo_url)) || !(await isOn())) return rows;
  const { rows: found } = await db.query(`SELECT DISTINCT ON (lower(btrim(p.part))) lower(btrim(p.part)) AS key, ${FIRST_IMAGE} AS url FROM products p WHERE p.status = 'active' AND p.category = $1 AND p.part IS NOT NULL AND ${FIRST_IMAGE} IS NOT NULL ORDER BY lower(btrim(p.part)), p.rating DESC NULLS LAST, p.id ASC`, [categoryId]);
  const photo = new Map(found.map((f) => [f.key, f.url]));
  return rows.map((r) => { const url = photo.get(String(r.name_en).trim().toLowerCase()); return isPlaceholder(r.photo_url) && url ? { ...r, photo_url: url } : r; });
}
module.exports = { isOn, setOn, withFallbackSections, withFallbackParts, clearFallbackCache };
