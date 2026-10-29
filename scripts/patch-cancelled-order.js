#!/usr/bin/env node
/**
 * Website, the buyer's order page: an order that is OVER for good (cancelled, or every part cancelled: for example the supplier refused it and no other supplier could supply it) no longer offers
 * "Check your address in English", "Track your package" or "Download receipt" (nothing will be shipped, nothing was charged). A mixed order (one part cancelled, another still going) keeps them for the parts that are going.
 * No server change, no migration. Run it from the project folder.
 *
 *   node scripts/patch-cancelled-order.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-cancelled-order.js --write    applies it (each changed file is saved as <file>.before-cancelled-order first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/orders.ts", "what": "an order that is over for good no longer needs an address check or tracking", "done": "isOrderFullyCancelled", "pairs": [["/** The English version of the address is only a machine's guess (\"auto\") until the buyer confirms it: then they are asked to check it. */\nexport function needsEnglishAddressCheck(order: Pick<OrderDetail, \"address\" | \"addressEnglish\">): boolean {\n  return order.address != null && order.addressEnglish != null && order.addressEnglish.source === \"auto\";\n}", "/**\n * The order is OVER for good: it is cancelled, or every one of its parts is (for example the only supplier refused it and nobody else could supply it). Nothing will be shipped and nothing was charged,\n * so there is nothing to check, track or give a receipt for. (An order with a part still going is not over: the other parts continue.)\n */\nexport function isOrderFullyCancelled(order: { status?: string; supplierSubOrders?: Array<{ status: string }> }): boolean {\n  if (order.status === \"cancelled\") return true;\n  const parts = order.supplierSubOrders ?? [];\n  return parts.length > 0 && parts.every((so) => so.status === \"cancelled\");\n}\n\n/** The English version of the address is only a machine's guess (\"auto\") until the buyer confirms it: then they are asked to check it (not for an order that is over). */\nexport function needsEnglishAddressCheck(order: Pick<OrderDetail, \"address\" | \"addressEnglish\"> & { status?: string; supplierSubOrders?: Array<{ status: string }> }): boolean {\n  return order.address != null && order.addressEnglish != null && order.addressEnglish.source === \"auto\" && !isOrderFullyCancelled(order);\n}"], ["/** The tracking page is offered until every part has been delivered. */\nexport function showTrackingLink(order: Pick<OrderDetail, \"supplierSubOrders\">): boolean {\n  const parts = order.supplierSubOrders;\n  return parts.length > 0 && !parts.every((so) => subOrderStage(so) === \"delivered\");\n}", "/** The tracking page is offered while a part that is still going has not been delivered: never for an order that is over, and a cancelled part does not count as \"not delivered yet\". */\nexport function showTrackingLink(order: Pick<OrderDetail, \"supplierSubOrders\"> & { status?: string }): boolean {\n  if (isOrderFullyCancelled(order)) return false;\n  const going = order.supplierSubOrders.filter((so) => so.status !== \"cancelled\");\n  return going.length > 0 && !going.every((so) => subOrderStage(so) === \"delivered\");\n}"]]}, {"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "the order page treats an order whose every part is cancelled as cancelled, and offers no receipt for it", "done": "isOrderFullyCancelled", "pairs": [["isSubOrderCancellable, needsEnglishAddressCheck", "isOrderFullyCancelled, isSubOrderCancellable, needsEnglishAddressCheck"], ["const cancelled = order.status === \"cancelled\";", "const cancelled = isOrderFullyCancelled(order);"], ["<button type=\"button\" className={outline} disabled={busy} onClick={downloadReceipt}>{t(\"download_receipt\")}</button>", "{!cancelled && <button type=\"button\" className={outline} disabled={busy} onClick={downloadReceipt}>{t(\"download_receipt\")}</button>}"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'cancelled-order-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'cancelled-order-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-cancelled-order`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
