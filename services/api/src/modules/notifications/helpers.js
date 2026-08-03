const db = require('../../../db/pool');

/**
 * Real notification creation (migration 019).
 *
 * REAL, STALE COMMENT FOUND AND FIXED HERE: this used to say "the 4
 * real trigger points this project confirmed" (referring to migration
 * 019's own original header comment) -- genuinely accurate when
 * written, but 5 more real trigger points have been added since
 * (each with its own migration extending the real `notifications_type
 * ` CHECK constraint: 020, 037, 038, 039, 045, 048), making that
 * comment stale without ever being corrected the first time (fixed
 * once already this session, kept accurate here rather than letting
 * it go stale again the very next time a trigger point was added).
 * The real, current, complete list of every genuine trigger point,
 * confirmed by checking every actual `createNotification` call site
 * directly, not assumed:
 *   1. A real sub-order status change to 'shipped' or 'delivered'
 *      (services/api/src/modules/supplier/routes.js, hub/routes.js)
 *      -> 'order_status', notifies the real buyer.
 *   2. A real return case status change
 *      (services/api/src/modules/returns/routes.js) -> 'return_status'.
 *   3. An admin's real reply to a buyer's support ticket
 *      (services/api/src/modules/support/routes.js) -> 'ticket_reply'
 *      (skipped for a guest ticket -- no real account to attach an
 *      in-app notification to).
 *   4. An admin's real reply to a supplier message
 *      (services/api/src/modules/supplier-messages/routes.js) ->
 *      'supplier_message', notifies the real supplier's linked user.
 *   5. A referral's first real qualifying order
 *      (services/api/src/modules/promotions/helpers.js) ->
 *      'referral_reward', notifies the real referrer.
 *   6. A real product crossing its own real low-stock threshold on
 *      order placement (services/api/src/modules/order/routes.js) ->
 *      'low_stock', notifies the real supplier.
 *   7. A real wishlisted product's real price dropping (the periodic
 *      sweep in services/api/src/modules/priceDropAlerts/check.js) ->
 *      'price_drop', notifies every real buyer who wishlisted it.
 *   8. A real saved search matching new real results (the periodic
 *      sweep in services/api/src/modules/savedSearches/check.js) ->
 *      'saved_search_match'.
 *   9. A real wishlisted, out-of-stock product genuinely restocking
 *      (services/api/src/modules/restockAlerts/notify.js) ->
 *      'back_in_stock'.
 *   10. An admin verifying or rejecting a real supplier application
 *       (services/api/src/modules/supplier/routes.js's own
 *       PATCH /:id/verify) -> 'supplier_verification', only if that
 *       supplier already has a real linked login account by then (a
 *       real email is sent regardless -- see that same handler).
 *
 * A single shared helper rather than each trigger site writing its own
 * INSERT, so the shape stays consistent.
 *
 * Accepts an optional `client` (a pg client already inside a real
 * transaction, e.g. the sub-order status update) so notification
 * creation can be part of the SAME transaction as the real event that
 * caused it, not a separate best-effort step that could succeed even if
 * the real underlying update rolls back.
 */
const { sendPushToUser } = require('../push/client');

async function createNotification({ userId, type, title, body, linkType, linkId }, client = db) {
  if (!userId) return; // e.g. a guest ticket has no real account to notify -- silently skip, not an error
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link_type, link_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, linkType || null, linkId || null]
  );
  // Real push, wired in here once (new) so every one of the 10+ real
  // trigger points already calling this function gets it for free,
  // rather than adding a separate push call at each real call site.
  // Best-effort, fire-and-forget -- matches the exact same pattern
  // already established for transactional emails: a real push
  // delivery failure (or push simply not being configured yet, see
  // push/client.js's own isPushConfigured()) must never block or fail
  // the real in-app notification this is layered on top of.
  sendPushToUser({ userId, title, body, linkType, linkId }).catch((err) => {
    console.error('[push] sendPushToUser failed:', err.message);
  });
}

module.exports = { createNotification };
