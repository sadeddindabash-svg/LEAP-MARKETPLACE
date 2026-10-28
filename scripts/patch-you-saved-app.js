#!/usr/bin/env node
/**
 * Mobile app, checkout summary: the "You saved" row also counts the SHIPPING FEE the buyer does not pay when shipping is free, with the split under the label ("Discount $8 . Free shipping $5", or "Free shipping" when there is no discount; the row now also appears with free shipping alone).
 * Needs patch-free-shipping-app.js. I cannot run Flutter: please run flutter analyze and flutter test, then try it (see docs/YOU-SAVED.md).
 *
 *   node scripts/patch-you-saved-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-you-saved-app.js --write    applies it (each changed file is saved as <file>.before-you-saved-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/core/cart_state.dart", "what": "the cart state says how much shipping fee the buyer did not pay", "done": "shippingSaved", "pairs": [["  CartShipping get shipping => _shipping;", "  CartShipping get shipping => _shipping;\n  // The shipping fee the buyer does NOT pay because shipping is free: \"You saved\" counts it.\n  double get shippingSaved => _shipping.savedUsd;"]]}, {"file": "apps/mobile/lib/features/checkout/checkout_screen.dart", "what": "the checkout's You saved row counts the free shipping, with the split under the label (and appears with free shipping alone)", "done": "saved_breakdown", "pairs": [["if (cart.totalSaved + cart.appliedDiscountUsd > 0) ...[", "if (cart.totalSaved + cart.appliedDiscountUsd + cart.shippingSaved > 0) ...["], ["formatPrice(context, cart.totalSaved + cart.appliedDiscountUsd), style:", "formatPrice(context, cart.totalSaved + cart.appliedDiscountUsd + cart.shippingSaved), style:"], ["                    mainAxisAlignment: MainAxisAlignment.spaceBetween,\n                    children: [\n                      Text(tr(context, 'you_saved'), style: TextStyle(color: LeapPalette.of(context).gauge, fontSize: 12.5, fontWeight: FontWeight.w600)),", "                    mainAxisAlignment: MainAxisAlignment.spaceBetween,\n                    crossAxisAlignment: CrossAxisAlignment.start,\n                    children: [\n                      Column(\n                        crossAxisAlignment: CrossAxisAlignment.start,\n                        children: [\n                          Text(tr(context, 'you_saved'), style: TextStyle(color: LeapPalette.of(context).gauge, fontSize: 12.5, fontWeight: FontWeight.w600)),\n                          if (cart.shippingSaved > 0)\n                            Text(\n                              cart.totalSaved + cart.appliedDiscountUsd > 0\n                                  ? tr(context, 'saved_breakdown').replaceAll('{discount}', formatPrice(context, cart.totalSaved + cart.appliedDiscountUsd)).replaceAll('{shipping}', formatPrice(context, cart.shippingSaved))\n                                  : tr(context, 'saved_free_shipping'),\n                              style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 11.5),\n                            ),\n                        ],\n                      ),"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words for the split under You saved (English and Arabic)", "done": "saved_breakdown", "pairs": [["    'you_saved': {'en': 'You saved', 'ar': 'وفّرت'},", "    'you_saved': {'en': 'You saved', 'ar': 'وفّرت'},\n    'saved_breakdown': {'en': 'Discount {discount} · Free shipping {shipping}', 'ar': 'الخصم {discount} · الشحن المجاني {shipping}'},\n    'saved_free_shipping': {'en': 'Free shipping', 'ar': 'الشحن المجاني'},"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'you-saved-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'you-saved-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-you-saved-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
