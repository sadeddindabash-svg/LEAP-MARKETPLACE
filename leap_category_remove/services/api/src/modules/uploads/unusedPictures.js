// Pictures that nothing uses any more. Every picture a person uploads or an import saves is kept under a random name in the uploads folder (32 letters and digits + .jpg/.png/.webp). When a picture is REPLACED the old file used to
// stay behind for ever. This finds those files (a file is "used" when its name appears anywhere in the database: any text column, any JSON, any list) and can remove them. It never touches a file that is used, a file with any other kind of name
// (the placeholders, logos), or a file younger than a day (it may belong to something being filled in right now). Pictures kept in cloud storage are not covered.
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
const HASHED = /^[0-9a-f]{32}\.(png|jpe?g|webp)$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// Where the pictures are. (LEAP_UPLOADS_DIR is only for the automated tests, so they work in a throw-away folder and can never touch real pictures.)
const uploadDir = () => process.env.LEAP_UPLOADS_DIR || UPLOAD_DIR;

/** The names of all the picture files the database mentions. The audit log is left out: it only remembers what once happened and would keep every old picture "used" for ever. */
async function referencedFiles(q) {
  const { rows: columns } = await q.query(
    `SELECT c.table_name, c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.table_name NOT LIKE '%audit%'
       AND (c.data_type IN ('text', 'character varying', 'json', 'jsonb') OR (c.data_type = 'ARRAY' AND c.udt_name IN ('_text', '_varchar')))`);
  const used = new Set();
  for (const { table_name: table, column_name: column } of columns) {
    if (!/^[A-Za-z0-9_]+$/.test(table) || !/^[A-Za-z0-9_]+$/.test(column)) continue;
    const { rows } = await q.query(`SELECT DISTINCT m[1] AS name FROM (SELECT regexp_matches("${column}"::text, '([0-9a-f]{32}\\.(?:png|jpe?g|webp))', 'g') AS m FROM "${table}" WHERE "${column}"::text ~ '[0-9a-f]{32}\\.') s`);
    for (const r of rows) used.add(r.name);
  }
  return used;
}
function filesOnDisk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => HASHED.test(n)).map((name) => { const st = fs.statSync(path.join(dir, name)); return { name, size: st.size, modified: st.mtimeMs }; });
}
/** { files: [{ name, size, modified }] (unused and old enough, oldest first), bytes, scanned (all picture files), tooNew (unused but younger than the limit) } */
async function findUnused(q, { dir = uploadDir(), minAgeMs = DAY_MS, now = Date.now() } = {}) {
  const used = await referencedFiles(q); const all = filesOnDisk(dir); const unused = all.filter((f) => !used.has(f.name));
  const files = unused.filter((f) => now - f.modified >= minAgeMs).sort((a, b) => a.modified - b.modified);
  return { files, bytes: files.reduce((n, f) => n + f.size, 0), scanned: all.length, tooNew: unused.length - files.length };
}
/** Looks again (never trusts an earlier list) and removes what is unused and old enough. */
async function removeUnused(q, options = {}) {
  const dir = options.dir || uploadDir(); const found = await findUnused(q, options); let removed = 0; let bytes = 0; let failed = 0;
  for (const f of found.files) { try { fs.unlinkSync(path.join(dir, f.name)); removed += 1; bytes += f.size; } catch { failed += 1; } }
  return { removed, bytes, failed };
}
/** The pictures an import has just replaced: removes each one that nothing uses (no age limit: they were in use a moment ago, and the replacement is saved). Returns how many were removed. */
async function removeIfUnused(q, urls, { dir = uploadDir() } = {}) {
  const names = [...new Set((urls || []).filter((u) => typeof u === 'string' && u.startsWith('/uploads/')).map((u) => path.basename(u)).filter((n) => HASHED.test(n)))];
  if (names.length === 0) return 0;
  const used = await referencedFiles(q); let removed = 0;
  for (const name of names) { if (used.has(name)) continue; try { fs.unlinkSync(path.join(dir, name)); removed += 1; } catch { /* already gone */ } }
  return removed;
}
module.exports = { referencedFiles, findUnused, removeUnused, removeIfUnused, UPLOAD_DIR, DAY_MS };
