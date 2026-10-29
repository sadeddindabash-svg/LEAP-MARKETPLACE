#!/usr/bin/env node
/**
 * SERVER: the car the supplier sees on an order item (the car the part is LISTED FOR, never the buyer's car) now also carries its generation: { name, yearStart, yearEnd, versionCount } (versionCount = how many versions
 * that generation has in the catalogue, so the portal can say "2 of 3 versions"). The versions the part is narrowed to (cars[].versions) come from patch-fit-versions.js, which must be applied FIRST. No migration.
 *
 *   node scripts/patch-order-vehicle-details.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-vehicle-details.js --write    applies it (each changed file is saved as <file>.before-order-vehicle-details first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/orderVehicles/productCars.js", "what": "the car on an order item carries its generation (name, years, how many versions it has)", "done": "versionCount: r.version_count", "pairs": [["g.photo_url AS generation_photo, m.photo_url AS model_photo,", "g.name AS generation_name, g.year_start AS generation_start, g.year_end AS generation_end, (SELECT COUNT(*)::int FROM vehicle_versions vv WHERE vv.generation_id = pfe.generation_id) AS version_count,\n            g.photo_url AS generation_photo, m.photo_url AS model_photo,"], ["        // null = every version\n", "        generation: { name: r.generation_name, yearStart: r.generation_start, yearEnd: r.generation_end, versionCount: r.version_count },\n        // null = every version\n"]]}, {"file": "services/api/test/productCars.test.js", "what": "the older test of the supplier's car also expects the generation", "done": "generation: { name: '2022'", "pairs": [["photoUrl: '/uploads/zz-pc-genA.png', versions: null });", "photoUrl: '/uploads/zz-pc-genA.png', generation: { name: '2022', yearStart: 2022, yearEnd: 2022, versionCount: 0 }, versions: null });"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'order-vehicle-details-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'order-vehicle-details-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-order-vehicle-details`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
