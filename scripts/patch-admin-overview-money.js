#!/usr/bin/env node
/**
 * Admin Overview: three more key numbers beside Total orders, Active suppliers, Open disputes and Open tickets.
 *   Total profit       all time, the same formula as Financial -> Profits (orders past their return window), with the margin and what is not final yet
 *   Owed to suppliers  what Leap must pay suppliers now (as Payouts counts it), how many suppliers, and what is not due yet
 *   Total products     every product, and how many are live
 * Each card opens its page. The two money cards only show for admins who may open Profits / Payouts. No database change.
 *   node scripts/patch-admin-overview-money.js            dry run
 *   node scripts/patch-admin-overview-money.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/auth/middleware.js", "what": "API: the page check can be asked directly (for the Overview's money figures)", "done": "requireOwner, hasPageAccess };", "pairs": [["module.exports = { signToken, requireAuth, optionalAuth, requireRole, requirePageAccess, requirePageAccessIfAdmin, requireOwner };", "module.exports = { signToken, requireAuth, optionalAuth, requireRole, requirePageAccess, requirePageAccessIfAdmin, requireOwner, hasPageAccess };", false]]}, {"file": "services/api/src/modules/profits/service.js", "what": "API: all-time profit, the same formula as Financial -> Profits", "done": "async function allTimeProfit", "pairs": [["module.exports = { profitReport, startOf, step, label, totalsOf, toPart, KINDS };", "// The admin Overview's \"Total profit\": the same formula as the report, over every part that is final by now (and every fault cost released so far).\nasync function allTimeProfit(db) {\n  const { rows: [clock] } = await db.query(`SELECT to_char(now() AT TIME ZONE '${TZ}', 'YYYY-MM-DD\"T\"HH24:MI:SS') AS now_local`);\n  const now = local(clock.now_local);\n  const { rows: partRows } = await db.query(PARTS_SQL, [ts(now)]);\n  const { rows: faultRows } = await db.query(FAULTS_SQL, ['1970-01-01 00:00:00', ts(now)]);\n  const t = totalsOf(partRows.map(toPart), faultRows.map(toFault));\n  const { rows: openRows } = await db.query(PARTS_SQL.replace(`< $1::timestamp`, `>= $1::timestamp`), [ts(now)]);\n  return { netProfit: r2(t.netProfit), margin: t.margin, expectedProfit: r2(totalsOf(openRows.map(toPart), []).netProfit) };\n}\n\nmodule.exports = { profitReport, allTimeProfit, startOf, step, label, totalsOf, toPart, KINDS };", false]]}, {"file": "services/api/src/modules/overview/routes.js", "what": "API: Overview adds total products, total profit and owed to suppliers", "done": "async function moneyAndProducts", "pairs": [["const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');", "const { requireAuth, requireRole, requirePageAccess, hasPageAccess } = require('../auth/middleware');", false], ["      topSuppliers: topSuppliers.rows.map((r) => ({ id: r.id, name: r.name, orderCount: Number(r.order_count) })),\n    });", "      topSuppliers: topSuppliers.rows.map((r) => ({ id: r.id, name: r.name, orderCount: Number(r.order_count) })),\n      ...(await moneyAndProducts(req)),\n    });", false], ["const router = express.Router();\n", "const router = express.Router();\n\n// Total products (all, and live), total profit (all time, as Financial -> Profits counts it) and what Leap owes suppliers now (as Payouts counts it).\n// The two money figures only go to an admin who may open that page. A figure that fails is left out; the page shows the rest.\nasync function moneyAndProducts(req) {\n  const out = {};\n  try {\n    const { rows: [p] } = await db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS live FROM products`);\n    out.totalProducts = Number(p.total); out.liveProducts = Number(p.live);\n  } catch (err) { console.warn('[overview] products count failed:', err.message); }\n  try {\n    if (await hasPageAccess(req.user.sub, 'profits')) {\n      const profit = await require('../profits/service').allTimeProfit(db);\n      out.totalProfitUsd = profit.netProfit; out.profitMargin = profit.margin; out.expectedProfitUsd = profit.expectedProfit;\n    }\n  } catch (err) { console.warn('[overview] total profit failed:', err.message); }\n  try {\n    if (await hasPageAccess(req.user.sub, 'payouts')) {\n      const totals = Object.values(await require('../payouts/terms').supplierTotals(db));\n      const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;\n      out.owedToSuppliersCny = r2(totals.reduce((s, t) => s + Math.max(0, t.payNow), 0));\n      out.notDueToSuppliersCny = r2(totals.reduce((s, t) => s + t.notDue.amount, 0));\n      out.suppliersOwed = totals.filter((t) => t.payNow > 0).length;\n    }\n  } catch (err) { console.warn('[overview] owed to suppliers failed:', err.message); }\n  return out;\n}\n", false]]}, {"file": "apps/admin-dashboard/src/components/ui.jsx", "what": "Admin: KPI cards can show a small line under the number and open their page", "done": "note = null, onClick = null", "pairs": [["export function KpiCard({ label, value, delta, positive, icon: Icon, navy = false }) {", "export function KpiCard({ label, value, delta, positive, icon: Icon, navy = false, note = null, onClick = null }) {", false], ["    <div style={{ position: \"relative\", overflow: \"hidden\", background: navy ?", "    <div role={onClick ? \"button\" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick || undefined} onKeyDown={onClick ? (e) => { if (e.key === \"Enter\" || e.key === \" \") { e.preventDefault(); onClick(); } } : undefined}\n      style={{ cursor: onClick ? \"pointer\" : \"default\", position: \"relative\", overflow: \"hidden\", background: navy ?", false], ["      {/* Only when a REAL change is given.", "      {note && <div style={{ ...body, fontSize: 12, fontWeight: 600, color: navy ? C.onNavyMuted : C.muted, marginTop: 2 }}>{note}</div>}\n      {/* Only when a REAL change is given.", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "Admin Overview: Total profit, Owed to suppliers and Total products cards", "done": "label=\"Owed to suppliers\"", "pairs": [["          <KpiCard label=\"Open tickets\" value={data.openTickets.toLocaleString()} icon={LifeBuoy} />", "          <KpiCard label=\"Open tickets\" value={data.openTickets.toLocaleString()} icon={LifeBuoy} />\n        </div>\n        {/* money and catalogue: their own row of three */}\n        <div style={{ display: \"grid\", gridTemplateColumns: \"repeat(auto-fit, minmax(260px, 1fr))\", gap: 20, marginTop: -4 }}>\n          {typeof data.totalProfitUsd === \"number\" && (\n            <KpiCard label=\"Total profit\" icon={TrendingUp} onClick={canOpen(\"profits\") ? () => nav?.onNavigateToPage(\"profits\") : null}\n              value={`${data.totalProfitUsd < 0 ? \"-\" : \"\"}$${Math.abs(data.totalProfitUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}\n              note={[data.profitMargin != null ? `${Math.round(data.profitMargin * 1000) / 10}% margin` : null, data.expectedProfitUsd ? `+$${data.expectedProfitUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} not final yet` : null].filter(Boolean).join(\" · \") || \"Orders past their return window\"} />\n          )}\n          {typeof data.owedToSuppliersCny === \"number\" && (\n            <KpiCard label=\"Owed to suppliers\" icon={Wallet} onClick={canOpen(\"payouts\") ? () => nav?.onNavigateToPage(\"payouts\") : null}\n              value={`¥${data.owedToSuppliersCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}\n              note={[data.suppliersOwed ? `${data.suppliersOwed} ${data.suppliersOwed === 1 ? \"supplier\" : \"suppliers\"} to pay now` : \"Nothing due now\", data.notDueToSuppliersCny ? `¥${data.notDueToSuppliersCny.toLocaleString(undefined, { maximumFractionDigits: 0 })} not due yet` : null].filter(Boolean).join(\" · \")} />\n          )}\n          {typeof data.totalProducts === \"number\" && (\n            <KpiCard label=\"Total products\" icon={Package} value={data.totalProducts.toLocaleString()} onClick={canOpen(\"allProducts\") ? () => nav?.onNavigateToPage(\"allProducts\") : null}\n              note={`${(data.liveProducts || 0).toLocaleString()} live`} />\n          )}", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-overview-money`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart the API (cd services\\api ; npm run dev), then refresh the admin portal with Ctrl+F5.');
