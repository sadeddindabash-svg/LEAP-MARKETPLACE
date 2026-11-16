#!/usr/bin/env node
/**
 * Admin portal redesign, step 3: the Orders page as in the approved mockup.
 * Filter pills (the chosen one gold), a tick box on every order with a navy bar ("N selected": Export selected, Clear),
 * click a row to see the order in a side panel (progress, buyer, total, hub, supplier answer, Open order).
 * The order number, the arrow at the end of the row, or a double-click still open the order.
 * Run AFTER patch-admin-navy-frame and patch-admin-overview. No API change.
 *   node scripts/patch-admin-orders.js            dry run
 *   node scripts/patch-admin-orders.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "Admin Orders redesign: tick boxes with a navy bar to export the chosen orders, click a row to see it in a side panel (the order number, the arrow or a double-click opens it)", "done": "function OrderPreviewPanel", "pairs": [["  const [exporting, setExporting] = useState(null);      // { done, total } while the export fetches each order's detail", "  const [exporting, setExporting] = useState(null);      // { done, total } while the export fetches each order's detail\n  // The redesign (approved mockup): tick orders to act on several at once; click a row to see it in the side panel (the order number opens it).\n  const [picked, setPicked] = useState(() => new Set());\n  const [previewId, setPreviewId] = useState(null);\n  const togglePick = (id) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });", false], ["        {loadState === \"ready\" && filter !== \"refused\" && filter !== \"rules\" && (\n          <Card>\n            <table style={{ width: \"100%\", borderCollapse: \"collapse\" }}>\n              <thead>\n                <tr><Th>Order</Th><Th>Buyer</Th>", "        {loadState === \"ready\" && filter !== \"refused\" && filter !== \"rules\" && (() => {\n          const shownIds = filtered.map((o) => o.id);\n          const pickedShown = shownIds.filter((id) => picked.has(id));\n          const allPicked = shownIds.length > 0 && pickedShown.length === shownIds.length;\n          const preview = previewId ? orders.find((o) => o.id === previewId) : null;\n          return (\n          <div style={{ display: \"flex\", flexDirection: \"column\", gap: 12 }}>\n          {pickedShown.length > 0 && (\n            <div data-testid=\"orders-bulk-bar\" style={{ display: \"flex\", alignItems: \"center\", gap: 12, flexWrap: \"wrap\", padding: \"10px 14px\", borderRadius: 10, background: C.navy, color: \"#fff\", boxShadow: SHADOW.navyRaised }}>\n              <b style={{ ...body, fontSize: 13.5 }}>{pickedShown.length} selected</b>\n              <span style={{ ...body, fontSize: 12.5, color: C.onNavyMuted }}>of {shownIds.length} in this list</span>\n              <span style={{ marginLeft: \"auto\", display: \"flex\", gap: 8, flexWrap: \"wrap\" }}>\n                <button type=\"button\" disabled={Boolean(exporting)} onClick={async () => {\n                  const chosen = filtered.filter((o) => picked.has(o.id));\n                  setExporting({ done: 0, total: chosen.length });\n                  try { await exportOrdersWorkbook({ orders: chosen, tabName: `${filter}-selected`, onProgress: (done, total) => setExporting({ done, total }) }); }\n                  catch (err) { if (err instanceof SessionExpiredError) return onSessionExpired(); setErrorMessage(err.message); }\n                  finally { setExporting(null); }\n                }} style={{ ...body, height: 32, padding: \"0 14px\", borderRadius: 8, border: \"none\", background: C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 800, cursor: \"pointer\", boxShadow: SHADOW.goldRaised }}>\n                  {exporting ? `Exporting… ${exporting.done}/${exporting.total}` : \"Export selected\"}\n                </button>\n                <button type=\"button\" onClick={() => setPicked(new Set())} style={{ ...body, height: 32, padding: \"0 14px\", borderRadius: 8, border: `1px solid ${C.onNavyMuted}`, background: \"transparent\", color: \"#fff\", fontSize: 12.5, fontWeight: 700, cursor: \"pointer\" }}>Clear</button>\n              </span>\n            </div>\n          )}\n          <div style={{ display: \"grid\", gridTemplateColumns: preview ? \"minmax(0, 1fr) 340px\" : \"minmax(0, 1fr)\", gap: 20, alignItems: \"start\" }}>\n          <Card style={{ overflowX: \"auto\" }}>\n            <table style={{ width: \"100%\", borderCollapse: \"collapse\" }}>\n              <thead>\n                <tr><Th><input type=\"checkbox\" aria-label=\"Select all orders in this list\" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(shownIds))} /></Th><Th>Order</Th><Th>Buyer</Th>", false], ["                  <tr><td colSpan={9} style={{ ...body, textAlign: \"center\", color: C.muted, fontSize: 13, padding: 32 }}>No orders match this filter.</td></tr>", "                  <tr><td colSpan={10} style={{ ...body, textAlign: \"center\", color: C.muted, fontSize: 13, padding: 32 }}>No orders match this filter.</td></tr>", false], ["                    <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: \"pointer\" }}>\n                      <Td><PlateChip small>{o.id}</PlateChip></Td>", "                    <tr key={o.id} onClick={() => setPreviewId((cur) => (cur === o.id ? null : o.id))} onDoubleClick={() => onOpenOrder(o.id)} aria-selected={previewId === o.id || picked.has(o.id)}\n                      style={{ cursor: \"pointer\", background: previewId === o.id ? C.goldTint : picked.has(o.id) ? \"#FEF8E7\" : undefined }}>\n                      <Td style={{ width: 36 }}><input type=\"checkbox\" aria-label={`Select ${o.id}`} checked={picked.has(o.id)} onClick={(e) => e.stopPropagation()} onChange={() => togglePick(o.id)} /></Td>\n                      <Td><button type=\"button\" title=\"Open the order\" onClick={(e) => { e.stopPropagation(); onOpenOrder(o.id); }} style={{ border: \"none\", background: \"transparent\", padding: 0, cursor: \"pointer\", whiteSpace: \"nowrap\" }}><PlateChip small>{o.id}</PlateChip></button></Td>", false], ["                      <Td align=\"right\"><ChevronRight size={15} color={C.muted} /></Td>", "                      <Td align=\"right\"><button type=\"button\" aria-label={`Open ${o.id}`} onClick={(e) => { e.stopPropagation(); onOpenOrder(o.id); }} style={{ border: \"none\", background: \"transparent\", cursor: \"pointer\", padding: 4, display: \"inline-flex\" }}><ChevronRight size={15} color={C.muted} /></button></Td>", false], ["                })}\n              </tbody>\n            </table>\n          </Card>\n        )}\n      </div>\n    </div>\n  );\n}\n\n// Real hub assignment + evidence trail", "                })}\n              </tbody>\n            </table>\n          </Card>\n          {preview && <OrderPreviewPanel order={preview} onOpen={() => onOpenOrder(preview.id)} onClose={() => setPreviewId(null)} />}\n          </div>\n          </div>\n          );\n        })()}\n      </div>\n    </div>\n  );\n}\n\n// The Orders page's side panel: the clicked order at a glance (progress, buyer, money, hub, supplier answer), and the way into it.\nfunction OrderPreviewPanel({ order: o, onOpen, onClose }) {\n  const hubMeta = getHubStatusMeta(o.hubStatus);\n  const pr = o.progress || { percent: 0, label: \"—\", cancelled: false, flagged: false };\n  const barColor = pr.flagged ? C.red : pr.percent === 100 ? C.gauge : C.torque;\n  const asg = o.assigned || { done: 0, of: 0 };\n  const lbl = { ...body, fontSize: 11, fontWeight: 700, letterSpacing: \"0.08em\", textTransform: \"uppercase\", color: C.muted };\n  const fact = (label, value) => <div><div style={lbl}>{label}</div><div style={{ ...body, fontSize: 13, color: C.ink, marginTop: 4 }}>{value}</div></div>;\n  return (\n    <aside aria-label={`Order ${o.id}`} data-testid=\"order-preview\" style={{ position: \"sticky\", top: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: SHADOW.card, padding: 20, display: \"flex\", flexDirection: \"column\", gap: 16 }}>\n      <div style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"flex-start\", gap: 12 }}>\n        <div><div style={lbl}>Order</div><div style={{ ...mono, fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 4 }}>{o.id}</div></div>\n        <div style={{ display: \"flex\", alignItems: \"center\", gap: 8 }}>\n          {pr.cancelled ? <Badge label=\"Cancelled\" color={C.muted} bg=\"#EEEFF1\" /> : o.hubStatus ? <Badge label={hubMeta.label} color={hubMeta.color} bg={hubMeta.bg} /> : null}\n          <button type=\"button\" aria-label=\"Close the preview\" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: C.card, cursor: \"pointer\", display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\" }}><X size={14} /></button>\n        </div>\n      </div>\n      {!pr.cancelled && (\n        <div>\n          <div style={{ ...body, display: \"flex\", justifyContent: \"space-between\", fontSize: 12.5, color: C.ink, marginBottom: 6 }}><b>{pr.label}</b><span style={{ ...mono, fontWeight: 700, color: barColor }}>{pr.percent}%</span></div>\n          <div style={{ height: 8, borderRadius: 999, background: C.surfaceHigh, border: `1px solid ${C.line}`, overflow: \"hidden\" }}><div style={{ height: \"100%\", width: `${pr.percent}%`, background: barColor, borderRadius: 999 }} /></div>\n        </div>\n      )}\n      <div style={{ display: \"grid\", gridTemplateColumns: \"repeat(2, minmax(0, 1fr))\", gap: 14 }}>\n        {fact(\"Buyer\", o.buyerName || (o.guestEmail ? `Guest · ${o.guestEmail}` : \"—\"))}\n        {fact(\"Total\", <span style={{ ...mono, fontWeight: 700 }}>{Number(o.total).toFixed(2)} {o.currencyCode}</span>)}\n        {fact(\"Placed\", o.placedAt ? new Date(o.placedAt).toLocaleString(\"en-GB\", { day: \"numeric\", month: \"short\", hour: \"2-digit\", minute: \"2-digit\" }) : \"—\")}\n        {fact(\"Hub\", asg.of === 0 ? \"—\" : asg.done >= asg.of ? \"Assigned\" : asg.of > 1 ? `Not assigned (${asg.done} of ${asg.of})` : \"Not assigned\")}\n      </div>\n      <div><div style={lbl}>Supplier answer</div><div style={{ marginTop: 6 }}><AdminAnswerChip dueAt={o.answerDueAt} windowHours={o.answerWindowHours} waiting={o.answerWaiting} testId={`preview-answer-chip-${o.id}`} /></div></div>\n      <button type=\"button\" onClick={onOpen} style={{ ...body, height: 40, borderRadius: 10, border: \"none\", background: C.signal, color: C.onSignal, fontSize: 13.5, fontWeight: 800, cursor: \"pointer\", boxShadow: SHADOW.goldRaised, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\", gap: 6 }}>Open order <ChevronRight size={15} /></button>\n      <div style={{ ...body, fontSize: 11.5, color: C.muted, textAlign: \"center\" }}>Tip: double-click a row to open it straight away.</div>\n    </aside>\n  );\n}\n\n// Real hub assignment + evidence trail", false]]}, {"file": "apps/admin-dashboard/src/components/PageChrome.jsx", "what": "Admin: filter buttons as separate pills, the chosen one gold (Orders, Tickets, Returns...)", "done": "const FILTER_INK", "pairs": [["    <div role=\"group\" aria-label={label} style={{ display: \"inline-flex\", flexWrap: \"wrap\", paddingLeft: 1 }}>", "    <div role=\"group\" aria-label={label} style={{ display: \"inline-flex\", flexWrap: \"wrap\", gap: 8 }}>", false], ["              ...body, display: \"inline-flex\", alignItems: \"center\", gap: 8, height: CONTROL_HEIGHT, padding: `0 ${hasCount ? 8 : 16}px 0 16px`, marginLeft: -1, cursor: \"pointer\",\n              border: `1px solid ${C.line}`, borderRadius: i === 0 ? \"10px 0 0 10px\" : i === items.length - 1 ? \"0 10px 10px 0\" : 0,\n              background: active ? C.card : C.canvas, boxShadow: active ? `inset 0 -3px 0 ${C.signal}` : \"none\",\n              color: active ? C.ink : C.muted, fontSize: 13, fontWeight: 700, position: \"relative\", zIndex: active ? 1 : 0,", "              ...body, display: \"inline-flex\", alignItems: \"center\", gap: 8, height: 36, padding: `0 ${hasCount ? 6 : 16}px 0 16px`, cursor: \"pointer\",\n              border: `1px solid ${active ? C.signalDark : C.lineStrong}`, borderRadius: 999,\n              background: active ? C.signal : C.card, boxShadow: active ? \"0 1px 0 rgba(255,255,255,0.45) inset, 0 2px 4px rgba(227,159,12,0.35)\" : \"none\",\n              color: active ? C.onSignal : C.ink, fontSize: 13, fontWeight: 700, position: \"relative\",", false], ["                minWidth: 26, height: 24, padding: \"0 6px\", boxSizing: \"border-box\", borderRadius: 6, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\",\n                fontSize: 12, fontWeight: 800, background: active || item.alert ? tone.color : tone.bg, color: active || item.alert ? \"#fff\" : tone.color,", "                minWidth: 26, height: 24, padding: \"0 7px\", boxSizing: \"border-box\", borderRadius: 999, display: \"inline-flex\", alignItems: \"center\", justifyContent: \"center\",\n                fontFamily: \"'JetBrains Mono', monospace\", fontSize: 11.5, fontWeight: 700,\n                background: item.alert ? C.red : active ? \"rgba(11,49,70,0.14)\" : tone.bg, color: item.alert ? \"#fff\" : active ? C.onSignal : (FILTER_INK[tone.color] || tone.color),", false], ["const TONES = {", "const FILTER_INK = { [C.red]: C.redInk, [C.torque]: C.torqueInk, [C.gauge]: C.gaugeInk, [C.amber]: C.amberInk };\nconst TONES = {", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-orders`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then refresh the admin portal with Ctrl+F5 (no API restart needed).');
