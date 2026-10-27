#!/usr/bin/env node
/**
 * OPTIONAL companion of patch-product-description.js: updates ONE existing test (app/productParity.test.tsx) that said the description is not in the column beside the photos, which is no longer true on purpose.
 * It is separate so that a difference in a test file can never stop the feature itself. Run it AFTER patch-product-description.js.
 *
 *   node scripts/patch-product-description-tests.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-product-description-tests.js --write    applies it (the changed file is saved as <file>.before-product-description-tests first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/productParity.test.tsx", "what": "the column test now expects the description in the column and still in the card", "done": "the description is in the column AND in the card", "pairs": [["  it(\"the description and the part number are NOT in the column any more (they are in the specifications card)\", async () => {\n    const root = await page({ description: \"A UNIQUE DESCRIPTION\", oemNumber: \"34116792217\" }); const { left, right } = columns(root);\n    const columnText = textOf(right); expect(columnText).not.toContain(\"A UNIQUE DESCRIPTION\"); expect(columnText).not.toContain(\"34116792217\"); expect(columnText).not.toMatch(/OEM number/i);\n    const card = find(left, ProductDetails)!; expect(card.props.product).toMatchObject({ description: \"A UNIQUE DESCRIPTION\", oemNumber: \"34116792217\" });\n  });\n", "  it(\"the part number is NOT in the column (it is in the specifications card); the description is in the column AND in the card\", async () => {\n    const root = await page({ description: \"A UNIQUE DESCRIPTION\", oemNumber: \"34116792217\" }); const { left, right } = columns(root);\n    const columnText = textOf(right); expect(columnText).toContain(\"A UNIQUE DESCRIPTION\"); expect(columnText).not.toContain(\"34116792217\"); expect(columnText).not.toMatch(/OEM number/i);\n    const card = find(left, ProductDetails)!; expect(card.props.product).toMatchObject({ description: \"A UNIQUE DESCRIPTION\", oemNumber: \"34116792217\" });\n  });\n"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'product-description-tests-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'product-description-tests-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-product-description-tests`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
