const express = require('express');

/**
 * User module — buyer, supplier, and admin accounts (SRS Section 7.1).
 * Guest checkout means this module must support a lightweight
 * "claim this order" flow post-purchase rather than requiring account
 * creation before checkout — see BUY-001–005 and the Charter's guest
 * checkout decision.
 */
const router = express.Router();

const users = new Map(); // userId -> user

// POST /user/guest-claim  { guestEmail, orderId } — offered on the order
// confirmation screen, not before checkout.
router.post('/guest-claim', (req, res) => {
  const { guestEmail, orderId } = req.body || {};
  if (!guestEmail || !orderId) {
    return res.status(400).json({ error: 'guestEmail and orderId are required' });
  }
  // TODO: create or find a user by email, link the guest order to it,
  // send an account-setup/password link. Placeholder response below.
  res.status(202).json({ message: 'Account setup link would be sent', guestEmail, orderId });
});

router.get('/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
