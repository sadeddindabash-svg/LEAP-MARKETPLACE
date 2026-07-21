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

// GET /admin/audit-log?action=...&limit=...  -- real, most recent
// first, optionally filtered by a specific real action type. Capped
// at a real, reasonable default (200) rather than returning an
// ever-growing real table in full on every request.
router.get('/', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  try {
    const { action, limit } = req.query;
    const cappedLimit = Math.min(Number(limit) || 200, 500);
    const params = [];
    let where = '';
    if (action) {
      params.push(action);
      where = `WHERE action = $${params.length}`;
    }
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
