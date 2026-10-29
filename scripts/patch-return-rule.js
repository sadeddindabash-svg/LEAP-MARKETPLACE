#!/usr/bin/env node
/**
 * SERVER: "Request a return" follows ONE rule. The order details give each supplier part { returnable, returnUntil } (a cancelled part or order: not returnable; not delivered yet: returnable; delivered: returnable until the delivery date
 * plus the return window the admin sets, 3 to 7 days), and filing a return for a cancelled part or order is refused (400). Needs services/api/src/modules/returns/returnRules.js from the same package. No migration. Restart the backend.
 *
 *   node scripts/patch-return-rule.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-return-rule.js --write    applies it (each changed file is saved as <file>.before-return-rule first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/order/routes.js", "what": "the order details say whether each part can still be returned (returnable, returnUntil)", "done": "...returnState({", "pairs": [["const { emailLanguageForAddress, emailSubject } = require('../email/language');", "const { emailLanguageForAddress, emailSubject } = require('../email/language');\nconst { readReturnWindowDays, returnState } = require('../returns/returnRules');"], ["    const supplierLabelMap = buildSupplierLabelMap(subOrders.map((so) => so.supplier_id), req.params.id);\n", "    const supplierLabelMap = buildSupplierLabelMap(subOrders.map((so) => so.supplier_id), req.params.id);\n    const returnWindowDays = await readReturnWindowDays(db);      // the admin's return window: whether each part can still be returned\n"], ["        hubShipment,\n        items: itemsWithImages,\n      });", "        hubShipment,\n        // Can this part still be returned? (cancelled: no; not delivered: yes; delivered: until the delivery date plus the admin's return window)\n        ...returnState({ subOrderStatus: so.status, orderStatus: order.status, deliveredAt: shipmentRows[0]?.delivered_at || null, windowDays: returnWindowDays }),\n        items: itemsWithImages,\n      });"]]}, {"file": "services/api/src/modules/returns/routes.js", "what": "filing a return for a cancelled part or order is refused", "done": "A cancelled order cannot be returned.", "pairs": [["`SELECT so.id, so.order_id, hs.delivered_at\n       FROM supplier_sub_orders so\n       LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id\n       WHERE so.id = $1`,", "`SELECT so.id, so.order_id, so.status AS sub_order_status, o.status AS order_status, hs.delivered_at\n       FROM supplier_sub_orders so\n       JOIN orders o ON o.id = so.order_id\n       LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id\n       WHERE so.id = $1`,"], ["    const deliveredAt = subOrderCheck.rows[0].delivered_at;\n", "    const deliveredAt = subOrderCheck.rows[0].delivered_at;\n    if (subOrderCheck.rows[0].sub_order_status === 'cancelled' || subOrderCheck.rows[0].order_status === 'cancelled') {\n      await client.query('ROLLBACK');\n      return res.status(400).json({ error: 'A cancelled order cannot be returned.' });\n    }\n"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'return-rule-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'return-rule-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-return-rule`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
