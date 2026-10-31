#!/usr/bin/env node
/**
 * Fix for patch-delete-rule.js: "column oli.order_id does not exist". An order line links to its order through its supplier part
 * (order_line_items.sub_order_id -> supplier_sub_orders.order_id).
 *
 *   node scripts/patch-delete-rule-2.js            dry run
 *   node scripts/patch-delete-rule-2.js --write    applies it
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"services/api/src/modules/catalog/productDelete.js","what":"the delete check joins an order line to its order through the supplier part (order_line_items has no order_id)","done":"-- an order line belongs to a supplier's part of the order","pairs":[["     FROM order_line_items oli\n     JOIN orders o ON o.id = oli.order_id\n     LEFT JOIN supplier_sub_orders so ON so.id = oli.sub_order_id\n     LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id","     FROM order_line_items oli\n     JOIN supplier_sub_orders so ON so.id = oli.sub_order_id      -- an order line belongs to a supplier's part of the order\n     JOIN orders o ON o.id = so.order_id\n     LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id"]]}],"created":[]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-delete-rule-2`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Check: node scripts\\diag-delete.js  then restart (scripts\\start-all.cmd).');
