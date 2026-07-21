const db = require('../../../db/pool');

/**
 * Real audit log of admin actions (migration 036). CONFIRMED SCOPE: a
 * practical subset of sensitive, state-changing admin actions, not
 * literally every admin endpoint.
 *
 * Real, best-effort, fire-and-forget -- a genuine logging failure
 * should never break the real underlying admin action itself (a
 * payout should still be recorded even if, somehow, writing its audit
 * row fails). Matches the same real pattern used for best-effort
 * notifications/emails elsewhere in this project.
 */
async function logAdminAction(req, action, targetType, targetId, details = null) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, admin_email, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.sub, req.user.email, action, targetType, targetId ? String(targetId) : null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[audit] Failed to write a real audit log entry (non-fatal):', err.message);
  }
}

module.exports = { logAdminAction };
