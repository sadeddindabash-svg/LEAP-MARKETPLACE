#!/usr/bin/env node
/**
 * Storefront: (1) the header search box shows rotating suggestions that slide up one at a time (every page); (2) on a product page the column beside the photos (title, price, Add to cart) stays in view while the
 * photos and details are scrolled, and is released where they end.
 *
 *   node scripts/patch-search-sticky.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-search-sticky.js --write    applies it (each changed file is saved as <file>.before-search-sticky first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/i18n.ts", "what": "the rotating search suggestions (English and Arabic)", "done": "search_hint_1", "pairs": [["  search_placeholder: \"Search by part name, part number or VIN\",", "  search_placeholder: \"Search by part name, part number or VIN\",\n  search_hint_1: \"Search “brake pads”\",\n  search_hint_2: \"Search “oil filter”\",\n  search_hint_3: \"Search by OEM number, e.g. 12345-67890\",\n  search_hint_4: \"Search by VIN or by car, e.g. BYD Seal\","], ["  search_placeholder: \"ابحث باسم القطعة أو رقمها أو رقم الهيكل\",", "  search_placeholder: \"ابحث باسم القطعة أو رقمها أو رقم الهيكل\",\n  search_hint_1: \"ابحث عن «تيل فرامل»\",\n  search_hint_2: \"ابحث عن «فلتر زيت»\",\n  search_hint_3: \"ابحث برقم OEM، مثل 12345-67890\",\n  search_hint_4: \"ابحث برقم الهيكل (VIN) أو بالسيارة، مثل BYD Seal\","]]}, {"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "the column beside the photos stays in view while the photos and details are scrolled (computer screens)", "done": "md:sticky", "pairs": [["        <div>\n          <div className=\"flex items-start justify-between gap-3\">", "        {/* The column beside the photos (title, price, Add to cart) stays in view while the photos and the details card are scrolled, and is released where they end. On a phone the page is one column: nothing is pinned.\n            A very tall column (a long description) gets its own small scroll instead of hiding the buttons. The header does not stick, so a small gap at the top is enough. */}\n        <div className=\"md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pe-1\">\n          <div className=\"flex items-start justify-between gap-3\">"]]}], "whole": [{"file": "apps/web-storefront/components/HeaderSearch.tsx", "what": "the header search box shows rotating suggestions (the plain sentence for people who asked for less movement)", "sha": "3630ae8fab64fe8dd0c50edafe51e6b8a6662709e7afe68d98d605087c53723b"}], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'search-sticky-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'search-sticky-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-search-sticky`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
