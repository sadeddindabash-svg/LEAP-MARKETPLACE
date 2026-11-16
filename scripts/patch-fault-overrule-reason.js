#!/usr/bin/env node
/**
 * Flagged shipments: confirming a fault the supplier did not accept (migration 151). Run AFTER patch-returns-supplier-followup.
 *   - the Confirm real fault window shows the supplier's refusal and asks for Leap's reason (required)
 *   - the reason goes to the supplier: in the return's conversation, in the "Can you replace?" notification, and on the replacement request
 *   node scripts/patch-fault-overrule-reason.js            dry run
 *   node scripts/patch-fault-overrule-reason.js --write    applies it
 */
const DATA = {"created": [{"file": "services/api/db/migrations/151_fault_overrule_reason.sql", "what": "new migration: Leap's reason when it confirms a fault the supplier did not accept", "text": "-- Migration 151: when Leap confirms a fault although the supplier did not accept the return, the reason (sent to the supplier)\n-- (patch-fault-overrule-reason).\nALTER TABLE fault_cases ADD COLUMN IF NOT EXISTS overrule_reason TEXT;\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/faultCases/routes.js", "what": "fault cases: confirming a fault the supplier did not accept needs a reason, sent to the supplier; fault cases: the supplier sees why Leap confirmed the fault", "done": "  const overruleReason = typeof req.body?.overruleReason === 'string' ? req.body.overruleReason.trim().slice(0, 1000) : '';", "pairs": [["router.post('/', ...adminOnly, async (req, res, next) => {\n  const { shipmentId, items, costBearer, notes } = req.body || {};\n  const outcome = await inTransaction(res, next, (client) => helpers.createFaultCase(client, { shipmentId: Number(shipmentId), items, costBearer, notes, adminId: req.user.sub }));", "router.post('/', ...adminOnly, async (req, res, next) => {\n  const { shipmentId, items, costBearer, notes } = req.body || {};\n  const overruleReason = typeof req.body?.overruleReason === 'string' ? req.body.overruleReason.trim().slice(0, 1000) : '';\n  const outcome = await inTransaction(res, next, async (client) => {\n    // patch-fault-overrule-reason (migration 151): the supplier did not accept the return the hub opened -> Leap says why it confirms the fault anyway\n    const { rows: [rc] } = await client.query(\n      `SELECT rc.id, rc.supplier_answer, rc.supplier_answer_note FROM return_cases rc JOIN hub_shipments hs ON hs.sub_order_id = rc.sub_order_id\n       WHERE hs.id = $1 ORDER BY rc.created_at DESC LIMIT 1`, [Number(shipmentId)]);\n    const overruled = rc && rc.supplier_answer === 'decline';\n    if (overruled && overruleReason.length < 3) throw new FaultCaseError('The supplier did not accept this return: write the reason for confirming the fault anyway. It is sent to the supplier.');\n    const made = await helpers.createFaultCase(client, { shipmentId: Number(shipmentId), items, costBearer, notes, adminId: req.user.sub });\n    if (overruled) {\n      await client.query('UPDATE fault_cases SET overrule_reason = $2 WHERE id = $1', [made.faultCase.id, overruleReason]);\n      made.faultCase.overrule_reason = overruleReason;\n      await client.query(\"INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)\", [rc.id,\n        `平台已确认这是质量问题（尽管您不同意退货）。理由：${overruleReason}\\n请在“更换请求”中回答能否更换。\\nLeap confirmed the fault although you did not accept the return. Reason: ${overruleReason}\\nPlease say under Replacement requests whether you can replace it.`]);\n      for (const n of made.notifications || []) {\n        if (n.type === 'supplier_message' && /^Can you replace\\?/.test(n.title || '')) n.body = `Leap confirmed the fault although you did not accept the return. Reason: ${overruleReason}\\n${n.body}`;\n      }\n    }\n    return made;\n  });", false], ["        replacementOrderId: dto.replacement ? dto.replacement.orderId : null,", "        replacementOrderId: dto.replacement ? dto.replacement.orderId : null,\n        // why Leap confirmed the fault although the supplier did not accept the return (migration 151)\n        overruleReason: r.overrule_reason || null,", false]]}, {"file": "services/api/src/modules/hub/routes.js", "what": "flagged shipments: the supplier's answer on the return, for the confirm-fault dialog; flagged shipments: the supplier's answer", "done": "        `SELECT id, supplier_answer, supplier_answer_note FROM return_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1`,", "pairs": [["      const { rows: caseRows } = await db.query(\n        `SELECT id FROM return_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1`,\n        [r.sub_order_id]\n      );", "      const { rows: caseRows } = await db.query(\n        `SELECT id, supplier_answer, supplier_answer_note FROM return_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1`,\n        [r.sub_order_id]\n      );", false], ["        returnCaseId: caseRows[0]?.id || null,\n        hubStatus: r.status,", "        returnCaseId: caseRows[0]?.id || null,\n        // the supplier's answer on the return (patch-fault-overrule-reason): a refusal needs Leap's reason to confirm the fault\n        supplierAnswer: caseRows[0]?.supplier_answer || null, supplierAnswerNote: caseRows[0]?.supplier_answer_note || null,\n        hubStatus: r.status,", false]]}, {"file": "apps/admin-dashboard/src/auth.js", "what": "admin: the reason when the supplier did not accept", "done": "export const openFaultCase = (token, { shipmentId, items, costBearer, notes, overruleReason }) => faultCaseRequest(\"\", token, overruleReason ? { shipmentId, items, costBearer, notes, overruleReason } : { shipmentId, items, costBearer, notes });", "pairs": [["export const openFaultCase = (token, { shipmentId, items, costBearer, notes }) => faultCaseRequest(\"\", token, { shipmentId, items, costBearer, notes });", "export const openFaultCase = (token, { shipmentId, items, costBearer, notes, overruleReason }) => faultCaseRequest(\"\", token, overruleReason ? { shipmentId, items, costBearer, notes, overruleReason } : { shipmentId, items, costBearer, notes });", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "confirm fault: the reason state; confirm fault: the supplier's refusal and Leap's reason; confirm fault: sent with the reason; confirm fault: the reason reaches the server", "done": "  const [overruleReason, setOverruleReason] = useState(\"\");      // patch-fault-overrule-reason", "pairs": [["  const [costBearer, setCostBearer] = useState(\"supplier\");\n  const [notes, setNotes] = useState(\"\");\n  const label = { ...body, display: \"block\", fontSize: 11.5, fontWeight: 700, color: C.muted, margin: \"14px 0 6px\" };", "  const [costBearer, setCostBearer] = useState(\"supplier\");\n  const [notes, setNotes] = useState(\"\");\n  const [overruleReason, setOverruleReason] = useState(\"\");      // patch-fault-overrule-reason\n  const overruled = shipment.supplierAnswer === \"decline\";\n  const reasonMissing = overruled && overruleReason.trim().length < 3;\n  const label = { ...body, display: \"block\", fontSize: 11.5, fontWeight: 700, color: C.muted, margin: \"14px 0 6px\" };", false], ["        <label style={label} htmlFor=\"fault-notes\">INTERNAL NOTE (optional — the buyer does not see this)</label>", "        {overruled && (\n          <>\n            <div style={{ ...body, fontSize: 12.5, color: C.redInk, background: C.redBg, borderRadius: 8, padding: 10, marginTop: 14 }}>\n              <strong>The supplier did not accept this return:</strong> “{shipment.supplierAnswerNote}”\n            </div>\n            <label style={label} htmlFor=\"fault-overrule\">WHY YOU CONFIRM THE FAULT ANYWAY <span style={{ color: C.red }}>*</span> (sent to the supplier)</label>\n            <textarea id=\"fault-overrule\" value={overruleReason} onChange={(e) => setOverruleReason(e.target.value)} maxLength={1000} placeholder=\"e.g. the photos show the crack starts at the factory weld\" style={{ ...body, width: \"100%\", boxSizing: \"border-box\", height: 64, padding: 9, borderRadius: 8, border: `1px solid ${reasonMissing ? C.red : C.line}`, fontSize: 13 }} />\n          </>\n        )}\n\n        <label style={label} htmlFor=\"fault-notes\">INTERNAL NOTE (optional — the buyer does not see this)</label>", false], ["          <button\n            disabled={isSaving}\n            onClick={() => onSubmit({ items: shipment.items.map((i) => i.productId), costBearer, notes: notes.trim() })}\n            style={{ ...body, fontSize: 12.5, fontWeight: 700, padding: \"8px 14px\", borderRadius: 8, border: \"none\", background: isSaving ? \"#D1D5DB\" : C.red, color: \"#fff\", cursor: isSaving ? \"default\" : \"pointer\" }}", "          <button\n            disabled={isSaving || reasonMissing}\n            onClick={() => onSubmit({ items: shipment.items.map((i) => i.productId), costBearer, notes: notes.trim(), ...(overruled ? { overruleReason: overruleReason.trim() } : {}) })}\n            style={{ ...body, fontSize: 12.5, fontWeight: 700, padding: \"8px 14px\", borderRadius: 8, border: \"none\", background: isSaving || reasonMissing ? \"#D1D5DB\" : C.red, color: \"#fff\", cursor: isSaving || reasonMissing ? \"default\" : \"pointer\" }}", false], ["  const handleOpenFault = ({ items, costBearer, notes }) => run(async () => {\n    await openFaultCase(getStoredToken(), { shipmentId: action.shipment.id, items, costBearer, notes });", "  const handleOpenFault = ({ items, costBearer, notes, overruleReason }) => run(async () => {\n    await openFaultCase(getStoredToken(), { shipmentId: action.shipment.id, items, costBearer, notes, overruleReason });", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "replacement requests: why Leap confirmed the fault after the supplier's refusal; replacement requests: the language", "done": "        {/* patch-fault-overrule-reason: Leap confirmed the fault although the supplier did not accept the return -- say so, with the reason */}", "pairs": [["        {/* The replacement the supplier now has to ship (migration 095). */}", "        {/* patch-fault-overrule-reason: Leap confirmed the fault although the supplier did not accept the return -- say so, with the reason */}\n        {faultCase.overruleReason && (\n          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: \"#F9B317\", color: \"#0B3146\" }}>\n            <div style={{ ...font, fontSize: 12.5, fontWeight: 800 }}>{lang === \"zh\" ? \"平台在您不同意退货后确认了质量问题\" : \"Leap confirmed the fault after you did not accept the return\"}</div>\n            <div style={{ ...font, fontSize: 12.5, marginTop: 4, whiteSpace: \"pre-line\" }}>{lang === \"zh\" ? \"理由：\" : \"Reason: \"}{faultCase.overruleReason}</div>\n          </div>\n        )}\n\n        {/* The replacement the supplier now has to ship (migration 095). */}", false], ["function ReplacementCard({ faultCase, onAnswered }) {\n  const { t } = useLang();", "function ReplacementCard({ faultCase, onAnswered }) {\n  const { t, lang } = useLang();", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-fault-overrule-reason`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then: cd services\\api ; npm run migrate ; npm run dev   (one API window). Refresh the admin and the supplier portal with Ctrl+F5.");
