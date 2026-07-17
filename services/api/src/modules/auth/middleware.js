const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const db = require('../../../db/pool');

/**
 * Auth middleware — BUY-001–003 (account management/authentication).
 *
 * Note: env.jwtSecret has a hardcoded insecure fallback ('dev-only-...')
 * for local development convenience, but assertRequiredEnvInProduction()
 * in config/env.js already refuses to boot in production without a real
 * JWT_SECRET set — see that file for the guard.
 */

const TOKEN_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, supplierId: user.supplier_id || user.supplierId || null, hubId: user.hub_id || user.hubId || null },
    env.jwtSecret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/** Rejects the request with 401 if no valid token is present. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: `Invalid or expired token: ${err.message}` });
  }
}

/** Optional auth — attaches req.user if a valid token is present, but doesn't reject if absent. Useful for routes that behave differently for guests vs. logged-in users without requiring login. */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.user = jwt.verify(token, env.jwtSecret);
    } catch {
      // Invalid token on an optional-auth route: proceed as anonymous
      // rather than rejecting, but don't silently pretend it was valid.
      req.user = null;
    }
  }
  next();
}

/** Restricts a route to specific roles. Use after requireAuth. */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${allowedRoles.join(' or ')}` });
    }
    next();
  };
}

/**
 * Real, live check: does this admin user have access to this page?
 * A real owner always does; everything else requires a real row in
 * admin_page_permissions. Shared by both middleware variants below.
 */
async function hasPageAccess(userId, pageId) {
  const { rows } = await db.query('SELECT is_owner FROM users WHERE id = $1', [userId]);
  if (rows.length > 0 && rows[0].is_owner) return true;
  const { rows: permRows } = await db.query(
    'SELECT 1 FROM admin_page_permissions WHERE user_id = $1 AND page_id = $2',
    [userId, pageId]
  );
  return permRows.length > 0;
}

/**
 * Restricts a route to admins who have real, specific access to a given
 * admin dashboard page (migration 022). Use AFTER requireRole('admin').
 *
 * Deliberately a real, LIVE database check every request, not a JWT
 * claim trusted for up to 7 days (the token's own expiry) -- an
 * owner revoking a permission should take effect immediately, not
 * whenever that admin's existing session happens to expire. A real
 * owner (users.is_owner = true) bypasses this check entirely and
 * always has full real access to every page.
 */
function requirePageAccess(pageId) {
  return async (req, res, next) => {
    try {
      const allowed = await hasPageAccess(req.user.sub, pageId);
      if (!allowed) return res.status(403).json({ error: `You don't have access to this page.` });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Same real page-access check as requirePageAccess, but for endpoints
 * genuinely SHARED between buyers/guests and admins (e.g. GET /order,
 * which a buyer calls to see their own orders and an admin calls to
 * see every real order) -- a real buyer/guest is unaffected and passes
 * straight through; only a real admin caller is checked against their
 * real page permissions.
 */
function requirePageAccessIfAdmin(pageId) {
  return async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') return next();
    try {
      const allowed = await hasPageAccess(req.user.sub, pageId);
      if (!allowed) return res.status(403).json({ error: `You don't have access to this page.` });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Restricts a route to the real owner admin (migration 022) — used for
 * managing other admins' accounts and permissions. Also a real, live
 * database check, not a JWT claim, for the same "should take effect
 * immediately" reasoning as requirePageAccess above.
 */
async function requireOwner(req, res, next) {
  try {
    const { rows } = await db.query('SELECT is_owner FROM users WHERE id = $1', [req.user.sub]);
    if (rows.length === 0 || !rows[0].is_owner) {
      return res.status(403).json({ error: 'Only the owner account can manage admin permissions.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole, requirePageAccess, requirePageAccessIfAdmin, requireOwner };
