#!/usr/bin/env node
/**
 * OPTIONAL companion of patch-product-parity.js: updates three EXISTING test files whose expectations described the old delivery wording ("Delivery in 7 days") so that they expect the date ("Delivery: Oct. 29") with a fixed clock.
 * It is separate so that a difference in a test file can never stop the feature itself. Run it AFTER patch-product-parity.js (the tests fail on the new wording until then).
 *
 *   node scripts/patch-product-parity-tests.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-product-parity-tests.js --write    applies it (each changed file is saved as <file>.before-product-parity-tests first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/pages-i18n.test.tsx", "what": "the home page test expects the delivery DATE (fixed clock) on its cards", "done": "The delivery date is today plus the estimated days, so the clock is fixed", "pairs": [["import type { ProductSummary } from \"@/lib/api\";", "import type { ProductSummary } from \"@/lib/api\";\n\n// The delivery date is today plus the estimated days, so the clock is fixed: it is 22 October 2026 (Saudi time).\nvi.useFakeTimers({ toFake: [\"Date\"] }); vi.setSystemTime(new Date(\"2026-10-22T09:00:00Z\"));\n"], ["expect(screen.getAllByText(/Delivery in 7 days/).length).toBe(2);", "expect(screen.getAllByText(/Delivery: Oct\\. 29/).length).toBe(2);"], ["expect(screen.getAllByText(/التوصيل خلال 7 أيام/).length).toBe(2);", "expect(screen.getAllByText(/التسليم: 29 أكتوبر/).length).toBe(2);"]]}, {"file": "apps/web-storefront/app/stage1b-pages.test.tsx", "what": "the compare page test expects the delivery DATE (fixed clock)", "done": "The delivery date is today plus the estimated days, so the clock is fixed", "pairs": [["import { LangProvider } from \"@/components/LangProvider\";", "import { LangProvider } from \"@/components/LangProvider\";\n\n// The delivery date is today plus the estimated days, so the clock is fixed: it is 22 October 2026 (Saudi time).\nvi.useFakeTimers({ toFake: [\"Date\"] }); vi.setSystemTime(new Date(\"2026-10-22T09:00:00Z\"));\n"], [".toEqual([\"Delivery in 5 days\", \"—\"]);", ".toEqual([\"Oct. 27\", \"—\"]);"]]}, {"file": "apps/web-storefront/components/stage1c-components.test.tsx", "what": "the other-listings test expects the delivery DATE (fixed clock)", "done": "The delivery date is today plus the estimated days, so the clock is fixed", "pairs": [["import { LangProvider } from \"./LangProvider\";", "import { LangProvider } from \"./LangProvider\";\n\n// The delivery date is today plus the estimated days, so the clock is fixed: it is 22 October 2026 (Saudi time).\nvi.useFakeTimers({ toFake: [\"Date\"] }); vi.setSystemTime(new Date(\"2026-10-22T09:00:00Z\"));\n"], ["expect(links[0]).toHaveTextContent(\"Delivery in 5 days\");", "expect(links[0]).toHaveTextContent(\"Delivery: Oct. 27\");"], ["expect(links[1]).not.toHaveTextContent(\"Delivery in\");", "expect(links[1]).not.toHaveTextContent(\"Delivery:\");"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'product-parity-tests-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'product-parity-tests-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-product-parity-tests`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
