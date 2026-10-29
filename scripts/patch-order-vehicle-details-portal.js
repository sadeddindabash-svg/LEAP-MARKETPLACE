#!/usr/bin/env node
/**
 * SUPPLIER PORTAL: on the Orders page the CAR is shown IN FULL, in the order details (under each item) and in the orders table: brand, model, generation, year, engine, transmission and the VERSIONS the part is for
 * ("2 of 3 versions" with their names and engine and seats, a warning to check the version, or "All versions"). The table shows each item's car on its own lines, the first two items, then "+N more items".
 * It is still the car the part is LISTED FOR: never the buyer's car. Needs the server packages (patch-fit-versions.js, then patch-order-vehicle-details.js). Replaces src/OrderVehicle.jsx and src/OrderVehicle.test.jsx as a whole
 * (only when they are exactly the files this was made from) and widens the car column of the orders table.
 *
 *   node scripts/patch-order-vehicle-details-portal.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-vehicle-details-portal.js --write    applies it (each changed file is saved as <file>.before-order-vehicle-details-portal first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/supplier-portal/src/App.jsx", "what": "the car column of the orders table is wider", "done": "<Td style={{ minWidth: 300 }}><OrderVehicleCell", "pairs": [["<Td style={{ minWidth: 150 }}><OrderVehicleCell items={o.items} /></Td>", "<Td style={{ minWidth: 300 }}><OrderVehicleCell items={o.items} /></Td>"]]}], "whole": [{"file": "apps/supplier-portal/src/OrderVehicle.test.jsx", "what": "the tests of the vehicle display", "sha": "fb49f60116e7ccf80744250f0bcbe1d6725b6fd3f3b5f87316f63143fe999b9b"}, {"file": "apps/supplier-portal/src/OrderVehicle.jsx", "what": "the car on an order item in full: generation, versions, engine, transmission (details and the table cell)", "sha": "798b7daeaf94ee598d621ea01420fced1d8ed3cedabe2bab0709d239be1274b5"}, {"file": "apps/supplier-portal/src/OrderVehicleFlow.test.jsx", "what": "the Orders page flow test follows the new vehicle layout", "sha": "3a1c1a300d85e36e586c687e7da2cbee3ed26240dd40950af1f911138ea629ab"}]};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'order-vehicle-details-portal-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'order-vehicle-details-portal-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-order-vehicle-details-portal`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
