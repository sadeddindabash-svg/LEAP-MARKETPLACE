#!/usr/bin/env node
/**
 * OPTIONAL companion of patch-free-shipping.js: the amount SUGGESTED for a refund when a faulty part is refunded is worked out from what the buyer paid for the GOODS (the shipping fee of a small order is not part of it), so a faulty part
 * is not refunded a share of the shipping fee by default. The admin can still refund more, up to the whole order total. Run it AFTER patch-free-shipping.js (it needs migration 111).
 *
 *   node scripts/patch-free-shipping-refunds.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-free-shipping-refunds.js --write    applies it (the changed file is saved as <file>.before-free-shipping-refunds first)
 *
 * A file that is not exactly what the patch expects is NOT changed. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/faultCases/helpers.js", "what": "the suggested refund is worked out from what was paid for the goods (not the shipping fee); computeRefundSuggestion is exported so it can be tested", "done": "o.shipping_fee", "pairs": [["    `SELECT o.total,\n            (SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0)", "    // What the buyer paid for the GOODS: the order total less the shipping fee of a small order (orders.shipping_fee, migration 111), which is not part of the goods' price.\n    `SELECT (o.total - COALESCE(o.shipping_fee, 0)) AS total,\n            (SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0)"], ["  toAdminDto, toHubDto, sendNotifications,\n};", "  toAdminDto, toHubDto, sendNotifications, computeRefundSuggestion,\n};"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'free-shipping-refunds-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'free-shipping-refunds-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-free-shipping-refunds`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
