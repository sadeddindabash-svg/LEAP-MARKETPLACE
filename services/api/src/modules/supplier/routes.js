const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

/**
 * Supplier module — SUP-001–003 (onboarding/verification) from the
 * supplier's own side; this is the ADMIN-facing view (ADM-001: review,
 * approve, reject supplier accounts).
 *
 * Admin-only: both routes require an authenticated admin. There is no
 * supplier-facing login/session yet (see the Supplier Portal prototype) —
 * this module only covers the platform-admin half of supplier management.
 */
const router = express.Router();

function toSupplierDto(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    contactEmail: row.contact_email,
    verificationStatus: row.verification_status,
    listingCount: Number(row.listing_count) || 0,
    createdAt: row.created_at,
  };
}

// GET /supplier — admin only. Listing count is derived via a live join
// against products rather than stored, so it's never stale.
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, COUNT(p.id) AS listing_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows.map(toSupplierDto));
  } catch (err) {
    next(err);
  }
});

// PATCH /supplier/:id/verify  { status: 'verified' | 'rejected' }
router.patch('/:id/verify', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "status must be 'verified' or 'rejected'" });
    }
    const { rows } = await db.query(
      `UPDATE suppliers SET verification_status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    // Note: listingCount is intentionally omitted here (not re-joined) —
    // the client already has it from the list view and this response is
    // just confirming the status change, not a full record refresh.
    const { id, name, country, contact_email, verification_status, created_at } = rows[0];
    res.json({ id, name, country, contactEmail: contact_email, verificationStatus: verification_status, createdAt: created_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
