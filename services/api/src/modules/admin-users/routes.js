const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requireOwner } = require('../auth/middleware');

/**
 * Real admin team & permissions management (migration 022). Owner-only
 * — see auth/middleware.js's requireOwner. CONFIRMED SCOPE: page-level
 * access control (can a given admin see a given page, yes/no), not
 * finer view-vs-edit control within a page — a real, deliberate future
 * step, not built here.
 *
 * The real, canonical list of page ids — must match
 * apps/admin-dashboard/src/App.jsx's NAV array exactly. 'settings' is a
 * real, togglable permission like any other page (e.g. so a scoped
 * admin could see Commission Rules) — but the Team & Permissions
 * management section WITHIN Settings is unconditionally owner-only
 * regardless of whether a given admin has 'settings' access, enforced
 * by requireOwner on these routes themselves, not by hiding a UI button.
 */
const VALID_PAGE_IDS = [
  'overview', 'orders', 'suppliers', 'moderation', 'returns', 'vehicleData',
  'categories', 'supplierMessages', 'promoCodes', 'hubs', 'pricing', 'flagged',
  'payouts', 'tickets', 'settings', 'reviews',
];

const router = express.Router();

function toAdminUserDto(row, allowedPages) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isOwner: row.is_owner,
    allowedPages: row.is_owner ? 'all' : allowedPages,
    createdAt: row.created_at,
  };
}

router.get('/', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT id, email, name, is_owner, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC");
    const dtos = await Promise.all(rows.map(async (r) => {
      if (r.is_owner) return toAdminUserDto(r, []);
      const { rows: permRows } = await db.query('SELECT page_id FROM admin_page_permissions WHERE user_id = $1', [r.id]);
      return toAdminUserDto(r, permRows.map((p) => p.page_id));
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { email, password, name, allowedPages } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const pages = Array.isArray(allowedPages) ? allowedPages : [];
    const invalidPages = pages.filter((p) => !VALID_PAGE_IDS.includes(p));
    if (invalidPages.length > 0) {
      return res.status(400).json({ error: `Unknown page id(s): ${invalidPages.join(', ')}` });
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `u_${Date.now()}`;
    await client.query(
      `INSERT INTO users (id, email, name, role, password_hash, is_owner) VALUES ($1, $2, $3, 'admin', $4, false)`,
      [userId, email, name || null, passwordHash]
    );
    for (const pageId of pages) {
      await client.query('INSERT INTO admin_page_permissions (user_id, page_id) VALUES ($1, $2)', [userId, pageId]);
    }
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT id, email, name, is_owner, created_at FROM users WHERE id = $1', [userId]);
    res.status(201).json(toAdminUserDto(rows[0], pages));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /admin-users/:id/permissions — a real, full replace of which
// pages this admin can access (simpler and less error-prone than
// incremental add/remove calls that could drift from the real intended
// state if one of several calls failed partway through).
router.patch('/:id/permissions', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const { allowedPages } = req.body || {};
    const pages = Array.isArray(allowedPages) ? allowedPages : [];
    const invalidPages = pages.filter((p) => !VALID_PAGE_IDS.includes(p));
    if (invalidPages.length > 0) {
      return res.status(400).json({ error: `Unknown page id(s): ${invalidPages.join(', ')}` });
    }

    const userCheck = await client.query("SELECT id, is_owner FROM users WHERE id = $1 AND role = 'admin'", [req.params.id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    if (userCheck.rows[0].is_owner) {
      return res.status(400).json({ error: 'The owner account always has full access — its permissions cannot be edited.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM admin_page_permissions WHERE user_id = $1', [req.params.id]);
    for (const pageId of pages) {
      await client.query('INSERT INTO admin_page_permissions (user_id, page_id) VALUES ($1, $2)', [req.params.id, pageId]);
    }
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT id, email, name, is_owner, created_at FROM users WHERE id = $1', [req.params.id]);
    res.json(toAdminUserDto(rows[0], pages));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), requireOwner, async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'You cannot remove your own account.' });
    }
    const userCheck = await db.query("SELECT id, is_owner FROM users WHERE id = $1 AND role = 'admin'", [req.params.id]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Admin user not found' });
    if (userCheck.rows[0].is_owner) {
      return res.status(400).json({ error: 'The owner account cannot be removed.' });
    }
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
