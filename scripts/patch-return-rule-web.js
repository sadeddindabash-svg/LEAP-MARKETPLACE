#!/usr/bin/env node
/**
 * Website: "Request a return" on the order page appears for a part only while it can be returned: not for a cancelled part or a cancelled order, and not once the part was delivered and the return window the admin sets (3 to 7 days) has passed.
 * It follows the server's answer (returnable) and, for an older server that sends none, the cancelled rule. Needs the server package (patch-return-rule.js). Run it AFTER the other storefront patches.
 *
 *   node scripts/patch-return-rule-web.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-return-rule-web.js --write    applies it (each changed file is saved as <file>.before-return-rule-web first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/api.ts", "what": "the order's part says whether it can still be returned", "done": "returnUntil?: string | null;", "pairs": [["  hubShipment: HubShipment | null;\n", "  hubShipment: HubShipment | null;\n  /** Can this part still be returned? (the server: cancelled no; not delivered yes; delivered until the delivery date plus the admin's return window). Absent from an older server. */\n  returnable?: boolean;\n  returnUntil?: string | null;\n"]]}, {"file": "apps/web-storefront/lib/orders.ts", "what": "the rule for showing \"Request a return\"", "done": "export function isPartReturnable", "pairs": [["/** The tracking page is offered while a part that is still going has not been delivered: never for an order that is over, and a cancelled part does not count as \"not delivered yet\". */", "/** \"Request a return\" is offered for a part only while it can be returned: never for a cancelled part or a cancelled order, and not once the server says the return window after delivery has passed (an older server says nothing: only the cancelled rule applies). */\nexport function isPartReturnable(order: { status?: string; supplierSubOrders?: Array<{ status: string }> }, part: { status: string; returnable?: boolean }): boolean {\n  if (isOrderFullyCancelled(order) || part.status === \"cancelled\") return false;\n  return part.returnable !== false;\n}\n\n/** The tracking page is offered while a part that is still going has not been delivered: never for an order that is over, and a cancelled part does not count as \"not delivered yet\". */"]]}, {"file": "apps/web-storefront/app/orders/[id]/page.tsx", "what": "the order page offers \"Request a return\" only while the part can be returned", "done": "isPartReturnable(order, so) && <button", "pairs": [["isOrderFullyCancelled, isSubOrderCancellable, needsEnglishAddressCheck", "isOrderFullyCancelled, isPartReturnable, isSubOrderCancellable, needsEnglishAddressCheck"], ["{order.status !== \"cancelled\" && <button type=\"button\" className={outline} aria-expanded={returning}", "{isPartReturnable(order, so) && <button type=\"button\" className={outline} aria-expanded={returning}"], ["{returning && <ReturnRequestForm", "{returning && isPartReturnable(order, so) && <ReturnRequestForm"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'return-rule-web-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'return-rule-web-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-return-rule-web`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
