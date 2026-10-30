#!/usr/bin/env node
/**
 * Website and mobile app, "Newest products" (the home page list, sort=newest with no search, category or car): the newest product of
 * each car brand first, then the 2nd newest of each brand, then the 3rd, and so on. Brand = the brand of the product's first car;
 * a product with no car is its own group. One server change: the website and the app both get this order. Apply after patch-reject-reasons.js.
 *
 *   node scripts/patch-newest-by-brand.js            dry run
 *   node scripts/patch-newest-by-brand.js --write    applies it (routes.js is saved as routes.js.before-newest-by-brand first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"services/api/src/modules/catalog/routes.js","what":"Newest products (website and app home): the newest of each car brand first, then the 2nd newest of each, and so on","done":"async function interleaveNewestByBrand(","pairs":[["router.get('/products', async (req, res, next) => {","// \"Newest products\" (the home page of the website and of the app): the newest product of EACH car brand first, then the 2nd newest of\n// each brand, then the 3rd, and so on; a brand with nothing left is skipped. Inside a round, the brand whose newest product is the most\n// recent comes first. A product's brand is the brand of its first car; a product with no car (it fits any car) is in a group of its own.\n// `dtos` is already newest first, so each brand's list and the brands' order come out right by keeping first-seen order.\nasync function interleaveNewestByBrand(dtos) {\n  if (dtos.length < 2) return dtos;\n  const { rows } = await db.query(\n    `SELECT DISTINCT ON (pfe.product_id) pfe.product_id, vm.brand_id\n     FROM product_fitment_entries pfe\n     JOIN vehicle_generations vg ON vg.id = pfe.generation_id\n     JOIN vehicle_models vm ON vm.id = vg.model_id\n     WHERE pfe.product_id = ANY($1)\n     ORDER BY pfe.product_id, pfe.id`,\n    [dtos.map((d) => d.id)]\n  );\n  const brandOf = new Map(rows.map((r) => [r.product_id, r.brand_id]));\n  const groups = new Map();\n  for (const d of dtos) {\n    const brand = brandOf.has(d.id) ? brandOf.get(d.id) : '(any car)';\n    if (!groups.has(brand)) groups.set(brand, []);\n    groups.get(brand).push(d);\n  }\n  const lists = [...groups.values()];\n  const out = [];\n  for (let round = 0; out.length < dtos.length; round++) for (const list of lists) if (list[round]) out.push(list[round]);\n  return out;\n}\n\nrouter.get('/products', async (req, res, next) => {"],["      else if (sort === 'price_desc') dtos.sort((a, b) => b.price - a.price);\n      return dtos;","      else if (sort === 'price_desc') dtos.sort((a, b) => b.price - a.price);\n      // the home page's \"Newest products\" (no search, category or car chosen): one product per brand at a time\n      if (sort === 'newest' && !category && !part && !search && !vehicleId && !generationId) dtos = await interleaveNewestByBrand(dtos);\n      return dtos;"]]}],"created":[]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-newest-by-brand`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart the API (scripts\\start-all.cmd), then reload the website (Ctrl+F5) and pull down on the app home to refresh.');
