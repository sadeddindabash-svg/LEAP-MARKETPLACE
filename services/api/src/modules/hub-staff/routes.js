const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');

/**
 * Hub staff account management (migration 089) -- backs the admin dashboard's
 * "Hub staff" section on the Hubs page.
 *
 * WHO: any admin with access to the Hubs page (the same people who already
 * create hubs and assign shipments to them). Every change is written to the
 * audit log -- hub staff can mark shipments received/shipped, which feeds
 * payouts, so who created/disabled/reset whom must be traceable.
 *
 * Every query below is restricted to role = 'hub_staff', so this can never be
 * used to touch an admin, supplier or buyer account.
 *
 * Staff are DISABLED, never deleted: every shipment event points at the user
 * who performed it, so a deleted user would break that history.
 *
 * PASSWORDS: the server generates a random temporary password on create and on
 * reset, and returns it ONCE in that response. It is never stored in plain
 * text, never logged, and never returned by GET. (Email isn't configured in
 * every environment, so an emailed reset link can't be the only way in.)
 *
 * Known limit: a password reset does not end a login the person already has
 * open (tokens last 7 days). Disabling does -- see requireAuth.
 */
const router = express.Router();
router.use(requireAuth, requireRole('admin'), requirePageAccess('hubs'));

// Unambiguous characters only (no 0/O, 1/l/I) -- the password gets read out and
// retyped by a person, not just pasted.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 14;

function generateTemporaryPassword() {
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

const STAFF_SELECT = `
  SELECT u.id, u.email, u.name, u.hub_id, h.name AS hub_name, u.disabled_at, u.created_at,
         (SELECT MAX(e.created_at) FROM hub_shipment_events e WHERE e.performed_by = u.id) AS last_activity_at
  FROM users u
  LEFT JOIN hubs h ON h.id = u.hub_id
  WHERE u.role = 'hub_staff'`;

function toStaffDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hubId: row.hub_id,
    hubName: row.hub_name,
    isDisabled: Boolean(row.disabled_at),
    disabledAt: row.disabled_at,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

async function loadStaff(id) {
  const { rows } = await db.query(`${STAFF_SELECT} AND u.id = $1`, [id]);
  return rows.length > 0 ? toStaffDto(rows[0]) : null;
}

async function hubExists(hubId) {
  const { rows } = await db.query('SELECT 1 FROM hubs WHERE id = $1', [hubId]);
  return rows.length > 0;
}

// GET /hub-staff — every hub staff account, newest first.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`${STAFF_SELECT} ORDER BY u.created_at DESC`);
    res.json(rows.map(toStaffDto));
  } catch (err) {
    next(err);
  }
});

// POST /hub-staff { email, name, hubId } — creates the account and returns the
// one-time temporary password.
router.post('/', async (req, res, next) => {
  try {
    const { email, name, hubId } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!cleanName) return res.status(400).json({ error: 'Name is required.' });
    if (!hubId || !(await hubExists(hubId))) return res.status(400).json({ error: 'Choose a valid hub.' });

    // Case-insensitive, so "Sara@x.com" can't be created next to "sara@x.com".
    const { rows: existing } = await db.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [cleanEmail]);
    if (existing.length > 0) return res.status(409).json({ error: 'An account with this email already exists.' });

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const id = `u_${Date.now()}${crypto.randomInt(100, 1000)}`;
    await db.query(
      `INSERT INTO users (id, email, name, role, hub_id, password_hash, must_change_password) VALUES ($1, $2, $3, 'hub_staff', $4, $5, true)`,
      [id, cleanEmail, cleanName, hubId, passwordHash]
    );
    await logAdminAction(req, 'hub_staff_created', 'hub_staff', id, { email: cleanEmail, hubId });
    res.status(201).json({ staff: await loadStaff(id), temporaryPassword });
  } catch (err) {
    next(err);
  }
});

// PATCH /hub-staff/:id { name?, hubId? } — rename, or move to another hub. A move
// takes effect on the person's very next request (see requireAuth).
router.patch('/:id', async (req, res, next) => {
  try {
    const current = await loadStaff(req.params.id);
    if (!current) return res.status(404).json({ error: 'Hub staff account not found.' });

    const { name, hubId } = req.body || {};
    if (name === undefined && hubId === undefined) return res.status(400).json({ error: 'Provide a name or a hub to change.' });

    const newName = name === undefined ? current.name : String(name).trim();
    if (!newName) return res.status(400).json({ error: 'Name cannot be empty.' });
    const newHubId = hubId === undefined ? current.hubId : hubId;
    if (!newHubId || !(await hubExists(newHubId))) return res.status(400).json({ error: 'Choose a valid hub.' });

    await db.query(`UPDATE users SET name = $1, hub_id = $2 WHERE id = $3 AND role = 'hub_staff'`, [newName, newHubId, req.params.id]);
    const details = {};
    if (newName !== current.name) details.name = { from: current.name, to: newName };
    if (newHubId !== current.hubId) details.hubId = { from: current.hubId, to: newHubId };
    if (Object.keys(details).length > 0) await logAdminAction(req, 'hub_staff_updated', 'hub_staff', req.params.id, details);
    res.json(await loadStaff(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /hub-staff/:id/disable and /enable — soft, reversible. Idempotent; only a
// real change is written to the audit log.
function setDisabledHandler(shouldDisable) {
  return async (req, res, next) => {
    try {
      const current = await loadStaff(req.params.id);
      if (!current) return res.status(404).json({ error: 'Hub staff account not found.' });
      if (current.isDisabled !== shouldDisable) {
        await db.query(
          `UPDATE users SET disabled_at = ${shouldDisable ? 'now()' : 'NULL'} WHERE id = $1 AND role = 'hub_staff'`,
          [req.params.id]
        );
        await logAdminAction(req, shouldDisable ? 'hub_staff_disabled' : 'hub_staff_enabled', 'hub_staff', req.params.id, { email: current.email });
      }
      res.json(await loadStaff(req.params.id));
    } catch (err) {
      next(err);
    }
  };
}
router.post('/:id/disable', setDisabledHandler(true));
router.post('/:id/enable', setDisabledHandler(false));

// POST /hub-staff/:id/reset-password — sets a new random temporary password and
// returns it once. The old password stops working immediately.
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const current = await loadStaff(req.params.id);
    if (!current) return res.status(404).json({ error: 'Hub staff account not found.' });
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await db.query(`UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2 AND role = 'hub_staff'`, [passwordHash, req.params.id]);
    // The password itself is deliberately NOT part of the audit details.
    await logAdminAction(req, 'hub_staff_password_reset', 'hub_staff', req.params.id, { email: current.email });
    res.json({ staff: current, temporaryPassword });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.generateTemporaryPassword = generateTemporaryPassword;
