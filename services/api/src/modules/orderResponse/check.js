const db = require('../../../db/pool');
const { nextStep, messages, notifySupplierUsers, notifyAdmins } = require('./helpers');

/**
 * The reminders for a supplier who has not answered a new order: every 4 hours (at 4, 8, 12, 16 and 20 hours after the order), then after 24 hours the ADMIN is told (once).
 * It never changes the order: nothing is cancelled silently. Safe to run often and to run twice: each order is reminded and escalated at most once per step.
 */
async function checkPendingResponses(now = new Date()) {
  const { rows } = await db.query(
    `SELECT so.id, so.order_id, so.supplier_id, so.status, so.respond_by, so.reminders_sent, so.escalated_at, s.name AS supplier_name
     FROM supplier_sub_orders so JOIN suppliers s ON s.id = so.supplier_id
     WHERE so.status = 'pending' AND so.escalated_at IS NULL AND so.respond_by IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id)`
  );
  const done = { reminded: 0, escalated: 0 };
  for (const r of rows) {
    const step = nextStep({ status: r.status, respondBy: r.respond_by, remindersSent: r.reminders_sent, escalatedAt: r.escalated_at, now });
    try {
      if (step.action === 'remind') {
        const { rowCount } = await db.query("UPDATE supplier_sub_orders SET reminders_sent = $2, last_reminder_at = $3 WHERE id = $1 AND status = 'pending' AND reminders_sent < $2", [r.id, step.remindersDue, now]);
        if (rowCount === 0) continue;
        await notifySupplierUsers(r.supplier_id, messages.supplierReminder(r.order_id, step.hoursLeft), r.order_id);
        done.reminded++;
      } else if (step.action === 'escalate') {
        const { rowCount } = await db.query("UPDATE supplier_sub_orders SET escalated_at = $2 WHERE id = $1 AND status = 'pending' AND escalated_at IS NULL", [r.id, now]);
        if (rowCount === 0) continue;
        await notifyAdmins(messages.adminNoAnswer(r.order_id, r.supplier_name), r.order_id);
        await notifySupplierUsers(r.supplier_id, messages.supplierEscalated(r.order_id), r.order_id);
        done.escalated++;
      }
    } catch (err) {
      console.error('[order-response] reminder step failed (non-fatal, will retry next time):', err.message);
    }
  }
  return done;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;      // every 15 minutes: fine enough for 4-hour steps

function startScheduledResponseCheck() {
  const tick = async () => {
    try { await checkPendingResponses(); } catch (err) { console.error('[order-response] scheduled tick failed (non-fatal, will retry next interval):', err.message); }
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { checkPendingResponses, startScheduledResponseCheck };
