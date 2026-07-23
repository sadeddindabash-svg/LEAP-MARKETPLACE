const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');

/**
 * Real admin global search (new) -- closes a real, confirmed gap: the
 * admin dashboard's TopBar search box was 100% decorative, a <span>
 * with placeholder text ("Search orders, suppliers, tickets…"), not
 * even a real <input>, confirmed directly by reading the component
 * before assuming anything needed building.
 *
 * Deliberately a single combined endpoint rather than three separate
 * ones -- the TopBar shows one unified dropdown across all three real
 * categories as the admin types, so one round-trip is genuinely
 * simpler than three the client would need to coordinate anyway.
 *
 * Each category is capped at a small real limit (5) -- this is a
 * type-ahead dropdown, not a real search-results page; showing more
 * than a handful per category would overflow the dropdown for no real
 * benefit (an admin who needs more than that already knows to go to
 * the real Orders/Suppliers/Tickets page directly and filter there).
 */
const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ orders: [], suppliers: [], tickets: [] });

    const likeParam = `%${q}%`;

    const { rows: orderRows } = await db.query(
      `SELECT id, status, total, currency_code FROM orders WHERE id ILIKE $1 ORDER BY placed_at DESC LIMIT 5`,
      [likeParam]
    );
    const { rows: supplierRows } = await db.query(
      `SELECT id, name, verification_status FROM suppliers WHERE name ILIKE $1 ORDER BY name ASC LIMIT 5`,
      [likeParam]
    );
    const { rows: ticketRows } = await db.query(
      `SELECT id, subject, status FROM support_tickets WHERE id ILIKE $1 OR subject ILIKE $1 ORDER BY updated_at DESC LIMIT 5`,
      [likeParam]
    );

    res.json({
      orders: orderRows.map((r) => ({ id: r.id, label: r.id, sublabel: `${r.currency_code} ${Number(r.total).toFixed(2)} · ${r.status.replace(/_/g, ' ')}` })),
      suppliers: supplierRows.map((r) => ({ id: r.id, label: r.name, sublabel: r.verification_status })),
      tickets: ticketRows.map((r) => ({ id: r.id, label: r.subject, sublabel: `${r.id} · ${r.status.replace(/_/g, ' ')}` })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
