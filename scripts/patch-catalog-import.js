#!/usr/bin/env node
/**
 * Applies the two small changes the catalog import needs to files that already exist in your project. Nothing else is touched.
 *
 *   1. services/api/src/modules/catalog/routes.js     one line that mounts the new module:   router.use('/admin', require('../catalogImport/routes'));
 *   2. services/api/src/modules/supplier/productValidation.js     the supplier bulk import now also recognises the catalog CODE (BRK, BRK-001) and the Chinese or Arabic name
 *      of a category or part, never guessing when a name fits more than one (it was exact English name or id only; that stays first).
 *
 *   node scripts/patch-catalog-import.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-catalog-import.js --write    applies it (each file is saved as <file>.before-catalog-import first)
 *
 * It refuses to change a file whose text is not exactly what it expects (so it can never half-apply), and says "already applied" when it was done before.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');

const MOUNT_LINE = "router.use('/admin', require('../catalogImport/routes'));";
const NEW_MATCH = `async function tryMatchCategoryAndPart(category, part, client) {
  // catalog import: a part CODE (BRK-001) names one part, so it works even when the category is left blank
  if (!category) {
    if (!part) return { category: null, part: null };
    const byCode = await client.query('SELECT category_id, name_en FROM category_parts WHERE lower(code) = lower($1)', [part]);
    return byCode.rows.length === 1 ? { category: byCode.rows[0].category_id, part: byCode.rows[0].name_en } : { category: null, part: null };
  }
  // exact id or English name first, exactly as before; then the catalog code, then the Chinese or Arabic name. A name that fits more than one category is NOT guessed.
  let categoryCheck = await client.query('SELECT id FROM product_categories WHERE id = $1 OR name_en = $1', [category]);
  if (categoryCheck.rows.length === 0) {
    categoryCheck = await client.query('SELECT id FROM product_categories WHERE lower(code) = lower($1) OR name_zh = $1 OR name_ar = $1', [category]);
    if (categoryCheck.rows.length !== 1) return { category: null, part: null };
  }
  const realCategoryId = categoryCheck.rows[0].id;
  if (!part) return { category: realCategoryId, part: null };
  let partCheck = await client.query('SELECT name_en FROM category_parts WHERE category_id = $1 AND name_en = $2', [realCategoryId, part]);
  if (partCheck.rows.length === 0) {
    partCheck = await client.query('SELECT name_en FROM category_parts WHERE category_id = $1 AND (lower(code) = lower($2) OR name_zh = $2 OR name_ar = $2)', [realCategoryId, part]);
    if (partCheck.rows.length !== 1) return { category: realCategoryId, part: null };
  }
  return { category: realCategoryId, part: partCheck.rows[0].name_en };
}`;

const edits = [
  { file: 'services/api/src/modules/catalog/routes.js', what: 'mount the catalog import module',
    done: (s) => s.includes('../catalogImport/routes'),
    apply: (s) => { const a = 'module.exports = router;'; if (s.split(a).length !== 2) return null; return s.replace(a, `// bulk parts catalog import, editing of every catalog field, undo and health (modules/catalogImport)\n${MOUNT_LINE}\n\n${a}`); } },
  { file: 'services/api/src/modules/supplier/productValidation.js', what: 'let the supplier bulk import recognise codes and Chinese/Arabic names',
    done: (s) => s.includes('catalog import: a part CODE'),
    apply: (s) => {
      const start = 'async function tryMatchCategoryAndPart(category, part, client) {', endMark = '\n}\n\nfunction tryMatchPosition';
      const a = s.indexOf(start); if (a < 0 || s.split(start).length !== 2) return null;
      const b = s.indexOf(endMark, a); if (b < 0) return null;
      const old = s.slice(a, b + 2);
      const expected = ["SELECT id FROM product_categories WHERE id = $1 OR name_en = $1", "SELECT name_en FROM category_parts WHERE category_id = $1 AND name_en = $2"];
      if (!expected.every((e) => old.includes(e))) return null;                    // the function is not the one this patch was written for
      return s.slice(0, a) + NEW_MATCH + s.slice(b + 2);
    } },
];

let problems = 0;
for (const e of edits) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (e.done(s)) { console.log(`already   ${e.file}: ${e.what} (nothing to do)`); continue; }
  const out = e.apply(s);
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.`); problems++; continue; }
  if (write) { fs.writeFileSync(`${p}.before-catalog-import`, s); fs.writeFileSync(p, out); console.log(`patched   ${e.file}: ${e.what} (backup: ${path.basename(p)}.before-catalog-import)`); }
  else console.log(`would     ${e.file}: ${e.what}`);
}
if (!write && problems === 0) console.log('\nDry run only. Add --write to apply.');
process.exit(problems ? 1 : 0);
