#!/usr/bin/env node
/**
 * Supplier portal in Chinese, the remaining English: the order status breakdown ("pending", "shipped" ...), the order statuses that had no
 * name (cancelled, refused, returned ...), the part request statuses, and product names (the Chinese original in Chinese).
 * Apply after patch-supplier-chinese.js.
 *
 *   node scripts/patch-supplier-chinese-2.js            dry run
 *   node scripts/patch-supplier-chinese-2.js --write    applies it (App.jsx is saved as App.jsx.before-supplier-chinese-2 first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"order statuses (and the status breakdown), part request statuses and product names in Chinese","done":"const statusName = (k) =>","pairs":[["    statusOrder: { pending: \"待确认\", preparing: \"备货中\", shipped: \"已发货\", delivered: \"已送达\", dispute: \"异常/纠纷\" },","    statusOrder: { pending: \"待确认\", preparing: \"备货中\", shipped: \"已发货\", delivered: \"已送达\", dispute: \"异常/纠纷\", cancelled: \"已取消\", canceled: \"已取消\", refused: \"已拒绝\", returned: \"已退货\", accepted: \"已接单\", in_transit: \"运输中\", at_hub: \"已到质检中心\", completed: \"已完成\" },"],["    statusOrder: { pending: \"Pending\", preparing: \"Preparing\", shipped: \"Shipped\", delivered: \"Delivered\", dispute: \"Dispute\" },","    statusOrder: { pending: \"Pending\", preparing: \"Preparing\", shipped: \"Shipped\", delivered: \"Delivered\", dispute: \"Dispute\", cancelled: \"Cancelled\", canceled: \"Cancelled\", refused: \"Refused\", returned: \"Returned\", accepted: \"Accepted\", in_transit: \"In transit\", at_hub: \"At the hub\", completed: \"Completed\" },"],["function SupplierAnalyticsSection({ analytics, lang, part = \"all\" }) {\n","function SupplierAnalyticsSection({ analytics, lang, part = \"all\" }) {\n  // An order status in the supplier's language (the order lists use the same names).\n  const { t } = useLang();\n  const statusName = (k) => (t && t.statusOrder && t.statusOrder[k]) || String(k).replace(/_/g, \" \");\n"],["textTransform: \"capitalize\" }}>{r.status}</span>","textTransform: \"capitalize\" }}>{(lang === \"zh\" ? { submitted: \"待报价\", quoted: \"已报价\", ordered: \"已下单\" } : { submitted: \"Submitted\", quoted: \"Quoted\", ordered: \"Ordered\" })[r.status] || r.status}</span>"],["<Td style={{ fontWeight: 700 }}>{p.name}</Td>","<Td style={{ fontWeight: 700 }}>{lang === \"zh\" ? p.nameZh || p.name : p.name}</Td>"],["<div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{product.name}</div>","<div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{lang === \"zh\" ? product.nameZh || product.name : product.name}</div>"],["{s.status.replace(/_/g, \" \")}</span>\n","{statusName(s.status)}</span>\n"]]}],"created":[]};
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
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (a0.startsWith('{s.status.replace')) { if (out.split(a).length !== 3) { out = null; break; } out = out.split(a).join(b); continue; } if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-supplier-chinese-2`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Reload the supplier portal with Ctrl+F5.');
