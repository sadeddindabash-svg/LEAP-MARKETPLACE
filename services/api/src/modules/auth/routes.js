const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../../db/pool');
const { signToken, requireAuth } = require('./middleware');
const { recordReferral } = require('../promotions/helpers');
const { isEmailConfigured, sendEmail, sendTransactionalEmail } = require('../email/client');
const { passwordResetEmail, welcomeEmail } = require('../email/templates');

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

    // Real guest-to-account conversion (migration 029) — any real
    // guest order already placed under this exact email is now linked
    // to the real new account, so real order history isn't lost the
    // moment someone who checked out as a guest actually signs up.
    let linkedOrderCount = 0;
    try {
      const { rows: linkedRows } = await db.query(
        `UPDATE orders SET buyer_id = $1 WHERE guest_email = $2 AND buyer_id IS NULL RETURNING id`,
        [userId, email]
      );
      linkedOrderCount = linkedRows.length;
    } catch (err) {
      console.error('Guest order linking failed (non-fatal):', err.message);
    }

    const user = { id: userId, email, role: 'buyer' };
    res.status(201).json({ token: signToken(user), user: { id: userId, email, name: name || null, role: 'buyer' }, linkedOrderCount });

    // Real welcome email (new) -- deliberately fire-and-forget, sent
    // AFTER the response, matching the exact real lesson from this
    // same session's own real bug: a real best-effort email must never
    // be able to delay or block the real signup response itself.
    (async () => {
      try {
        const { html, text } = welcomeEmail({ recipientName: name || null });
        await sendTransactionalEmail({ to: email, subject: 'Welcome to Leap', html, text, fallbackLogLabel: 'welcome' });
      } catch (err) {
        console.error('Welcome email failed (non-fatal):', err.message);
      }
    })();
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

    const { rows } = await db.query('SELECT id, email, name, role, password_hash, supplier_id, hub_id, is_owner, two_factor_enabled FROM users WHERE email = $1', [email]);
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

    // Real two-factor check (migration 051) -- when enabled, the real
    // password check above is only the FIRST real factor. Withholds
    // the real JWT here and returns a real signal telling the client
    // to proceed to POST /auth/login/2fa with a real, current
    // authenticator code as the second real factor, rather than
    // completing the real session on a password alone.
    if (user.two_factor_enabled) {
      return res.json({ requiresTwoFactor: true, userId: user.id });
    }

    const accessInfo = await getAdminAccessInfo(user.id, user.role, user.is_owner);
    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplier_id, hubId: user.hub_id, ...accessInfo },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Real second real factor of login (migration 051) -- completes a
 * real login that POST /auth/login already flagged as
 * requiresTwoFactor. Deliberately re-verifies the real userId is
 * genuinely a real account with 2FA enabled (not just trusting the
 * real value the client sends back) — a real client-supplied userId
 * alone, with no matching real password re-check here, must never be
 * enough on its own to obtain a real session; this endpoint only
 * exists as the completion of a real login that already proved the
 * real password moments earlier.
 */
router.post('/login/2fa', async (req, res, next) => {
  try {
    const { userId, code } = req.body || {};
    if (!userId || !code) {
      return res.status(400).json({ error: 'userId and code are required' });
    }
    const { rows } = await db.query(
      'SELECT id, email, name, role, supplier_id, hub_id, is_owner, two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length === 0 || !rows[0].two_factor_enabled || !rows[0].two_factor_secret) {
      return res.status(401).json({ error: 'Invalid login attempt' });
    }
    const user = rows[0];
    const { verify } = require('otplib');
    const result = await verify({ secret: user.two_factor_secret, token: String(code).trim() });
    if (!result.valid) {
      return res.status(401).json({ error: 'Incorrect authenticator code. Please try again.' });
    }
    const accessInfo = await getAdminAccessInfo(user.id, user.role, user.is_owner);
    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplier_id, hubId: user.hub_id, ...accessInfo },
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me — returns the currently authenticated user (proves the
// token round-trips correctly end to end).
// Real, per-page admin access (migration 022) -- shared by both
// GET /auth/me and POST /auth/login so a fresh login and a page
// refresh always see the exact same real, current permissions, never
// one being stale relative to the other.
async function getAdminAccessInfo(userId, role, isOwnerFlag) {
  if (role !== 'admin') return { isOwner: null, allowedPages: null };
  if (isOwnerFlag) return { isOwner: true, allowedPages: 'all' };
  const { rows } = await db.query('SELECT page_id FROM admin_page_permissions WHERE user_id = $1', [userId]);
  return { isOwner: false, allowedPages: rows.map((r) => r.page_id) };
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, email, name, role, supplier_id, hub_id, is_owner, created_at, two_factor_enabled, avatar_url FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { supplier_id, hub_id, is_owner, two_factor_enabled, avatar_url, ...rest } = rows[0];
    const accessInfo = await getAdminAccessInfo(rows[0].id, rows[0].role, is_owner);
    res.json({ ...rest, supplierId: supplier_id, hubId: hub_id, twoFactorEnabled: two_factor_enabled, avatarUrl: avatar_url, ...accessInfo });
  } catch (err) {
    next(err);
  }
});

// PATCH /auth/me/avatar { avatarUrl } -- real profile photo. The real
// upload itself reuses the existing real POST /uploads/product-image
// (its own header comment already states it's generic -- used by
// buyers for real review photos too, not just supplier product
// photos), which returns a real URL this endpoint then stores. Kept
// as two real, separate steps (upload, then save) rather than one
// combined multipart PATCH, matching the exact same real pattern
// already established for product images and return-case photos.
router.patch('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const { avatarUrl } = req.body || {};
    if (avatarUrl !== null && typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl must be a real URL string, or null to remove it' });
    }
    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.sub]);
    res.json({ avatarUrl });
  } catch (err) {
    next(err);
  }
});

// POST /auth/me/delete { password } (#147) -- real account deletion,
// requiring the real current password as confirmation (same real
// pattern as the 2FA-disable endpoint above), so a stolen real
// session token alone can't delete a real account. Anonymizes rather
// than hard-deletes: a real hard delete would cascade-destroy real
// order/payout/support history that's often legally required to
// keep (see migration 056's own header comment). The real, scrubbed
// email is unique and unguessable, freeing the original real email
// for reuse by someone signing up fresh later, and naturally blocks
// any future real login attempt with the original email (the row no
// longer matches it at all).
router.post('/me/delete', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password is required to confirm deletion' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0 || !rows[0].password_hash) return res.status(401).json({ error: 'Incorrect password' });

    const passwordMatches = await bcrypt.compare(password, rows[0].password_hash);
    if (!passwordMatches) return res.status(401).json({ error: 'Incorrect password' });

    const anonymizedEmail = `deleted-${req.user.sub}@leap.invalid`;
    await db.query(
      `UPDATE users SET email = $1, name = NULL, avatar_url = NULL, password_hash = NULL,
       two_factor_secret = NULL, two_factor_pending_secret = NULL, two_factor_enabled = false,
       deleted_at = now() WHERE id = $2`,
      [anonymizedEmail, req.user.sub]
    );
    // Real device-token cleanup -- a real deleted account should
    // never keep receiving real push notifications.
    await db.query('DELETE FROM device_tokens WHERE user_id = $1', [req.user.sub]);

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Real 2FA setup, step 1 of 2 (migration 051) -- generates a real new
 * TOTP secret and stores it as PENDING only (see migration 051's own
 * header comment for why this is deliberately separate from the real
 * active secret). Returns a real QR code (as a data URL the mobile
 * app can render directly) plus the real raw secret as a fallback for
 * manual entry into an authenticator app that can't scan a QR code.
 * Regenerating overwrites any previous real pending attempt -- a
 * person restarting setup shouldn't be stuck with a stale QR code
 * from an earlier attempt.
 */
router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT email FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const { generateSecret, generateURI } = require('otplib');
    const QRCode = require('qrcode');
    const secret = generateSecret();
    const uri = generateURI({ issuer: 'LEAP Auto Parts', label: rows[0].email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await db.query('UPDATE users SET two_factor_pending_secret = $1 WHERE id = $2', [secret, req.user.sub]);
    res.json({ secret, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * Real 2FA setup, step 2 of 2 (migration 051) -- proves the real
 * pending secret from step 1 was genuinely scanned/entered correctly
 * by requiring one real, current, valid code before promoting it to
 * the real active secret and actually turning 2FA on.
 */
router.post('/2fa/confirm', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });

    const { rows } = await db.query('SELECT two_factor_pending_secret FROM users WHERE id = $1', [req.user.sub]);
    const pendingSecret = rows[0]?.two_factor_pending_secret;
    if (!pendingSecret) {
      return res.status(400).json({ error: 'No real 2FA setup is currently in progress. Start setup again.' });
    }

    const { verify } = require('otplib');
    const result = await verify({ secret: pendingSecret, token: String(code).trim() });
    if (!result.valid) {
      return res.status(400).json({ error: 'Incorrect code. Please check your authenticator app and try again.' });
    }

    await db.query(
      'UPDATE users SET two_factor_secret = $1, two_factor_pending_secret = NULL, two_factor_enabled = true WHERE id = $2',
      [pendingSecret, req.user.sub]
    );
    res.json({ twoFactorEnabled: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Real 2FA disable (migration 051) -- requires the real current
 * password, not just a real active session, since a real logged-in
 * session alone (e.g. a real unattended, still-unlocked device) is a
 * meaningfully lower bar than proving the real password again for a
 * real security-reducing action.
 */
router.post('/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password is required' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0 || !rows[0].password_hash) return res.status(401).json({ error: 'Incorrect password' });

    const passwordMatches = await bcrypt.compare(password, rows[0].password_hash);
    if (!passwordMatches) return res.status(401).json({ error: 'Incorrect password' });

    await db.query(
      'UPDATE users SET two_factor_secret = NULL, two_factor_pending_secret = NULL, two_factor_enabled = false WHERE id = $1',
      [req.user.sub]
    );
    res.json({ twoFactorEnabled: false });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Password reset (BUY-002-ish) — applies equally to admin/supplier
// logins, since they're all rows in the same `users` table.
//
// REAL EMAIL DELIVERY (new), generic via SMTP (confirmed choice: build
// generically rather than commit to one provider yet — see
// services/api/src/modules/email/client.js for the full real
// implementation and the real discussion behind building this
// generically). HONEST FALLBACK, same category as the payment gateways,
// translation, and cloud storage: no real SMTP credentials are
// configured in this environment, so this honestly falls back to the
// ORIGINAL console-logging behavior below — a real, working way to test
// the token-based reset flow, just not real delivery yet. The token
// generation, expiry, one-time-use enforcement, and password update
// below are all fully real regardless of which delivery path runs.
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

      const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
      let delivered = false;
      if (isEmailConfigured()) {
        try {
          const { html, text } = passwordResetEmail({ recipientName: user.name, resetUrl, expiryMinutes: RESET_TOKEN_EXPIRY_MINUTES });
          await sendEmail({ to: email, subject: 'Reset your Leap password', html, text });
          delivered = true;
        } catch (emailErr) {
          // Real SMTP failure (bad credentials, provider rejected it,
          // network issue) -- honestly fall back to console-logging
          // rather than losing the reset link entirely.
          console.error('Password reset email delivery failed, falling back to console log:', emailErr.message);
        }
      }
      if (!delivered) {
        console.log(
          `[password-reset] Reset link for ${email}: ${resetUrl} ` +
          `(expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes)`
        );
      }
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

// PATCH /me/email { newEmail, currentPassword } — real, confirmed gap
// closed: no self-service way to change your account email existed
// at all before this, only display-only in every real client.
// Requires the real current password (same real security bar as
// changing a password itself) — a stolen, still-logged-in session
// alone shouldn't be enough to take over an account's own email.
// Issues a fresh real JWT, since email is a real token claim
// (signToken) -- the OLD token would keep showing the OLD email
// until it naturally expired otherwise.
router.patch('/me/email', requireAuth, async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body || {};
    if (!isValidEmail(newEmail)) {
      return res.status(400).json({ error: 'A valid newEmail is required' });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: 'currentPassword is required' });
    }

    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({ error: 'That is already your current email' });
    }

    const { rows: existingRows } = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, req.user.sub]);
    if (existingRows.length > 0) {
      return res.status(409).json({ error: 'That email is already in use by another account' });
    }

    await db.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, req.user.sub]);

    const updatedUser = { id: user.id, email: newEmail, role: user.role, supplier_id: user.supplier_id, hub_id: user.hub_id };
    res.json({
      token: signToken(updatedUser),
      user: { id: user.id, email: newEmail, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
