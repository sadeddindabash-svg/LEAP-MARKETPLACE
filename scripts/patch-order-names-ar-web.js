#!/usr/bin/env node
/**
 * Website: in Arabic the order page asks the server for the Arabic product names (GET /order/:id?lang=ar), so the items of an order, and the cancel-a-part and return screens that read the same details, show Arabic names.
 * English is unchanged. Needs the server package (patch-order-names-ar.js).
 *
 *   node scripts/patch-order-names-ar-web.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-names-ar-web.js --write    applies it (each changed file is saved as <file>.before-order-names-ar-web first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/api.ts", "what": "the order fetch can ask for the Arabic product names", "done": "guestEmail?: string | null, lang?: Lang) =>\n  orderCall<OrderDetail>(", "pairs": [["export const fetchOrderById = (token: string | null, orderId: string, guestEmail?: string | null) =>\n  orderCall<OrderDetail>(`/${encodeURIComponent(orderId)}`, { token, guestEmail }, {}, \"Failed to load order\");", "export const fetchOrderById = (token: string | null, orderId: string, guestEmail?: string | null, lang?: Lang) =>\n  orderCall<OrderDetail>(`/${encodeURIComponent(orderId)}`, { token, guestEmail }, { query: lang === \"ar\" ? { lang: \"ar\" } : {} }, \"Failed to load order\");"]]}, {"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "the order page asks for the order in the page's language", "done": "fetchOrderById(token, orderId, token ? null : guestEmail, lang)", "pairs": [["fetchOrderById(token, orderId, token ? null : guestEmail)", "fetchOrderById(token, orderId, token ? null : guestEmail, lang)"], ["}, [authLoading, canSee, token, orderId, guestEmail, reloads]);", "}, [authLoading, canSee, token, orderId, guestEmail, reloads, lang]);"]]}, {"file": "apps/web-storefront/app/stage3a-pages.test.tsx", "what": "the older order page tests expect the language (English) as the last argument of the order fetch", "done": "toHaveBeenCalledWith(\"tok\", \"ord_1\", null, \"en\")", "pairs": [["expect(m.api.fetchOrderById).toHaveBeenCalledWith(\"tok\", \"ord_1\", null);", "expect(m.api.fetchOrderById).toHaveBeenCalledWith(\"tok\", \"ord_1\", null, \"en\");"], ["expect(m.api.fetchOrderById).toHaveBeenCalledWith(null, \"ord_1\", \"sam@example.com\");", "expect(m.api.fetchOrderById).toHaveBeenCalledWith(null, \"ord_1\", \"sam@example.com\", \"en\");"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'order-names-ar-web-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'order-names-ar-web-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-order-names-ar-web`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
