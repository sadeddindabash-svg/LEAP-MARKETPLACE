#!/usr/bin/env node
/**
 * Returns: the admin is told about new messages (migration 148). Run AFTER patch-returns-all.
 *   - a supplier or the buyer writes on a return: the admins' bell rings with the case number and the start of the message
 *   - Returns list: a "New message" mark and the case under "Needs you" (even an approved or rejected case) until an admin opens it;
 *     the Returns number in the side menu counts it too
 *   - the case page: "Conversation with the buyer (the customer)" and "Conversation with the supplier", with how many are new;
 *     Leap's own messages say "Leap (sent by us)"
 *   node scripts/patch-returns-messages.js            dry run
 *   node scripts/patch-returns-messages.js --write    applies it
 */
const DATA = {"created": [{"file": "services/api/db/migrations/148_return_admin_read.sql", "what": "new migration: new messages on a return are marked until an admin opens it", "text": "-- Migration 148: a new message on a return is marked for the admin until someone opens the case (patch-returns-messages).\n-- admin_read_at: the last time an admin opened the case; a supplier or buyer message after it is \"new\".\nALTER TABLE return_cases ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ;\nUPDATE return_cases SET admin_read_at = now() WHERE admin_read_at IS NULL;      -- messages from before this are not shown as new\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/returns/routes.js", "what": "returns: the admins are told when a supplier writes on a return; returns: the admins are told when the buyer writes on a return; returns: new messages counted for the admin; returns: the admin's case and list carry the new-message counts; returns: opening the case reads its messages; returns: the be", "done": "    await tellAdminsAboutMessage(req.params.id, 'supplier', message);      // patch-returns-messages", "pairs": [["    await db.query(`INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'supplier', $2)`, [req.params.id, message]);\n    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);", "    await db.query(`INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'supplier', $2)`, [req.params.id, message]);\n    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);\n    await tellAdminsAboutMessage(req.params.id, 'supplier', message);      // patch-returns-messages", false], ["    await db.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'buyer', $2)`, [req.params.id, message]);\n    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);", "    await db.query(`INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES ($1, 'buyer', $2)`, [req.params.id, message]);\n    await db.query('UPDATE return_cases SET updated_at = now() WHERE id = $1', [req.params.id]);\n    await tellAdminsAboutMessage(req.params.id, 'buyer', message);      // patch-returns-messages", false], ["         (rc.status = 'awaiting' AND rc.created_at < now() - make_interval(hours => $1::int)) AS overdue", "         (rc.status = 'awaiting' AND rc.created_at < now() - make_interval(hours => $1::int)) AS overdue,\n         (SELECT COUNT(*) FROM return_case_supplier_messages m WHERE m.case_id = rc.id AND m.sender_role = 'supplier' AND m.created_at > COALESCE(rc.admin_read_at, '-infinity'::timestamptz))::int AS unread_supplier,\n         (SELECT COUNT(*) FROM return_case_buyer_messages m WHERE m.case_id = rc.id AND m.sender_role = 'buyer' AND m.created_at > COALESCE(rc.admin_read_at, '-infinity'::timestamptz))::int AS unread_buyer", false], ["    overdue: Boolean(row.overdue),", "    overdue: Boolean(row.overdue),\n    unreadSupplier: Number(row.unread_supplier || 0), unreadBuyer: Number(row.unread_buyer || 0),      // patch-returns-messages", false], ["    const faultCase = await flow.isFaultCase(db, rows[0].sub_order_id);", "    const faultCase = await flow.isFaultCase(db, rows[0].sub_order_id);\n    await db.query('UPDATE return_cases SET admin_read_at = now() WHERE id = $1', [req.params.id]);      // the admin opened it: its messages are read (patch-returns-messages)", false], ["function flowError(res, err, next) {", "// A supplier or the buyer wrote on a return: the admins' bell (patch-returns-messages). Never fails the request.\nasync function tellAdminsAboutMessage(caseId, who, message) {\n  try {\n    const { rows } = await db.query('SELECT order_id FROM return_cases WHERE id = $1', [caseId]);\n    const short = String(message).replace(/\\s+/g, ' ').trim();\n    const { notifyAdmins } = require('../orderResponse/noAnswer');\n    await notifyAdmins({ title: `Return ${caseId}: new message from the ${who === 'supplier' ? 'supplier' : 'buyer'}`, body: short.length > 160 ? `${short.slice(0, 157)}…` : short }, rows[0]?.order_id || null);\n  } catch (err) { console.error('[returns] admin notification failed (non-fatal):', err.message); }\n}\n\nfunction flowError(res, err, next) {", false]]}, {"file": "services/api/src/modules/adminCounts/service.js", "what": "side menu: returns with a new message count too; side menu: what a new return message is", "done": "    returns: await one(`SELECT COUNT(*) AS n FROM return_cases rc WHERE status IN ('awaiting', 'in_progress') OR (refund_status IN ('pending', 'failed') AND refund_issued_at IS NULL) OR ${RETURN_UNREAD}`),", "pairs": [["    returns: await one(`SELECT COUNT(*) AS n FROM return_cases WHERE status IN ('awaiting', 'in_progress') OR (refund_status IN ('pending', 'failed') AND refund_issued_at IS NULL)`),", "    returns: await one(`SELECT COUNT(*) AS n FROM return_cases rc WHERE status IN ('awaiting', 'in_progress') OR (refund_status IN ('pending', 'failed') AND refund_issued_at IS NULL) OR ${RETURN_UNREAD}`),\n    returnsUnread: await one(`SELECT COUNT(*) AS n FROM return_cases rc WHERE ${RETURN_UNREAD}`),      // patch-returns-messages", false], ["async function countsFor(db) {", "// a return with a supplier or buyer message the admins have not opened yet (patch-returns-messages, migration 148)\nconst RETURN_UNREAD = `(EXISTS (SELECT 1 FROM return_case_supplier_messages m WHERE m.case_id = rc.id AND m.sender_role = 'supplier' AND m.created_at > COALESCE(rc.admin_read_at, '-infinity'::timestamptz))\n  OR EXISTS (SELECT 1 FROM return_case_buyer_messages m WHERE m.case_id = rc.id AND m.sender_role = 'buyer' AND m.created_at > COALESCE(rc.admin_read_at, '-infinity'::timestamptz)))`;\n\nasync function countsFor(db) {", false]]}, {"file": "apps/admin-dashboard/src/adminCounts.js", "what": "side menu: the Returns tip says how many have a new message", "done": "${c.returnsOverdue ? ` · ${c.returnsOverdue} waiting over 48 hours` : \"\"}${c.returnsUnread ? ` · ${c.returnsUnread} with a new message` : \"\"}`; }", "pairs": [["${c.returnsOverdue ? ` · ${c.returnsOverdue} waiting over 48 hours` : \"\"}`; }", "${c.returnsOverdue ? ` · ${c.returnsOverdue} waiting over 48 hours` : \"\"}${c.returnsUnread ? ` · ${c.returnsUnread} with a new message` : \"\"}`; }", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "Returns: a case with a new message needs the admin; Returns list: New message mark; Return case: clearer names for the two conversations, and how many are new; Return case: Leap's own messages say they are from Leap", "done": "  needs: (c) => [\"awaiting\", \"in_progress\"].includes(c.status) || returnRefundOpen(c) || c.unreadSupplier > 0 || c.unreadBuyer > 0,", "pairs": [["  needs: (c) => [\"awaiting\", \"in_progress\"].includes(c.status) || returnRefundOpen(c),", "  needs: (c) => [\"awaiting\", \"in_progress\"].includes(c.status) || returnRefundOpen(c) || c.unreadSupplier > 0 || c.unreadBuyer > 0,", false], ["                          {c.overdue && <span title=\"Waiting more than 48 hours\"", "                          {(c.unreadSupplier > 0 || c.unreadBuyer > 0) && <span title={[c.unreadSupplier ? `${c.unreadSupplier} new from the supplier` : \"\", c.unreadBuyer ? `${c.unreadBuyer} new from the buyer` : \"\"].filter(Boolean).join(\" · \")} style={{ ...body, fontSize: 10.5, fontWeight: 800, color: C.onSignal, background: C.signal, borderRadius: 999, padding: \"2px 7px\", whiteSpace: \"nowrap\" }}>New message{c.unreadSupplier && c.unreadBuyer ? \"s\" : \"\"} · {c.unreadSupplier ? \"supplier\" : \"\"}{c.unreadSupplier && c.unreadBuyer ? \" + \" : \"\"}{c.unreadBuyer ? \"buyer\" : \"\"}</span>}\n                          {c.overdue && <span title=\"Waiting more than 48 hours\"", false], ["          {thread(\"Buyer thread\", rc.buyerMessages, \"Buyer\", buyerReply, setBuyerReply, sendBuyerReply, \"Reply to buyer…\")}\n          {thread(\"Supplier thread\", rc.supplierMessages, \"Supplier\", supplierReply, setSupplierReply, sendSupplierReply, \"Message supplier…\")}", "          {thread(`Conversation with the buyer (the customer)${rc.unreadBuyer ? ` · ${rc.unreadBuyer} new` : \"\"}`, rc.buyerMessages, \"Buyer (customer)\", buyerReply, setBuyerReply, sendBuyerReply, \"Reply to the buyer…\")}\n          {thread(`Conversation with the supplier${rc.unreadSupplier ? ` · ${rc.unreadSupplier} new` : \"\"}`, rc.supplierMessages, \"Supplier\", supplierReply, setSupplierReply, sendSupplierReply, \"Message the supplier…\")}", false], ["{m.senderRole === \"admin\" ? \"Leap\" : other} · {new Date(m.createdAt).toLocaleString()}", "{m.senderRole === \"admin\" ? \"Leap (sent by us)\" : other} · {new Date(m.createdAt).toLocaleString()}", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-returns-messages`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then: cd services\\api ; npm run migrate ; npm run dev   (one API window). Refresh the admin with Ctrl+F5.");
