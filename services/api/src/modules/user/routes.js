const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * User module — buyer, supplier, and admin accounts (SRS Section 7.1).
 * Guest checkout means this module must support a lightweight
 * "claim this order" flow post-purchase rather than requiring account
 * creation before checkout — see BUY-001–005 and the Charter's guest
 * checkout decision.
 *
 * GET /user/:id now requires authentication and only allows a user to view
 * their own profile (or an admin to view anyone's) — see the ownership
 * check below. guest-claim remains open (no auth required, by definition —
 * a guest doesn't have a session yet).
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

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const isSelf = req.user.sub === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'You can only view your own profile' });
    }
    const { rows } = await db.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
