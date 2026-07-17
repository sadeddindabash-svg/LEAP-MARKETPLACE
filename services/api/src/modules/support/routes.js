const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, optionalAuth, requirePageAccess } = require('../auth/middleware');
const { createNotification } = require('../notifications/helpers');

/**
 * Support module — BUY-060/061 (buyer <-> Platform support, logged and
 * linked to the relevant order) and ADM-012 (admin views/responds).
 *
 * IMPORTANT: there is no buyer<->supplier messaging path here, by explicit
 * business requirement (SRS Section 2.5). Every message is either from a
 * buyer/guest or from platform staff — never routed to a supplier.
 *
 * Buyer-side viewing (GET /support/my-tickets...) requires a real login —
 * guest-checkout tickets aren't viewable without an account, matching the
 * same pattern already used for order history (GET /order is also
 * login-only). This was flagged as a known gap in an earlier pass and is
 * now closed for authenticated buyers.
 */
const router = express.Router();

async function nextTicketId(client) {
  const { rows } = await client.query("SELECT nextval('ticket_id_seq') AS n");
  return `T-${rows[0].n}`;
}

function toTicketSummaryDto(row) {
  return {
    id: row.id,
    subject: row.subject,
    buyerId: row.buyer_id,
    guestEmail: row.guest_email,
    orderId: row.order_id,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// POST /support/tickets — buyer (authenticated, optional) or guest.
// { subject, message, orderId?, guestEmail? }
router.post('/tickets', optionalAuth, async (req, res, next) => {
  const { subject, message, orderId, guestEmail } = req.body || {};
  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }
  const buyerId = req.user ? req.user.sub : null;
  if (!buyerId && !guestEmail) {
    return res.status(400).json({ error: 'guestEmail is required when not logged in' });
  }

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const id = await nextTicketId(client);
    await client.query(
      `INSERT INTO support_tickets (id, buyer_id, guest_email, order_id, subject) VALUES ($1, $2, $3, $4, $5)`,
      [id, buyerId, buyerId ? null : guestEmail, orderId || null, subject]
    );
    await client.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_role, message) VALUES ($1, 'buyer', $2)`,
      [id, message]
    );
    await client.query('COMMIT');
    res.status(201).json({ id, subject, status: 'open', priority: 'medium' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /support/tickets — admin-only, every ticket in the system.
router.get('/tickets', requireAuth, requireRole('admin'), requirePageAccess('tickets'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM support_tickets ORDER BY updated_at DESC');
    res.json(rows.map(toTicketSummaryDto));
  } catch (err) {
    next(err);
  }
});

// GET /support/tickets/:id — admin-only (see "known gap" above).
router.get('/tickets/:id', requireAuth, requireRole('admin'), requirePageAccess('tickets'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const { rows: messages } = await db.query(
      'SELECT sender_role, message, created_at FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({
      ...toTicketSummaryDto(rows[0]),
      messages: messages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /support/tickets/:id/messages — admin reply. { message }
router.post('/tickets/:id/messages', requireAuth, requireRole('admin'), requirePageAccess('tickets'), async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ticketCheck = await db.query('SELECT id, buyer_id, subject FROM support_tickets WHERE id = $1', [req.params.id]);
    if (ticketCheck.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    await db.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_role, message) VALUES ($1, 'admin', $2)`,
      [req.params.id, message]
    );
    await db.query(`UPDATE support_tickets SET updated_at = now(), status = 'in_progress' WHERE id = $1 AND status = 'open'`, [req.params.id]);

    // Real trigger #3 (of the 4 confirmed for notifications — see
    // migration 019's header comment): an admin's real reply to a
    // buyer's support ticket notifies the real buyer. Skipped for a
    // guest ticket (buyer_id is null) -- no real account to attach a
    // notification to.
    await createNotification({
      userId: ticketCheck.rows[0].buyer_id,
      type: 'ticket_reply',
      title: 'New reply on your support ticket',
      body: `"${ticketCheck.rows[0].subject}": ${message}`,
      linkType: 'ticket',
      linkId: req.params.id,
    });

    res.status(201).json({ senderRole: 'admin', message });
  } catch (err) {
    next(err);
  }
});

// PATCH /support/tickets/:id  { status: 'open' | 'in_progress' | 'resolved' }
router.patch('/tickets/:id', requireAuth, requireRole('admin'), requirePageAccess('tickets'), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: "status must be 'open', 'in_progress', or 'resolved'" });
    }
    const { rows } = await db.query(
      `UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(toTicketSummaryDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Buyer-facing: view and continue your OWN tickets (login required).
// ============================================================

router.get('/my-tickets', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM support_tickets WHERE buyer_id = $1 ORDER BY updated_at DESC', [req.user.sub]);
    res.json(rows.map(toTicketSummaryDto));
  } catch (err) {
    next(err);
  }
});

router.get('/my-tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM support_tickets WHERE id = $1 AND buyer_id = $2', [req.params.id, req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const { rows: messages } = await db.query(
      'SELECT sender_role, message, created_at FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({
      ...toTicketSummaryDto(rows[0]),
      messages: messages.map((m) => ({ senderRole: m.sender_role, message: m.message, createdAt: m.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /support/my-tickets/:id/messages — buyer follows up on their own ticket.
router.post('/my-tickets/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message is required' });

    const ownershipCheck = await db.query('SELECT id FROM support_tickets WHERE id = $1 AND buyer_id = $2', [req.params.id, req.user.sub]);
    if (ownershipCheck.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    await db.query(`INSERT INTO support_ticket_messages (ticket_id, sender_role, message) VALUES ($1, 'buyer', $2)`, [req.params.id, message]);
    await db.query('UPDATE support_tickets SET updated_at = now() WHERE id = $1', [req.params.id]);
    res.status(201).json({ senderRole: 'buyer', message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
