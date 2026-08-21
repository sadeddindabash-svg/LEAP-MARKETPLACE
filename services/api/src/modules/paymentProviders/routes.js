const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { encryptCredentials, decryptCredentials } = require('../../lib/credentialEncryption');
const { PROVIDER_FIELD_SCHEMAS, getProviderSchema } = require('../../config/paymentProviderSchemas');

/**
 * Real, encrypted, admin-editable payment provider credentials (new,
 * migration 065) -- confirmed with the person before building: this
 * is the real "set up page" system, separate from payment_methods
 * (the display/catalog layer built earlier). Real credentials are
 * never returned in plain text once saved -- secret fields come back
 * masked, non-secret identifiers (like a Merchant Identifier) come
 * back in full since they're safe to display.
 */

// Real, masks a real secret value for display -- shows only the last
// 4 real characters if long enough to do so safely, otherwise fully
// masked. Never the real full value once saved.
function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••••••';
  return `••••${value.slice(-4)}`;
}

function maskCredentials(providerId, credentials) {
  const schema = getProviderSchema(providerId);
  if (!schema) return {};
  const masked = {};
  for (const field of schema.fields) {
    const value = credentials[field.key] || '';
    masked[field.key] = field.secret ? maskSecret(value) : value;
  }
  return masked;
}

/**
 * Real, shared export -- other modules (existing paypal.js/
 * amazonPaymentServices.js, and any future real provider file) call
 * this instead of reading process.env directly, to get this
 * provider's real, decrypted credentials. Returns null if nothing has
 * been saved for this provider yet.
 */
async function getProviderCredentials(providerId) {
  const { rows } = await db.query('SELECT encrypted_credentials FROM payment_provider_credentials WHERE provider_id = $1', [providerId]);
  if (rows.length === 0) return null;
  return decryptCredentials(rows[0].encrypted_credentials);
}

const router = express.Router();

// GET /payment-providers -- real, admin list of every known provider,
// its real configuration status, and masked credentials where already
// saved.
router.get('/', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT provider_id, encrypted_credentials, updated_at FROM payment_provider_credentials');
    const savedByProvider = {};
    for (const r of rows) savedByProvider[r.provider_id] = r;

    const result = Object.entries(PROVIDER_FIELD_SCHEMAS).map(([providerId, schema]) => {
      const saved = savedByProvider[providerId];
      if (!saved) {
        return { providerId, label: schema.label, isConfigured: false, fields: schema.fields.map((f) => ({ key: f.key, label: f.label, secret: f.secret, value: '' })), updatedAt: null };
      }
      const decrypted = decryptCredentials(saved.encrypted_credentials);
      const masked = maskCredentials(providerId, decrypted);
      return {
        providerId,
        label: schema.label,
        isConfigured: schema.fields.every((f) => decrypted[f.key]),
        fields: schema.fields.map((f) => ({ key: f.key, label: f.label, secret: f.secret, value: masked[f.key] || '' })),
        updatedAt: saved.updated_at,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /payment-providers/:providerId -- real, saves/updates this
// provider's real credentials. Real, deliberate: a secret field left
// as its own already-masked value (e.g. the admin didn't touch that
// field) is treated as "keep the real existing value", not
// overwritten with the literal masked string -- otherwise re-saving
// a provider without editing every field would corrupt the real
// stored secret.
router.put('/:providerId', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    const schema = getProviderSchema(req.params.providerId);
    if (!schema) return res.status(404).json({ error: `Unknown provider: ${req.params.providerId}` });

    const incoming = req.body || {};
    const existing = await getProviderCredentials(req.params.providerId);
    const merged = {};
    for (const field of schema.fields) {
      const incomingValue = incoming[field.key];
      const looksStillMasked = typeof incomingValue === 'string' && incomingValue.startsWith('••••');
      if (incomingValue === undefined || incomingValue === '' || looksStillMasked) {
        merged[field.key] = existing ? existing[field.key] : '';
      } else {
        merged[field.key] = incomingValue;
      }
    }

    const encrypted = encryptCredentials(merged);
    await db.query(
      `INSERT INTO payment_provider_credentials (provider_id, encrypted_credentials, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider_id) DO UPDATE SET encrypted_credentials = $2, updated_at = now(), updated_by = $3`,
      [req.params.providerId, encrypted, req.user?.email || null]
    );
    await logAdminAction(req, 'payment_provider_credentials_updated', 'payment_provider', req.params.providerId, {});
    res.json({ providerId: req.params.providerId, label: schema.label, isConfigured: schema.fields.every((f) => merged[f.key]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /payment-providers/:providerId -- real, clears this
// provider's real saved credentials entirely.
router.delete('/:providerId', requireAuth, requireRole('admin'), requirePageAccess('paymentMethods'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM payment_provider_credentials WHERE provider_id = $1', [req.params.providerId]);
    await logAdminAction(req, 'payment_provider_credentials_cleared', 'payment_provider', req.params.providerId, {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = { router, getProviderCredentials };
