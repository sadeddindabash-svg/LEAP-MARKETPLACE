const express = require('express');
const db = require('../../../db/pool');

/**
 * User module — buyer, supplier, and admin accounts (SRS Section 7.1).
 * Guest checkout means this module must support a lightweight
 * "claim this order" flow post-purchase rather than requiring account
 * creation before checkout — see BUY-001–005 and the Charter's guest
 * checkout decision.
 *
 * User lookup is now backed by PostgreSQL. guest-claim remains a stub
 * (no real auth/email flow yet) but now actually creates the user row
 * rather than doing nothing — see the TODO below for what's still missing.
 */
const router = express.Router();

// POST /user/guest-claim  { guestEmail, orderId } — offered on the order
// confirmation screen, not before checkout.
router.post('/guest-claim', async (req, res, next) => {
  try {
    const { guestEmail, orderId } = req.body || {};
    if (!guestEmail || !orderId) {
      return res.status(400).json({ error: 'guestEmail and orderId are required' });
    }
    const { rows } = await db.query(
      `INSERT INTO users (id, email, role) VALUES ($1, $2, 'buyer')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [`u_${Date.now()}`, guestEmail]
    );
    // TODO: link orders.guest_email -> orders.buyer_id for this order, and
    // send a real account-setup/password link (no email provider wired up
    // yet — see notification module and Charter Section 4).
    res.status(202).json({ message: 'Account setup link would be sent', userId: rows[0].id, guestEmail, orderId });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
