const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requireOwner } = require('../auth/middleware');

/**
 * Real audit log viewing (migration 036) -- owner-only, matching the
 * same real restriction already used for admin account management
 * (requireOwner) -- who did what across the whole real platform is
 * sensitive enough that it shouldn't be visible to every admin, only
 * the one account with full real oversight.
 */
const router = express.Router();

function toAuditLogDto(row) {
  return {
    id: row.id,
    adminEmail: row.admin_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    createdAt: row.created_at,
  };
}

// GET /admin/audit-log?action=...&startDate=...&endDate=...&limit=...
// -- real, most recent first, optionally filtered by a specific real
// action type and/or a real date range. Capped at a real, reasonable
// default (200) rather than returning an ever-growing real table in
// full on every request.
router.get('/', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  try {
    const { action, startDate, endDate, limit } = req.query;
    const cappedLimit = Math.min(Number(limit) || 200, 500);
    const params = [];
    const conditions = [];
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }
    // Real date-range filter (new) -- endDate is treated as inclusive
    // of the whole real day (< endDate + 1 day), not just midnight of
    // that day, since an admin picking "today" as the end date
    // genuinely means "through the end of today," not "through
    // 00:00:00 today."
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at < ($${params.length}::date + interval '1 day')`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(cappedLimit);
    const { rows } = await db.query(
      `SELECT * FROM admin_audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json(rows.map(toAuditLogDto));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
