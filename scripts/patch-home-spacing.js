#!/usr/bin/env node
/**
 * Home page spacing: the space above "Shop by section", "Shop by brand" and "Newest parts" (that is, between the four totals and Shop by section, between Shop by section and Shop by brand, and between
 * Shop by brand and Newest parts) is halved, from 64 px to 32 px. Run it AFTER scripts/patch-product-page.js. It changes one file: apps/web-storefront/app/page.tsx
 *
 *   node scripts/patch-home-spacing.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-home-spacing.js --write    applies it (the file is saved as <file>.before-home-spacing first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/page.tsx", "what": "half the space above Shop by section, Shop by brand and Newest parts (64 px to 32 px)", "done": "px-4 pt-8 sm:px-8\" aria-labelledby=\"home-sections\"", "pairs": [["<section className=\"mx-auto max-w-7xl px-4 pt-16 sm:px-8\" aria-labelledby=\"home-sections\">", "<section className=\"mx-auto max-w-7xl px-4 pt-8 sm:px-8\" aria-labelledby=\"home-sections\">"], ["<section className=\"mx-auto max-w-7xl px-4 pt-16 sm:px-8\" aria-labelledby=\"home-brands\">", "<section className=\"mx-auto max-w-7xl px-4 pt-8 sm:px-8\" aria-labelledby=\"home-brands\">"], ["<section className=\"mx-auto max-w-7xl px-4 pb-4 pt-16 sm:px-8\" aria-labelledby=\"home-newest\">", "<section className=\"mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-8\" aria-labelledby=\"home-newest\">"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'product-page-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'product-page-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-home-spacing`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
