#!/usr/bin/env node
/**
 * Storefront: the "Shopping for" container moves BESIDE the menus (Home, Products, Find a part, Sections) and looks like the mobile app's card: the label, the car in a dark chip and the car's picture in an angled panel. It is shown
 * to everyone ("Add a vehicle" when there is no car), and the whole container opens My garage. On a phone it keeps its own row under the menu. The thin bar under the menu is gone.
 *
 *   node scripts/patch-shopping-for.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-shopping-for.js --write    applies it (each changed file is saved as <file>.before-shopping-for first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/SiteHeader.tsx", "what": "the Shopping for container sits at the end of the menu row (computer) or in its own row under it (phone); the thin bar is gone", "done": "VehicleBar where=\"menu\"", "pairs": [["<div className=\"relative mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 sm:px-8\">", "<div className=\"relative mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 sm:px-8 lg:flex-nowrap\">"], ["          </NavDropdown>\n        </div>\n      </nav>\n      <VehicleBar />", "          </NavDropdown>\n          <VehicleBar where=\"menu\" />\n        </div>\n      </nav>\n      <VehicleBar where=\"row\" />"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words of the empty Shopping for container (English and Arabic, as in the app)", "done": "add_a_vehicle", "pairs": [["  add_your_car: \"Add your car to see the parts that fit it\",", "  add_your_car: \"Add your car to see the parts that fit it\",\n  add_a_vehicle: \"Add a vehicle\","], ["  add_your_car: \"أضف مركبتك لترى القطع المناسبة لها\",", "  add_your_car: \"أضف مركبتك لترى القطع المناسبة لها\",\n  add_a_vehicle: \"أضف مركبة\","]]}], "whole": [{"file": "apps/web-storefront/components/VehicleBar.tsx", "what": "the Shopping for container looks like the mobile app's card and works for everyone", "sha": "5bfafaa9f286542c5eac4775afc0d29fdf511f79d6ff5c324a0f2f247faef111"}], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'shopping-for-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'shopping-for-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-shopping-for`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
