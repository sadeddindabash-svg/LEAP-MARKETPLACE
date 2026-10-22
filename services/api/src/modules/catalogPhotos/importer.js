// The bulk photo import: pictures named by code ("BRK.jpg", "BRK-001.png") are checked, kept, and put on the section or part they belong to. The admin portal prepares each picture in the browser (crops it to a square and
// saves it at 512 x 512); the shop checks AGAIN that every picture is a real picture of exactly that size, so nothing else can get in. A part's picture is also given to the parts that are only different sizes of the same
// thing (Engine Oil 1 L / 4 L / 5 L). By default a section or part that already has a real picture is left alone; "replace" changes that. Every import is written down (what each item had before) so it can be UNDONE.
const db = require('../../../db/pool');
const { inspectImage, saveImage, removeLocalImage } = require('../uploads/imageRules');
const { ensurePlaceholders, isPlaceholder } = require('../catalogImport/placeholders');
const { codeFromFileName, isPartCode } = require('./codes');

const PHOTO_PX = 512;
const MAX_PER_REQUEST = 40;
const KEEP_BATCHES = 5;
const LOG_KEY = 'catalog_photo_batches';
const parseLog = (raw) => { try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(v) ? v : []; } catch { return []; } };

/** Changes the log with the row locked, so two imports at the same moment cannot overwrite each other's notes. */
async function mutateLog(change) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, '[]', now()) ON CONFLICT (key) DO NOTHING", [LOG_KEY]);
    const { rows } = await client.query('SELECT value FROM platform_settings WHERE key = $1 FOR UPDATE', [LOG_KEY]);
    const { next, result } = await change(parseLog(rows[0].value), client);
    await client.query('UPDATE platform_settings SET value = $2, updated_at = now() WHERE key = $1', [LOG_KEY, JSON.stringify(next.slice(-KEEP_BATCHES))]);
    await client.query('COMMIT');
    return result;
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; } finally { client.release(); }
}

/** The things a code stands for: a section (one), or a part and the parts that share its picture. */
async function targetsFor(code) {
  if (!isPartCode(code)) {
    const { rows } = await db.query('SELECT id, code, photo_url FROM product_categories WHERE upper(code) = $1', [code]);
    return rows.map((r) => ({ kind: 'section', table: 'product_categories', id: r.id, code: r.code, photoUrl: r.photo_url }));
  }
  const own = (await db.query('SELECT id, category_id, subcategory_en, name_en FROM category_parts WHERE upper(code) = $1', [code])).rows[0];
  if (!own) return [];
  const { rows } = await db.query('SELECT id, code, photo_url FROM category_parts WHERE category_id = $1 AND lower(btrim(coalesce(subcategory_en, name_en))) = lower(btrim($2)) AND code IS NOT NULL ORDER BY code', [own.category_id, own.subcategory_en || own.name_en]);
  return rows.map((r) => ({ kind: 'part', table: 'category_parts', id: r.id, code: r.code, photoUrl: r.photo_url }));
}

/**
 * files: [{ originalname, buffer }]. Returns one result per file:
 *   saved (with `applied` and `skipped` codes) | kept (everything it stands for already has a real picture) | unknown_code | bad_name | duplicate | not_image | wrong_size
 */
async function importFiles(files, { batchId, replace = false, by = null }) {
  const results = []; const seen = new Set(); const items = [];
  for (const f of files) {
    const base = { file: f.originalname };
    const code = codeFromFileName(f.originalname);
    if (!code) { results.push({ ...base, status: 'bad_name' }); continue; }
    if (seen.has(code)) { results.push({ ...base, code, status: 'duplicate' }); continue; }
    seen.add(code);
    const checked = inspectImage(f.buffer, 1);
    if (!checked.ok) { results.push({ ...base, code, status: 'not_image', error: checked.error }); continue; }
    if (checked.width !== PHOTO_PX || checked.height !== PHOTO_PX) { results.push({ ...base, code, status: 'wrong_size', width: checked.width, height: checked.height }); continue; }
    const targets = await targetsFor(code);
    if (targets.length === 0) { results.push({ ...base, code, status: 'unknown_code' }); continue; }
    const toChange = targets.filter((t) => replace || isPlaceholder(t.photoUrl));
    if (toChange.length === 0) { results.push({ ...base, code, status: 'kept', skipped: targets.map((t) => t.code) }); continue; }
    const saved = await saveImage(f.buffer, checked.mime);
    for (const t of toChange) { await db.query(`UPDATE ${t.table} SET photo_url = $1 WHERE id = $2`, [saved.url, t.id]); items.push({ kind: t.kind, id: t.id, code: t.code, oldUrl: t.photoUrl || null, newUrl: saved.url }); }
    results.push({ ...base, code, status: 'saved', url: saved.url, applied: toChange.map((t) => t.code), skipped: targets.filter((t) => !toChange.includes(t)).map((t) => t.code) });
  }
  if (items.length > 0) {
    await mutateLog((log) => {
      const existing = log.find((b) => b.id === batchId);
      if (existing) existing.items.push(...items); else log.push({ id: batchId, at: new Date().toISOString(), by, undone: false, items });
      return { next: log };
    });
  }
  return results;
}

const summary = (b) => ({ id: b.id, at: b.at, by: b.by, undone: Boolean(b.undone), count: b.undone ? (b.count || 0) : b.items.length });
async function listBatches() { return parseLog((await db.query('SELECT value FROM platform_settings WHERE key = $1', [LOG_KEY])).rows[0]?.value).map(summary).reverse(); }

/** Puts every item of an import back as it was (an item that has been changed since is left as it is), and removes the pictures nobody uses any more. */
async function undoBatch(batchId) {
  const placeholders = ensurePlaceholders(); const doomed = new Set(); let restored = 0; let changedSince = 0; let found = null;
  await mutateLog(async (log, client) => {
    found = log.find((b) => b.id === batchId);
    if (!found || found.undone) return { next: log };
    for (const it of found.items) {
      const table = it.kind === 'section' ? 'product_categories' : 'category_parts';
      const { rowCount } = await client.query(`UPDATE ${table} SET photo_url = $1 WHERE id = $2 AND photo_url = $3`, [it.oldUrl || (it.kind === 'section' ? placeholders.category : placeholders.part), it.id, it.newUrl]);
      if (rowCount) restored += 1; else changedSince += 1;
      doomed.add(it.newUrl);
    }
    found.count = found.items.length; found.items = []; found.undone = true;
    return { next: log };
  });
  if (!found) return { status: 'unknown' };
  if (found.undone && restored === 0 && changedSince === 0 && !doomed.size) return { status: 'already_undone' };
  for (const url of doomed) {
    const { rows } = await db.query('SELECT 1 FROM product_categories WHERE photo_url = $1 UNION ALL SELECT 1 FROM category_parts WHERE photo_url = $1 LIMIT 1', [url]);
    if (rows.length === 0) removeLocalImage(url);
  }
  return { status: 'undone', restored, changedSince };
}

module.exports = { importFiles, listBatches, undoBatch, PHOTO_PX, MAX_PER_REQUEST, KEEP_BATCHES };
