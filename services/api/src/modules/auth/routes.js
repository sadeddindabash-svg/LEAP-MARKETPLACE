const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../../db/pool');
const { signToken, requireAuth } = require('./middleware');
const { recordReferral } = require('../promotions/helpers');

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
    const { email, password, name, referralCode } = req.body || {};
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

    // Real referral capture (migration 020) — an invalid/made-up code
    // or a self-referral attempt is a silent, honest no-op here, not a
    // signup error; see promotions/helpers.js's recordReferral for why.
    await recordReferral(referralCode, userId);

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

    const { rows } = await db.query('SELECT id, email, name, role, password_hash, supplier_id, hub_id FROM users WHERE email = $1', [email]);
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplier_id, hubId: user.hub_id },
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — returns the currently authenticated user (proves the
// token round-trips correctly end to end).
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, email, name, role, supplier_id, hub_id, created_at FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { supplier_id, hub_id, ...rest } = rows[0];
    res.json({ ...rest, supplierId: supplier_id, hubId: hub_id });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Password reset (BUY-002-ish) — applies equally to admin/supplier
// logins, since they're all rows in the same `users` table.
//
// HONEST LIMITATION, not hidden: no email provider is connected in this
// codebase yet (see Charter Section 4). Rather than fake success without
// actually being able to deliver a reset link, this logs the link to the
// server console — the standard way to build and TEST a real token-based
// reset flow before wiring a real email service on top of it later. The
// token generation, expiry, one-time-use enforcement, and password
// update below are all fully real; only the delivery mechanism is a
// stand-in.
// ============================================================

const RESET_TOKEN_EXPIRY_MINUTES = 60;

// POST /auth/forgot-password  { email }
// Deliberately returns the SAME generic response whether or not the
// email is registered — same email-enumeration protection already used
// for login's "invalid email or password" message above. Never reveals
// which case happened.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const { rows } = await db.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (rows.length > 0) {
      const user = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
      await db.query(
        'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, user.id, expiresAt]
      );

      // STAND-IN for real email delivery — see header comment above.
      console.log(
        `[password-reset] Reset link for ${email}: http://localhost:5173/reset-password?token=${token} ` +
        `(expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes)`
      );
    }

    // Same message regardless of whether the account exists.
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/reset-password  { token, newPassword }
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }

    const { rows } = await db.query('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    const resetToken = rows[0];
    if (resetToken.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }
    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);
    await db.query('UPDATE password_reset_tokens SET used_at = now() WHERE token = $1', [token]);

    res.json({ message: 'Password has been reset. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
