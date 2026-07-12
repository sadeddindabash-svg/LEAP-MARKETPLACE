const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../../db/pool');
const { signToken, requireAuth } = require('./middleware');

/**
 * Auth module — BUY-001–003. Real password hashing (bcrypt, 10 salt
 * rounds) and JWT session tokens. Deliberately uses bcryptjs (pure
 * JavaScript) rather than native bcrypt — avoids requiring a C++ build
 * toolchain on every developer's machine (this project's dev team includes
 * non-technical stakeholders on Windows without build tools set up), at a
 * modest performance cost that's irrelevant at this scale.
 *
 * Guest checkout is unaffected — POST /order still works without any of
 * this, per the product decision in the Charter. This module is for
 * buyers who want an account (either signing up directly, or claiming a
 * guest order via /user/guest-claim, which should be upgraded to set a
 * real password through here in a future pass — currently guest-claim
 * still just creates a passwordless user row).
 */
const router = express.Router();
const SALT_ROUNDS = 10;

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /auth/signup  { email, password, name? }
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = `u_${Date.now()}`;
    await db.query(
      `INSERT INTO users (id, email, name, role, password_hash) VALUES ($1, $2, $3, 'buyer', $4)`,
      [userId, email, name || null, passwordHash]
    );

    const user = { id: userId, email, role: 'buyer' };
    res.status(201).json({ token: signToken(user), user: { id: userId, email, name: name || null, role: 'buyer' } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await db.query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1', [email]);
    // Deliberately identical error for "no such user" and "wrong password"
    // — do not reveal which one it was, that leaks whether an email is registered.
    const genericError = { error: 'Invalid email or password' };

    if (rows.length === 0) return res.status(401).json(genericError);
    const user = rows[0];
    if (!user.password_hash) {
      // A guest-checkout-created user with no password set yet.
      return res.status(401).json({ error: 'This account has no password set yet. Use the account-setup link sent after your order, or sign up.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) return res.status(401).json(genericError);

    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — returns the currently authenticated user (proves the
// token round-trips correctly end to end).
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
