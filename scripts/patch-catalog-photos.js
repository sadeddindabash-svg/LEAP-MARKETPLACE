#!/usr/bin/env node
/**
 * Real photos for the catalog (the sections and the parts that now show a "photo coming soon" tile): the admin portal's Categories page gets a "Photos" tab (coverage, a shot list to give whoever makes
 * the pictures, and a bulk import with a preview and Undo), and the shop can optionally show a product's own photo for a part that has none yet. Run it AFTER scripts/patch-footer.js.
 *
 *   node scripts/patch-catalog-photos.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-catalog-photos.js --write    applies it (each changed file is saved as <file>.before-catalog-photos first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/catalogImport/routes.js", "what": "mount the catalog photos routes: /catalog/admin/photos", "done": "catalogPhotos/routes", "pairs": [["const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];", "const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];\n\n// Categories > Photos: coverage, the shot list, the bulk photo import with Undo, and the optional fallback switch (see ../catalogPhotos).\nrouter.use('/photos', require('../catalogPhotos/routes'));"]]}, {"file": "services/api/src/modules/catalog/routes.js", "what": "the optional fallback: a product's photo for a section or part that has none yet (off until switched on)", "done": "withFallbackSections", "pairs": [["const { loadBuyerFit } = require('../orderVehicles/productCars');", "const { loadBuyerFit } = require('../orderVehicles/productCars');\nconst { withFallbackSections, withFallbackParts } = require('../catalogPhotos/fallback');"], ["router.get('/categories', async (req, res, next) => {\n  try {\n    const { rows } = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC');\n    res.json(rows.map(toCategoryDto));", "router.get('/categories', async (req, res, next) => {\n  try {\n    const { rows } = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC');\n    res.json((await withFallbackSections(rows)).map(toCategoryDto));      // (unchanged unless the admin turned the photo fallback on)"], ["    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [req.params.id]);\n    res.json(rows.map(toPartDto));", "    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [req.params.id]);\n    res.json((await withFallbackParts(rows, req.params.id)).map(toPartDto));      // (unchanged unless the admin turned the photo fallback on)"]]}, {"file": "apps/admin-dashboard/src/CategoriesTabs.jsx", "what": "the Photos tab on the Categories page", "done": "CatalogPhotosPanel", "pairs": [["import CatalogEditorPanel from \"./CatalogEditorPanel\";", "import CatalogEditorPanel from \"./CatalogEditorPanel\";\nimport CatalogPhotosPanel from \"./CatalogPhotosPanel\";"], ["const TABS = [[\"categories\", \"Categories\"], [\"import\", \"Import from Excel\"], [\"edit\", \"Edit details\"]];", "const TABS = [[\"categories\", \"Categories\"], [\"import\", \"Import from Excel\"], [\"edit\", \"Edit details\"], [\"photos\", \"Photos\"]];"], ["      {tab === \"edit\" && <div style={{ padding: \"16px 24px 24px\" }}><CatalogEditorPanel onSessionExpired={onSessionExpired} /></div>}", "      {tab === \"edit\" && <div style={{ padding: \"16px 24px 24px\" }}><CatalogEditorPanel onSessionExpired={onSessionExpired} /></div>}\n      {tab === \"photos\" && <div style={{ padding: \"16px 24px 24px\" }}><CatalogPhotosPanel onSessionExpired={onSessionExpired} /></div>}"]]}], "whole": [], "tests": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'catalog-photos-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'catalog-photos-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-catalog-photos`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
