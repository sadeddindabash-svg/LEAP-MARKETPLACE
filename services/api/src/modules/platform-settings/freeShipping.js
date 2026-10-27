// The free-shipping limit and the shipping fee below it (see ../shared/freeShipping.js for the rule). Anyone may READ them (the website and the app show "add $X more for free shipping"); only an admin may change them.
//   GET /platform-settings/free-shipping         { enabled, thresholdUsd, feeUsd }                    (public)
//   GET /platform-settings/free-shipping/admin   the same, plus the limits the admin screen enforces  (admin)
//   PUT /platform-settings/free-shipping         { enabled, thresholdUsd, feeUsd }                    (admin; every change is in the audit log)
const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { SETTING_KEY, LIMITS, readFreeShipping } = require('../shared/freeShipping');

const router = express.Router();
const admin = [requireAuth, requireRole('admin')];
class Refusal extends Error { constructor(message) { super(message); this.status = 400; } }
const twoDecimals = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
function checkedAmount(value, max, what) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Refusal(`${what} must be a number`);
  if (n < 0) throw new Refusal(`${what} cannot be negative`);
  if (n > max) throw new Refusal(`${what} cannot be more than ${max}`);
  if (!twoDecimals(n)) throw new Refusal(`${what} can have at most two decimals`);
  return Number(n.toFixed(2));
}

router.get('/', async (req, res, next) => {
  try { res.set('Cache-Control', 'public, max-age=30'); res.json(await readFreeShipping()); } catch (err) { next(err); }
});
router.get('/admin', ...admin, async (req, res, next) => {
  try { res.json({ ...(await readFreeShipping()), limits: LIMITS }); } catch (err) { next(err); }
});
router.put('/', ...admin, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body.enabled !== 'boolean') throw new Refusal('Say whether shipping fees are on or off');
    const thresholdUsd = checkedAmount(body.thresholdUsd, LIMITS.maxThresholdUsd, 'The free-shipping limit');
    const feeUsd = checkedAmount(body.feeUsd, LIMITS.maxFeeUsd, 'The shipping fee');
    if (body.enabled && thresholdUsd <= 0) throw new Refusal('Enter a free-shipping limit above 0, or switch shipping fees off');
    if (body.enabled && feeUsd <= 0) throw new Refusal('Enter a shipping fee above 0, or switch shipping fees off (shipping is then always free)');
    const before = await readFreeShipping();
    const next_ = { enabled: body.enabled, thresholdUsd, feeUsd };
    await db.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [SETTING_KEY, JSON.stringify(next_)]);
    await logAdminAction(req, 'free_shipping_changed', 'platform_setting', SETTING_KEY, { from: before, to: next_ });
    res.json({ ...next_, limits: LIMITS });
  } catch (err) { if (err instanceof Refusal) return res.status(err.status).json({ error: err.message }); next(err); }
});

module.exports = router;
