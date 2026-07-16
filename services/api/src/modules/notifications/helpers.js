const db = require('../../../db/pool');

/**
 * Real notification creation (migration 019). Called from the 4 real
 * trigger points this project confirmed — see that migration's header
 * comment for the full list. A single shared helper rather than each
 * trigger site writing its own INSERT, so the shape stays consistent.
 *
 * Accepts an optional `client` (a pg client already inside a real
 * transaction, e.g. the sub-order status update) so notification
 * creation can be part of the SAME transaction as the real event that
 * caused it, not a separate best-effort step that could succeed even if
 * the real underlying update rolls back.
 */
async function createNotification({ userId, type, title, body, linkType, linkId }, client = db) {
  if (!userId) return; // e.g. a guest ticket has no real account to notify -- silently skip, not an error
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link_type, link_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, linkType || null, linkId || null]
  );
}

module.exports = { createNotification };
