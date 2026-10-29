#!/usr/bin/env node
/**
 * Mobile app: in Arabic the order details screen asks the server for the Arabic product names (GET /order/:id?lang=ar). English is unchanged. Needs the server package (patch-order-names-ar.js).
 * I cannot run Flutter: please run flutter analyze and flutter test, then try it.
 *
 *   node scripts/patch-order-names-ar-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-names-ar-app.js --write    applies it (each changed file is saved as <file>.before-order-names-ar-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/services/api_client.dart", "what": "the app's order details call can ask for the Arabic product names", "done": "if (lang == 'ar') 'lang': 'ar'", "pairs": [["  Future<Map<String, dynamic>> fetchOrderDetail(String? token, String orderId, {String? guestEmail}) async {", "  Future<Map<String, dynamic>> fetchOrderDetail(String? token, String orderId, {String? guestEmail, String? lang}) async {"], ["    final uri = Uri.parse('$baseUrl/order/$orderId').replace(\n      queryParameters: guestEmail != null ? {'guestEmail': guestEmail} : null,", "    final uri = Uri.parse('$baseUrl/order/$orderId').replace(\n      queryParameters: (guestEmail != null || lang == 'ar') ? {if (guestEmail != null) 'guestEmail': guestEmail, if (lang == 'ar') 'lang': 'ar'} : null,"]]}, {"file": "apps/mobile/lib/features/orders/order_detail_screen.dart", "what": "the order details screen asks in the app's language", "done": "lang: lang);", "pairs": [["      final order = await ApiClient().fetchOrderDetail(auth.token, widget.orderId, guestEmail: widget.guestEmail);", "      final lang = context.read<LanguageState>().isArabic ? 'ar' : 'en'; // read BEFORE the await below\n      final order = await ApiClient().fetchOrderDetail(auth.token, widget.orderId, guestEmail: widget.guestEmail, lang: lang);"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'order-names-ar-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'order-names-ar-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-order-names-ar-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
