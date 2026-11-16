const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * A reminder when the supplier has not answered a return 48 hours after Leap asked (migration 150, patch-returns-supplier-followup).
 * One reminder per ask: the supplier gets a notification and a message from Leap in the return's conversation; the admins are told too.
 * "Ask again" after a refusal starts a new 48 hours.
 */
const WAIT_HOURS = 48;

async function sendDueReminders() {
  const { rows } = await db.query(
    `SELECT rc.id, rc.order_id, rc.sub_order_id, so.supplier_id
     FROM return_cases rc JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
     WHERE rc.status IN ('awaiting', 'in_progress') AND rc.supplier_answer IS NULL
       AND NOT EXISTS (SELECT 1 FROM fault_cases fc WHERE fc.sub_order_id = rc.sub_order_id)
       AND COALESCE(rc.supplier_asked_at, rc.created_at) < now() - make_interval(hours => $1::int)
       AND (rc.supplier_reminded_at IS NULL OR rc.supplier_reminded_at < COALESCE(rc.supplier_asked_at, rc.created_at))`,
    [WAIT_HOURS]);
  let sent = 0;
  for (const rc of rows) {
    try {
      const claimed = await db.query('UPDATE return_cases SET supplier_reminded_at = now() WHERE id = $1 AND supplier_answer IS NULL RETURNING id', [rc.id]);
      if (claimed.rows.length === 0) continue;
      await db.query("INSERT INTO return_case_supplier_messages (case_id, sender_role, message) VALUES ($1, 'admin', $2)", [rc.id,
        `提醒：退货 ${rc.id}（订单 ${rc.order_id}）已等待您的答复超过 48 小时。请查看照片后选择“同意退货”或“不同意”。\nReminder: return ${rc.id} (order ${rc.order_id}) has waited more than 48 hours for your answer. Please check the photos and accept it or not.`]);
      const { rows: users } = await db.query("SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'", [rc.supplier_id]);
      for (const u of users) {
        await createNotification({ userId: u.id, type: 'return_status', title: `请回复退货 ${rc.id} · Please answer return ${rc.id}`, body: `已等待超过 48 小时 · Waiting more than 48 hours (order ${rc.order_id})`, linkType: 'return_case', linkId: rc.id });
      }
      const { notifyAdmins } = require('../orderResponse/noAnswer');
      await notifyAdmins({ title: `Return ${rc.id}: no answer from the supplier`, body: `The supplier has not answered return ${rc.id} in 48 hours. A reminder was sent to them.` }, rc.order_id);
      sent++;
    } catch (err) {
      console.error(`[returns] reminder for ${rc.id} failed (non-fatal):`, err.message);
    }
  }
  if (sent) console.log(`[returns] ${sent} supplier reminder(s) sent.`);
  return sent;
}

function startScheduledReturnReminders() {
  const tick = () => sendDueReminders().catch((err) => console.error('[returns] reminder sweep failed (non-fatal, will retry):', err.message));
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 30 * 60 * 1000);      // every 30 minutes
}

module.exports = { sendDueReminders, startScheduledReturnReminders, WAIT_HOURS };
