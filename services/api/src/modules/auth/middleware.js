const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');

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

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
