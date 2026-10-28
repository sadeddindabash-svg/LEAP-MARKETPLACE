#!/usr/bin/env node
/**
 * Support tickets: the Status only moves FORWARD (Open -> In progress -> Resolved) and can never be undone.
 *   SERVER (services/api/src/modules/support/routes.js): a backward change is refused (409) in one atomic statement, so two admins pressing at once cannot undo each other; the same status again is a harmless no-op.
 *   ADMIN PORTAL (apps/admin-dashboard/src/App.jsx): the Status card greys out every step that is behind the current one (only later steps can be pressed), and pressing Resolved asks first: "Resolved can't be undone."
 * No migration. Run it from the project folder. Restart the backend afterwards.
 *
 *   node scripts/patch-ticket-status.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-ticket-status.js --write    applies it (each changed file is saved as <file>.before-ticket-status first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/support/routes.js", "what": "a ticket's status only moves forward: a backward change is refused (409), the same status again is a no-op", "done": "array_position", "pairs": [["    const { rows } = await db.query(\n      `UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,\n      [status, req.params.id]\n    );\n    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });\n    res.json(toTicketSummaryDto(rows[0]));", "    // A ticket's status only moves FORWARD (open -> in_progress -> resolved) and can never be undone. One atomic statement: it moves only a ticket that is still BEHIND the requested status,\n    // so two admins pressing at the same moment cannot undo each other either.\n    const { rows } = await db.query(\n      `UPDATE support_tickets SET status = $1, updated_at = now()\n       WHERE id = $2 AND array_position(ARRAY['open', 'in_progress', 'resolved'], status) < array_position(ARRAY['open', 'in_progress', 'resolved'], $1::text)\n       RETURNING *`,\n      [status, req.params.id]\n    );\n    if (rows.length === 0) {\n      const { rows: current } = await db.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);\n      if (current.length === 0) return res.status(404).json({ error: 'Ticket not found' });\n      if (current[0].status === status) return res.json(toTicketSummaryDto(current[0]));      // already there: nothing to do\n      return res.status(409).json({ error: `A ticket's status only moves forward (open, in progress, resolved) and cannot be undone. This ticket is already ${current[0].status}.`, currentStatus: current[0].status });\n    }\n    res.json(toTicketSummaryDto(rows[0]));"]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "the Status card: only later steps can be pressed, earlier ones are greyed out, and Resolved asks first", "done": "ticket-resolve-confirm", "pairs": [["  const handleStatusChange = async (status) => {\n    try {\n      await updateTicketStatus(getStoredToken(), ticketId, status);\n      load();", "  const [confirmingResolve, setConfirmingResolve] = useState(false);\n  const TICKET_STEPS = [\"open\", \"in_progress\", \"resolved\"];\n  const TICKET_RANK = { open: 0, in_progress: 1, resolved: 2 };      // a status only moves forward: open, then in progress, then resolved\n\n  const handleStatusChange = async (status) => {\n    try {\n      await updateTicketStatus(getStoredToken(), ticketId, status);\n      load();\n      setConfirmingResolve(false);"], ["          <Card title=\"Status\">\n            <div style={{ padding: 12, display: \"flex\", flexDirection: \"column\", gap: 8 }}>\n              {[\"open\", \"in_progress\", \"resolved\"].map(s => (\n                <button\n                  key={s}\n                  onClick={() => handleStatusChange(s)}\n                  style={{\n                    ...body, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\", textAlign: \"left\",\n                    border: ticket.status === s ? `2px solid ${C.signal}` : `1px solid ${C.line}`,\n                    background: ticket.status === s ? \"#FDF1EB\" : \"#fff\",\n                  }}\n                >{s === \"open\" ? \"Open\" : s === \"in_progress\" ? \"In progress\" : \"Resolved\"}</button>\n              ))}\n            </div>\n          </Card>", "          <Card title=\"Status\">\n            <div style={{ padding: 12, display: \"flex\", flexDirection: \"column\", gap: 8 }}>\n              {TICKET_STEPS.map(s => {\n                const current = ticket.status === s;\n                const behind = TICKET_RANK[s] < TICKET_RANK[ticket.status];\n                const canPress = TICKET_RANK[s] > TICKET_RANK[ticket.status];\n                return (\n                  <button\n                    key={s}\n                    data-testid={`ticket-status-${s}`}\n                    disabled={!canPress}\n                    aria-current={current ? \"step\" : undefined}\n                    title={behind ? \"A ticket's status only moves forward and can't be undone\" : undefined}\n                    onClick={() => (s === \"resolved\" ? setConfirmingResolve(true) : handleStatusChange(s))}\n                    style={{\n                      ...body, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textAlign: \"left\", cursor: canPress ? \"pointer\" : \"not-allowed\",\n                      border: current ? `2px solid ${C.signal}` : behind ? `1px dashed ${C.line}` : `1px solid ${C.line}`,\n                      background: current ? \"#FDF1EB\" : behind ? \"#F1F3F5\" : \"#fff\",\n                      color: behind ? C.muted : C.ink, opacity: behind ? 0.7 : 1,\n                    }}\n                  >{s === \"open\" ? \"Open\" : s === \"in_progress\" ? \"In progress\" : \"Resolved\"}</button>\n                );\n              })}\n              {confirmingResolve && (\n                <div data-testid=\"ticket-resolve-confirm\" role=\"alertdialog\" style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, background: C.redBg }}>\n                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>Resolved can't be undone.</div>\n                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Mark this ticket as resolved?</div>\n                  <div style={{ display: \"flex\", gap: 8, marginTop: 8 }}>\n                    <button data-testid=\"ticket-resolve-yes\" onClick={() => handleStatusChange(\"resolved\")} style={{ ...body, padding: \"7px 12px\", borderRadius: 8, border: \"none\", background: C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\" }}>Yes, resolve</button>\n                    <button data-testid=\"ticket-resolve-no\" onClick={() => setConfirmingResolve(false)} style={{ ...body, padding: \"7px 12px\", borderRadius: 8, border: `1px solid ${C.line}`, background: \"#fff\", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: \"pointer\" }}>Cancel</button>\n                  </div>\n                </div>\n              )}\n            </div>\n            <div style={{ ...body, fontSize: 11.5, color: C.muted, padding: \"0 12px 10px\" }}>Status only moves forward and can't be undone.</div>\n          </Card>"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'ticket-status-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ticket-status-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-ticket-status`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
