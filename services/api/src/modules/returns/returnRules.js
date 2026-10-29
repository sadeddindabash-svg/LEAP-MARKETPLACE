/**
 * When can a part still be RETURNED? The same rule everywhere (the order details the buyer sees, the buttons on the website and in the app, and the server's own check when a return is filed):
 *   - a cancelled part, or a part of a cancelled order: never
 *   - not delivered yet: yes (nothing has started to count)
 *   - delivered: until the delivery date plus the return window the admin sets (platform setting return_window_days, 3 to 7 days, default 7); after that: no
 */
const DEFAULT_WINDOW_DAYS = 7;

async function readReturnWindowDays(q) {
  const { rows } = await q.query("SELECT value FROM platform_settings WHERE key = 'return_window_days'");
  const days = Number(rows[0]?.value ?? DEFAULT_WINDOW_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_WINDOW_DAYS;
}

function returnDeadline(deliveredAt, windowDays) {
  const deadline = new Date(deliveredAt);
  deadline.setDate(deadline.getDate() + windowDays);
  return deadline;
}

/** { returnable, returnUntil }: returnUntil is the last moment a return can be filed (ISO), or null when nothing has been delivered yet. */
function returnState({ subOrderStatus, orderStatus, deliveredAt, windowDays, now = new Date() }) {
  if (subOrderStatus === 'cancelled' || orderStatus === 'cancelled') return { returnable: false, returnUntil: null };
  if (!deliveredAt) return { returnable: true, returnUntil: null };
  const deadline = returnDeadline(deliveredAt, windowDays);
  return { returnable: now <= deadline, returnUntil: deadline.toISOString() };
}

module.exports = { DEFAULT_WINDOW_DAYS, readReturnWindowDays, returnDeadline, returnState };
