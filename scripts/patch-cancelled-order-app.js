#!/usr/bin/env node
/**
 * Mobile app, the buyer's order screen: an order that is OVER for good (cancelled, or every part cancelled: for example the only supplier refused it and nobody else could supply it) no longer offers
 * "Check your address in English", "Track your package" or "Download receipt". An order with a part still going keeps them. I cannot run Flutter: please run flutter analyze and flutter test, then try it.
 * Needs lib/models/order_rules.dart from the same package.
 *
 *   node scripts/patch-cancelled-order-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-cancelled-order-app.js --write    applies it (the changed file is saved as <file>.before-cancelled-order-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/features/orders/order_detail_screen.dart", "what": "an order that is over for good offers no address check, no tracking and no receipt", "done": "isOrderFullyCancelled", "pairs": [["import '../../widgets/order_status_timeline.dart';", "import '../../widgets/order_status_timeline.dart';\nimport '../../models/order_rules.dart';"], ["    return _order?['address'] != null && english is Map<String, dynamic> && english['source'] == 'auto';", "    return _order?['address'] != null && english is Map<String, dynamic> && english['source'] == 'auto' && !isOrderFullyCancelled(_order);      // not for an order that is over"], ["if (subOrders.isNotEmpty && !subOrders.every((so) => _buyerFacingStage(so) == 'delivered'))", "if (showsTrackingButton(_order, subOrders, _buyerFacingStage))"], ["          OutlinedButton.icon(\n            onPressed: () async {\n              final auth = context.read<AuthState>();", "          if (showsReceiptButton(_order))\n          OutlinedButton.icon(\n            onPressed: () async {\n              final auth = context.read<AuthState>();"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'cancelled-order-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'cancelled-order-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-cancelled-order-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
