#!/usr/bin/env node
/**
 * SERVER, stage 3: a supplier ACCEPTS or REFUSES a new order. 24 hours to answer; a reminder every 4 hours; after 24 hours the admin is told (never cancelled silently). A refusal needs a reason, cancels only that supplier's part,
 * tells the buyer and the admin; the admin has a list of refused / unanswered orders and can reassign a refused part to another supplier. Accepting is the same as "start preparing" was.
 * Needs migration 113 and the folder services/api/src/modules/orderResponse/ from the same package (and the stage 2 patch, patch-supplier-rmb.js, first). Restart the backend afterwards.
 *
 *   node scripts/patch-order-response.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-response.js --write    applies it (each changed file is saved as <file>.before-order-response first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/index.js", "what": "the order response routes (accept, refuse, the admin list) and the reminder job are mounted and started", "done": "orderResponse", "pairs": [["const { startScheduledDelayCheck } = require('./modules/shipmentDelayCheck/check');", "const { startScheduledDelayCheck } = require('./modules/shipmentDelayCheck/check');\nconst orderResponse = require('./modules/orderResponse/routes');\nconst { startScheduledResponseCheck } = require('./modules/orderResponse/check');"], ["app.use('/supplier', supplierRoutes);", "app.use('/supplier/me/orders', orderResponse.supplierRouter);      // accept / refuse a new order\napp.use('/supplier-responses', orderResponse.adminRouter);              // the admin's list of refused / unanswered orders\napp.use('/supplier', supplierRoutes);"], ["  startScheduledDelayCheck();\n}", "  startScheduledDelayCheck();\n  // The reminders for a supplier who has not answered a new order (every 4 hours, then to the admin after 24 hours).\n  startScheduledResponseCheck();\n}"]]}, {"file": "services/api/src/modules/supplier/orderRules.js", "what": "a NEW (pending) order can be accepted or refused; nothing else can", "done": "canRefuse", "pairs": [["if (status === 'cancelled') return { locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false };", "if (status === 'cancelled') return { locked: true, lockReason: 'cancelled', allowedStatuses: [], canEditTracking: false, canAccept: false, canRefuse: false };"], ["return { locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false };", "return { locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false, canAccept: false, canRefuse: false };"], ["return { locked: false, lockReason: null, allowedStatuses: STAGES.filter((_, i) => i > position), canEditTracking: true };", "return { locked: false, lockReason: null, allowedStatuses: STAGES.filter((_, i) => i > position), canEditTracking: true, canAccept: status === 'pending', canRefuse: status === 'pending' };      // answering a NEW order: accept or refuse"]]}, {"file": "services/api/src/modules/supplier/routes.js", "what": "the supplier's order list carries the answer deadline, when it was accepted and why it was refused; moving an order to preparing (the old way to accept) also records the acceptance", "done": "respond_by", "pairs": [["hs.id AS hub_shipment_id, hs.status AS hub_shipment_status\n", "hs.id AS hub_shipment_id, hs.status AS hub_shipment_status, so.respond_by, so.accepted_at, so.refused_at, so.refusal_reason, so.refusal_note\n"], ["        placedAt: so.placed_at,\n", "        placedAt: so.placed_at,\n        respondBy: so.respond_by,\n        acceptedAt: so.accepted_at,\n        refusedAt: so.refused_at,\n        refusalReason: so.refusal_reason,\n        refusalNote: so.refusal_note,\n"], ["         status = COALESCE($1, status),\n         tracking_number = COALESCE($2, tracking_number)\n       WHERE id = $3 AND supplier_id = $4", "         status = COALESCE($1, status),\n         accepted_at = CASE WHEN $1::text IN ('preparing', 'shipped') AND accepted_at IS NULL THEN now() ELSE accepted_at END,\n         tracking_number = COALESCE($2, tracking_number)\n       WHERE id = $3 AND supplier_id = $4"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'order-response-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'order-response-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-order-response`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
