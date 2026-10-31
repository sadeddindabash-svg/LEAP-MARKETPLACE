const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { generateTemporaryPassword } = require('../hub-staff/routes');
const { createRateLimiter } = require('./rateLimit');

/**
 * Delivery DRIVERS of the local delivery partner (migration 120).
 *
 * They are NOT users of the marketplace: their own table, their own sign-in, and their sign-in token is signed with a DIFFERENT secret than
 * everyone else's, so it can never be used anywhere else in the API (it only works on the courier page's /proof routes).
 *
 *   POST /proof-driver/login   { phone, password }  -> { token, driver }     (the courier page signs in once; stays signed in for 30 days)
 *   GET  /proof-driver/me                              -> { driver }
 *
 *   Admin (Hubs page -> Delivery drivers), same rules as hub staff accounts: the server makes a temporary password and shows it ONCE,
 *   drivers are disabled (never deleted, every proof points at its driver), every change is in the audit log.
 *   GET /delivery-drivers   POST /delivery-drivers {name, phone, company}   PATCH /delivery-drivers/:id
 *   POST /delivery-drivers/:id/disable | /enable | /reset-password
 *
 * Disabling works at once (checked on every request). A password reset ends every sign-in the driver already has (token_version).
 */
const TOKEN_EXPIRY = '30d';
const driverSecret = () => `${env.jwtSecret}:delivery-driver`;

// "+966 50-123 4567" and "+966501234567" are the same phone
const cleanPhone = (value) => (typeof value === 'string' ? value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '') : '');
const PHONE_PATTERN = /^\+?\d{7,15}$/;

function signDriverToken(driver) {
  return jwt.sign({ kind: 'delivery_driver', driverId: driver.id, tv: driver.token_version }, driverSecret(), { expiresIn: TOKEN_EXPIRY });
}

const toPublic = (row) => ({ id: row.id, name: row.name, company: row.company });

/** Reads the driver from "Authorization: Bearer <token>". Sets req.driver, or req.driverError ('invalid' | 'disabled') when a token was sent but is no good. */
async function optionalDriver(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next();
    let payload;
    try { payload = jwt.verify(token, driverSecret()); } catch { req.driverError = 'invalid'; return next(); }
    if (payload.kind !== 'delivery_driver' || !Number.isInteger(payload.driverId)) { req.driverError = 'invalid'; return next(); }
    const { rows } = await db.query('SELECT * FROM delivery_drivers WHERE id = $1', [payload.driverId]);
    if (rows.length === 0 || rows[0].token_version !== payload.tv) { req.driverError = 'invalid'; return next(); }
    if (rows[0].disabled_at) { req.driverError = 'disabled'; return next(); }
    req.driver = rows[0];
    next();
  } catch (err) { next(err); }
}

// ---- the driver's own sign-in
const loginRouter = express.Router();
const failedLogins = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

loginRouter.post('/login', async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows } = phone ? await db.query('SELECT * FROM delivery_drivers WHERE phone = $1', [phone]) : { rows: [] };
    const driver = rows[0];
    const ok = driver && password && (await bcrypt.compare(password, driver.password_hash));
    if (!ok) {
      const verdict = failedLogins.hit(`ip:${req.ip}`);
      if (!verdict.allowed) return res.set('Retry-After', String(verdict.retryAfterSeconds)).status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
      return res.status(401).json({ error: 'Wrong phone number or password.' });
    }
    if (driver.disabled_at) return res.status(403).json({ error: 'This driver account is turned off. Contact Leap.', code: 'account_disabled' });
    await db.query('UPDATE delivery_drivers SET last_login_at = now() WHERE id = $1', [driver.id]);
    res.json({ token: signDriverToken(driver), driver: toPublic(driver) });
  } catch (err) { next(err); }
});

loginRouter.get('/me', optionalDriver, (req, res) => {
  if (!req.driver) return res.status(401).json({ error: 'Please sign in.', code: req.driverError === 'disabled' ? 'account_disabled' : 'driver_login_required' });
  res.json({ driver: toPublic(req.driver) });
});

// ---- admin management
const adminRouter = express.Router();
adminRouter.use(requireAuth, requireRole('admin'), requirePageAccess('hubs'));

const DRIVER_SELECT = `
  SELECT d.id, d.name, d.phone, d.company, d.disabled_at, d.last_login_at, d.created_at,
         (SELECT count(*) FROM delivery_proofs p WHERE p.driver_id = d.id AND p.marked_delivered) AS deliveries,
         (SELECT MAX(p.submitted_at) FROM delivery_proofs p WHERE p.driver_id = d.id) AS last_delivery_at
  FROM delivery_drivers d`;
const toDto = (r) => ({
  id: r.id, name: r.name, phone: r.phone, company: r.company, isDisabled: Boolean(r.disabled_at), disabledAt: r.disabled_at,
  lastLoginAt: r.last_login_at, createdAt: r.created_at, deliveries: Number(r.deliveries || 0), lastDeliveryAt: r.last_delivery_at,
});
async function loadDriver(id) {
  if (!/^\d+$/.test(String(id))) return null;
  const { rows } = await db.query(`${DRIVER_SELECT} WHERE d.id = $1`, [id]);
  return rows[0] ? toDto(rows[0]) : null;
}
function readFields(body, current = {}) {
  const name = body.name === undefined ? current.name : String(body.name || '').trim();
  const company = body.company === undefined ? current.company : String(body.company || '').trim();
  const phone = body.phone === undefined ? current.phone : cleanPhone(body.phone);
  if (!name) return { error: 'Name is required.' };
  if (!company) return { error: 'Delivery company is required.' };
  if (!PHONE_PATTERN.test(phone || '')) return { error: 'A valid phone number is required (it is what the driver signs in with).' };
  return { name: name.slice(0, 80), company: company.slice(0, 80), phone };
}

adminRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`${DRIVER_SELECT} ORDER BY d.disabled_at IS NOT NULL, d.created_at DESC`);
    res.json(rows.map(toDto));
  } catch (err) { next(err); }
});

adminRouter.post('/', async (req, res, next) => {
  try {
    const f = readFields(req.body || {});
    if (f.error) return res.status(400).json({ error: f.error });
    const { rows: taken } = await db.query('SELECT 1 FROM delivery_drivers WHERE phone = $1', [f.phone]);
    if (taken.length > 0) return res.status(409).json({ error: 'A driver with this phone number already exists.' });
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);
    const { rows } = await db.query('INSERT INTO delivery_drivers (name, phone, company, password_hash) VALUES ($1, $2, $3, $4) RETURNING id', [f.name, f.phone, f.company, hash]);
    await logAdminAction(req, 'delivery_driver_created', 'delivery_driver', String(rows[0].id), { phone: f.phone, company: f.company });
    res.status(201).json({ driver: await loadDriver(rows[0].id), temporaryPassword });
  } catch (err) { next(err); }
});

adminRouter.patch('/:id', async (req, res, next) => {
  try {
    const current = await loadDriver(req.params.id);
    if (!current) return res.status(404).json({ error: 'Driver not found.' });
    const f = readFields(req.body || {}, current);
    if (f.error) return res.status(400).json({ error: f.error });
    if (f.phone !== current.phone) {
      const { rows: taken } = await db.query('SELECT 1 FROM delivery_drivers WHERE phone = $1 AND id <> $2', [f.phone, current.id]);
      if (taken.length > 0) return res.status(409).json({ error: 'A driver with this phone number already exists.' });
    }
    await db.query('UPDATE delivery_drivers SET name = $1, phone = $2, company = $3 WHERE id = $4', [f.name, f.phone, f.company, current.id]);
    const details = {};
    for (const k of ['name', 'phone', 'company']) if (f[k] !== current[k]) details[k] = { from: current[k], to: f[k] };
    if (Object.keys(details).length > 0) await logAdminAction(req, 'delivery_driver_updated', 'delivery_driver', String(current.id), details);
    res.json(await loadDriver(current.id));
  } catch (err) { next(err); }
});

function setDisabled(shouldDisable) {
  return async (req, res, next) => {
    try {
      const current = await loadDriver(req.params.id);
      if (!current) return res.status(404).json({ error: 'Driver not found.' });
      if (current.isDisabled !== shouldDisable) {
        await db.query(`UPDATE delivery_drivers SET disabled_at = ${shouldDisable ? 'now()' : 'NULL'} WHERE id = $1`, [current.id]);
        await logAdminAction(req, shouldDisable ? 'delivery_driver_disabled' : 'delivery_driver_enabled', 'delivery_driver', String(current.id), { phone: current.phone });
      }
      res.json(await loadDriver(current.id));
    } catch (err) { next(err); }
  };
}
adminRouter.post('/:id/disable', setDisabled(true));
adminRouter.post('/:id/enable', setDisabled(false));

adminRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const current = await loadDriver(req.params.id);
    if (!current) return res.status(404).json({ error: 'Driver not found.' });
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);
    await db.query('UPDATE delivery_drivers SET password_hash = $1, token_version = token_version + 1 WHERE id = $2', [hash, current.id]);
    await logAdminAction(req, 'delivery_driver_password_reset', 'delivery_driver', String(current.id), { phone: current.phone });
    res.json({ driver: current, temporaryPassword });
  } catch (err) { next(err); }
});

module.exports = { loginRouter, adminRouter, optionalDriver, signDriverToken, cleanPhone };
