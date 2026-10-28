#!/usr/bin/env node
/**
 * The cart summary's "You saved" line now counts the SHIPPING FEE the buyer does not pay when shipping is free (the free-shipping limit is reached, or a promo code waives it), not only the discount:
 * "You saved $13" with "Discount $8 . Free shipping $5" under it, or "You saved $5" with "Free shipping" when there is no discount (the line used to appear only with a discount).
 * Needs the free shipping patches (patch-free-shipping*.js). Run it AFTER patch-ui-round4.js. No server change, no migration.
 *
 *   node scripts/patch-you-saved.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-you-saved.js --write    applies it (each changed file is saved as <file>.before-you-saved first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/cart.ts", "what": "the totals also say how much shipping fee the buyer did not pay (shippingSaved) and the whole saving (saved)", "done": "shippingSaved", "pairs": [["  return {\n    subtotal: sub,\n    discount,", "  // What the buyer did NOT pay in shipping: the fee of a small order, when shipping is free (the limit was reached or a promo code waives it). 0 when a fee is charged or the rule is off.\n  const sh = cart.shipping;\n  const fullFee = Number(sh?.feeUsd ?? 0);\n  const shippingSaved = sh && sh.enabled && Number(sh.chargedUsd ?? 0) === 0 && Number.isFinite(fullFee) && fullFee > 0 && (sh.qualifies || sh.waivedByPromo) ? fullFee : 0;\n  return {\n    subtotal: sub,\n    discount,"], ["    total: goods + shippingFee,\n", "    total: goods + shippingFee,\n    shippingSaved,\n    saved: discount + shippingSaved,                      // \"You saved\": the discount and the shipping fee not paid\n"]]}, {"file": "apps/web-storefront/app/cart/page.tsx", "what": "the cart summary's You saved line counts the free shipping too, with the split under it (and appears with free shipping alone)", "done": "you-saved-detail", "pairs": [["          {summary.discount > 0 && <p className=\"mt-1 text-sm font-semibold text-[#0f6b49]\">{t(\"you_saved\")} <Price usd={summary.discount} /></p>}", "          {summary.saved > 0 && (\n            <>\n              <p data-testid=\"you-saved\" className=\"mt-1 text-sm font-semibold text-[#0f6b49]\">{t(\"you_saved\")} <Price usd={summary.saved} /></p>\n              {summary.shippingSaved > 0 && <p data-testid=\"you-saved-detail\" className=\"text-[12.5px] text-muted\">{summary.discount > 0 ? t(\"saved_breakdown\", { discount: format(summary.discount), shipping: format(summary.shippingSaved) }) : t(\"saved_free_shipping\")}</p>}\n            </>\n          )}"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words for the split under You saved (English and Arabic)", "done": "saved_breakdown", "pairs": [["  you_saved: \"You saved\",", "  you_saved: \"You saved\",\n  saved_breakdown: \"Discount {discount} · Free shipping {shipping}\",\n  saved_free_shipping: \"Free shipping\","], ["  you_saved: \"وفّرت\",", "  you_saved: \"وفّرت\",\n  saved_breakdown: \"الخصم {discount} · الشحن المجاني {shipping}\",\n  saved_free_shipping: \"الشحن المجاني\","]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'you-saved-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'you-saved-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-you-saved`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
