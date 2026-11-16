#!/usr/bin/env node
/**
 * A part the hub found a problem with is DONE once its case is finished (replacement delivered, refund marked, or closed by hand).
 * Run AFTER patch-buyer-fault-tracking and patch-hub-inbound-redesign.
 *   Admin > Orders: the bar is full, "Replaced -> LP-...-R1" / "Refunded" / "Closed"; the hub status reads "Closed"; the order is no longer counted
 *   as not delivered or late; a "Replaced / refunded" filter. While the case is open: a red "Problem at hub".
 *   Website > My orders: such an order shows Replaced (-> the new order) / Refunded / Closed.
 *   Hub portal > Inbound shipments: the filter pills wrap onto two lines, no sideways scroll bar.
 *   node scripts/patch-orders-fault-done.js            dry run
 *   node scripts/patch-orders-fault-done.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/order/routes.js", "what": "orders: a part whose hub-found fault is finished counts as done; orders: the admin's bar says how the order ended (Replaced -> R1 / Refunded / Closed), or 'Problem at hub' while it is open; orders: the finished part counts as the last step; orders: how each order ended, for the admin and the buyer; ", "done": "// patch-orders-fault-done: a part the hub found a problem with is DONE once its case is finished (replacement delivered, refund marked, or closed", "pairs": [["const ORDER_STEPS = ['Placed', 'Supplier accepted', 'Shipped to hub', 'At hub', 'Inspected & packed', 'Shipped to buyer', 'Delivered'];", "const ORDER_STEPS = ['Placed', 'Supplier accepted', 'Shipped to hub', 'At hub', 'Inspected & packed', 'Shipped to buyer', 'Delivered'];\n// patch-orders-fault-done: a part the hub found a problem with is DONE once its case is finished (replacement delivered, refund marked, or closed\n// by hand): it no longer keeps the order at \"At hub\" (50%) and \"not delivered\" for ever.\nconst FAULT_HUB = ['flagged', 'returned_to_supplier', 'discarded_at_hub'];\nasync function faultEndingsByOrder(orderIds) {\n  const out = {};\n  if (!orderIds.length) return out;\n  const { rows } = await db.query(\n    `SELECT so.order_id, so.status AS part_status, (to_jsonb(so) ->> 'refused_at') IS NOT NULL AS refused, hs.status AS hub_status, hs.resolved_at,\n            fc.outcome, fc.replacement_order_id\n     FROM supplier_sub_orders so\n     LEFT JOIN hub_shipments hs ON hs.sub_order_id = so.id\n     LEFT JOIN LATERAL (SELECT f.outcome, f.replacement_order_id FROM fault_cases f WHERE f.sub_order_id = so.id ORDER BY f.created_at DESC LIMIT 1) fc ON true\n     WHERE so.order_id = ANY($1::text[])`,\n    [orderIds]\n  );\n  for (const r of rows) {\n    const e = out[r.order_id] || (out[r.order_id] = { active: 0, done: 0, endings: [], problem: false });\n    if (r.part_status === 'cancelled' || r.refused) continue;\n    e.active++;\n    const fault = FAULT_HUB.includes(r.hub_status);\n    if (fault && r.resolved_at) {\n      e.done++;\n      e.endings.push(r.outcome === 'replacement' && r.replacement_order_id ? { kind: 'replaced', orderId: r.replacement_order_id } : r.outcome === 'refund' ? { kind: 'refunded' } : { kind: 'closed' });\n    } else if (fault) e.problem = true;\n    else if (r.hub_status === 'delivered') e.done++;\n  }\n  for (const e of Object.values(out)) {\n    const kinds = e.endings.map((x) => x.kind);\n    e.finished = e.active > 0 && e.done === e.active && e.endings.length > 0;\n    e.ending = !e.finished ? null : kinds.includes('replaced') ? 'replaced' : kinds.includes('refunded') ? 'refunded' : 'closed';\n    e.replacementOrderIds = e.endings.filter((x) => x.kind === 'replaced').map((x) => x.orderId);\n  }\n  return out;\n}", false], ["function adminListExtras(o, p, buyerNames) {\n  const cancelled = o.status === 'cancelled' || !p || p.active === 0;\n  const step = cancelled ? 0 : Math.min(...p.steps);\n  return {\n    buyerName: o.buyer_id ? (buyerNames[o.buyer_id] || null) : null,\n    progress: { step, percent: cancelled ? 0 : Math.round((step / (ORDER_STEPS.length - 1)) * 100), label: cancelled ? 'Cancelled' : ORDER_STEPS[step], cancelled, flagged: Boolean(p && p.flagged) },", "function adminListExtras(o, p, buyerNames, f = null) {\n  const cancelled = o.status === 'cancelled' || !p || p.active === 0;\n  const step = cancelled ? 0 : Math.min(...p.steps);\n  let label = cancelled ? 'Cancelled' : ORDER_STEPS[step];\n  if (!cancelled && f && step === ORDER_STEPS.length - 1 && f.endings.length) {\n    const kinds = f.endings.map((x) => x.kind);\n    const ending = kinds.includes('replaced') ? `Replaced → ${f.replacementOrderIds.join(', ')}` : kinds.includes('refunded') ? 'Refunded' : 'Closed';\n    label = f.endings.length === f.active ? ending : `Delivered · ${ending}`;\n  } else if (!cancelled && f && f.problem && step === 3) label = 'Problem at hub';\n  return {\n    buyerName: o.buyer_id ? (buyerNames[o.buyer_id] || null) : null,\n    progress: { step, percent: cancelled ? 0 : Math.round((step / (ORDER_STEPS.length - 1)) * 100), label, cancelled, flagged: Boolean(p && p.flagged) || Boolean(f && f.problem), ended: f && f.finished ? f.ending : null },", false], ["        e.steps.push(orderPartStep(p.part_status, p.hub_status));", "        e.steps.push(p.resolved_at && FAULT_HUB.includes(p.hub_status) ? ORDER_STEPS.length - 1 : orderPartStep(p.part_status, p.hub_status));      // a finished fault case = done", false], ["    const withDisplayStatus = await Promise.all(rows.map(async (o) => {", "    const endingsByOrder = await faultEndingsByOrder(orderIds);      // patch-orders-fault-done\n    const withDisplayStatus = await Promise.all(rows.map(async (o) => {", false], ["        ...(isAdmin ? adminListExtras(o, progressByOrder[o.id], buyerNames) : {}),", "        // 'replaced' / 'refunded' / 'closed' once every part is done and at least one ended through a hub-found fault (patch-orders-fault-done)\n        faultEnding: endingsByOrder[o.id]?.ending || null,\n        replacementOrderIds: endingsByOrder[o.id]?.ending ? endingsByOrder[o.id].replacementOrderIds : [],\n        ...(isAdmin ? adminListExtras(o, progressByOrder[o.id], buyerNames, endingsByOrder[o.id] || null) : {}),", false], ["  for (const row of rows) { if (row.status === 'flagged' && row.resolved_at) row.status = 'closed'; }", "  for (const row of rows) { if (['flagged', 'returned_to_supplier', 'discarded_at_hub'].includes(row.status) && row.resolved_at) row.status = 'closed'; }      // + returned / discarded (patch-orders-fault-done)", false]]}, {"file": "services/api/src/modules/adminCounts/service.js", "what": "side menu: an order whose faulty part is finished is not 'not delivered' or 'late'; side menu: the same for the count", "done": "                AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND (hs.status = 'delivered' OR (hs.resolved_at IS NOT NULL AND hs.status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')))))) AS late", "pairs": [["                AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))) AS late", "                AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND (hs.status = 'delivered' OR (hs.resolved_at IS NOT NULL AND hs.status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')))))) AS late", false], ["           AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))`", "           AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND (hs.status = 'delivered' OR (hs.resolved_at IS NOT NULL AND hs.status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')))))`", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "admin Orders: a 'Replaced / refunded' filter; admin Orders: the filter button; admin Orders: those orders are not 'disputes' any more", "done": "    if (f === \"ended\") return Boolean(o.progress && o.progress.ended);      // finished through a hub-found fault (patch-orders-fault-done)", "pairs": [["  const matches = (o, f) => {\n    if (f === \"all\") return true;", "  const matches = (o, f) => {\n    if (f === \"all\") return true;\n    if (f === \"ended\") return Boolean(o.progress && o.progress.ended);      // finished through a hub-found fault (patch-orders-fault-done)", false], ["[\"delivered\", \"Delivered\"], [\"dispute\", \"Disputes\"],", "[\"delivered\", \"Delivered\"], [\"ended\", \"Replaced / refunded\"], [\"dispute\", \"Disputes\"],", false], ["    if (f === \"dispute\") return o.hubStatus === \"flagged\";", "    if (f === \"dispute\") return o.hubStatus === \"flagged\" || o.hubStatus === \"returned_to_supplier\" || o.hubStatus === \"discarded_at_hub\";      // open fault cases only: finished ones read \"closed\"", false]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "website: how an order ended", "done": "  faultEnding?: \"replaced\" | \"refunded\" | \"closed\" | null;      // patch-orders-fault-done", "pairs": [["export interface OrderSummary {\n  id: string;\n  status: string;\n  displayStatus: string;", "export interface OrderSummary {\n  id: string;\n  status: string;\n  displayStatus: string;\n  faultEnding?: \"replaced\" | \"refunded\" | \"closed\" | null;      // patch-orders-fault-done\n  replacementOrderIds?: string[];", false]]}, {"file": "apps/web-storefront/app/orders/page.tsx", "what": "my orders: Replaced / Refunded / Closed", "done": "                        {o.faultEnding ? (", "pairs": [["                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${shown === \"delivered\" ? \"bg-[#e3f2ea] text-[#0f6b49]\" : \"bg-[#fdf1d6] text-[#7a4e00]\"}`}>{statusLabel(lang, shown)}</span>", "                        {o.faultEnding ? (\n                          <span className=\"rounded-full bg-[#e3f2ea] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#0f6b49]\">\n                            {lang === \"ar\" ? { replaced: \"تم الاستبدال\", refunded: \"تم الاسترداد\", closed: \"مغلق\" }[o.faultEnding] : { replaced: \"Replaced\", refunded: \"Refunded\", closed: \"Closed\" }[o.faultEnding]}\n                            {o.faultEnding === \"replaced\" && o.replacementOrderIds?.length ? <span className=\"ms-1 font-plate normal-case\" dir=\"ltr\">→ {o.replacementOrderIds.join(\", \")}</span> : null}\n                          </span>\n                        ) : (\n                        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${shown === \"delivered\" ? \"bg-[#e3f2ea] text-[#0f6b49]\" : \"bg-[#fdf1d6] text-[#7a4e00]\"}`}>{statusLabel(lang, shown)}</span>\n                        )}", false]]}, {"file": "apps/hub-portal/src/App.jsx", "what": "Inbound shipments: the filter pills wrap onto two lines (no sideways scroll bar); Inbound shipments: slightly smaller pills", "done": "      <div style={{ display: \"flex\", flexWrap: \"wrap\", gap: 6, padding: \"12px 14px\", background: C.card, borderBottom: `1px solid ${C.line}` }}>", "pairs": [["      <div style={{ display: \"flex\", gap: 6, padding: \"12px 16px\", overflowX: \"auto\", background: C.card, borderBottom: `1px solid ${C.line}` }}>", "      <div style={{ display: \"flex\", flexWrap: \"wrap\", gap: 6, padding: \"12px 14px\", background: C.card, borderBottom: `1px solid ${C.line}` }}>", false], ["              ...body, display: \"inline-flex\", alignItems: \"center\", gap: 7, height: 32, padding: \"0 12px\", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\", whiteSpace: \"nowrap\",", "              ...body, display: \"inline-flex\", alignItems: \"center\", gap: 6, height: 30, padding: \"0 11px\", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\", whiteSpace: \"nowrap\",", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    for (const [re, rep, min] of e.regex || []) { const r = new RegExp(re, 'g'); const n = (out.match(r) || []).length; if (n < min) return { why: `this part was not found: "${re.replace(/\\/g, '').slice(0, 70)}"` }; out = out.replace(r, rep); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-orders-fault-done`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then restart the API (cd services\\api ; npm run dev, one API window; no migration) and refresh the admin, the website and the hub portal with Ctrl+F5.");
