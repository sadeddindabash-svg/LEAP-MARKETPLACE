#!/usr/bin/env node
/**
 * OPTIONAL companion of patch-home-cards.js: updates two EXISTING test files whose expectations described the old look (the 72 px picture tile of the four totals; the dot before the delivery date on a product card). It is separate so
 * that a difference in a test file can never stop the feature itself. Run it AFTER patch-home-cards.js.
 *
 *   node scripts/patch-home-cards-tests.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-home-cards-tests.js --write    applies it (each changed file is saved as <file>.before-home-cards-tests first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/homePictures.test.tsx", "what": "the totals test expects the gold tile (picture fills it; faint icon without one)", "done": "filling the gold tile", "pairs": [["show the pictures the admin chose (72 px), and the icon wherever there is none.", "show the pictures the admin chose (filling the gold tile), and the big faint icon wherever there is none."], ["it(\"a tile with a picture shows it (square, 72 px) and no icon; a tile without one keeps its icon (also 72 px)\"", "it(\"a tile with a picture shows it (filling the gold tile) and no icon; a tile without one keeps its big faint icon\""], ["expect(icon.innerHTML).toContain(\"size-[72px]\"); }", "expect(icon.innerHTML).toContain(\"opacity-[0.17]\"); }"], ["expect(brands.innerHTML).toContain(\"size-[72px]\");", "expect(brands.innerHTML).toContain(\"object-cover\");"]]}, {"file": "apps/web-storefront/components/ProductCardDelivery.test.tsx", "what": "the card delivery test expects the green box and the date without a dot; no date when out of stock", "done": "a green \\\"In stock\\\" box", "pairs": [["it(\"is the date: \\\"In stock · Delivery: Oct. 29\\\"\", () => { expect(line(product())).toBe(\"In stock· Delivery: Oct. 29\"); });", "it(\"is the date: a green \\\"In stock\\\" box and \\\"Delivery: Oct. 29\\\"\", () => { expect(line(product())).toBe(\"In stockDelivery: Oct. 29\"); });"], ["expect(line(product({ stockQuantity: 0, estimatedDeliveryDays: null }))).toBe(\"Out of stock\"); });", "expect(line(product({ stockQuantity: 0, estimatedDeliveryDays: null }))).toBe(\"Out of stock\"); expect(line(product({ stockQuantity: 0 }))).toBe(\"Out of stock\"); });"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'home-cards-tests-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'home-cards-tests-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-home-cards-tests`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
