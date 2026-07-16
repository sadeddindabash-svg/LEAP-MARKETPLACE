const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Real buyer address book (migration 017). "Addresses" was a genuinely
 * dead nav row before this (route: null in the mobile app's account
 * screen) -- tapping it did nothing at all.
 *
 * CONFIRMED REQUIREMENT: a customer can have up to 3 real saved
 * addresses. The cap is enforced here in application code, not a DB
 * constraint -- same pattern as the mandatory-3-photos rule on product
 * submission elsewhere in this project.
 */
const router = express.Router();

const MAX_ADDRESSES_PER_BUYER = 3;
const REQUIRED_FIELDS = ['label', 'recipientName', 'phone', 'country', 'city', 'streetAddress'];

function toAddressDto(row) {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    country: row.country,
    city: row.city,
    streetAddress: row.street_address,
    postalCode: row.postal_code,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM buyer_addresses WHERE buyer_id = $1 ORDER BY is_default DESC, created_at ASC',
      [req.user.sub]
    );
    res.json(rows.map(toAddressDto));
  } catch (err) {
    next(err);
  }
});

router.post('/me', requireAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const missing = REQUIRED_FIELDS.filter((f) => !req.body?.[f]);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    }

    await client.query('BEGIN');

    const { rows: existing } = await client.query('SELECT id FROM buyer_addresses WHERE buyer_id = $1', [req.user.sub]);
    if (existing.length >= MAX_ADDRESSES_PER_BUYER) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `You can save up to ${MAX_ADDRESSES_PER_BUYER} addresses. Delete one before adding another.` });
    }

    const { label, recipientName, phone, country, city, streetAddress, postalCode, isDefault } = req.body;
    const id = `addr_${Date.now()}`;

    // Real "only one default" invariant -- if this new address is being
    // set as the default, every other real address this buyer has must
    // be un-defaulted first, in the SAME transaction, not as a separate
    // best-effort step.
    if (isDefault) {
      await client.query('UPDATE buyer_addresses SET is_default = false WHERE buyer_id = $1', [req.user.sub]);
    }
    // The very first address a buyer saves is real-default by
    // definition, regardless of what isDefault was passed as, so there
    // is never a state with real addresses but no real default.
    const shouldBeDefault = Boolean(isDefault) || existing.length === 0;

    await client.query(
      `INSERT INTO buyer_addresses (id, buyer_id, label, recipient_name, phone, country, city, street_address, postal_code, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, req.user.sub, label, recipientName, phone, country, city, streetAddress, postalCode || null, shouldBeDefault]
    );
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT * FROM buyer_addresses WHERE id = $1', [id]);
    res.status(201).json(toAddressDto(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/me/:id', requireAuth, async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    const { rows: ownedRows } = await client.query(
      'SELECT * FROM buyer_addresses WHERE id = $1 AND buyer_id = $2',
      [req.params.id, req.user.sub]
    );
    if (ownedRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Address not found' });
    }

    const { label, recipientName, phone, country, city, streetAddress, postalCode, isDefault } = req.body || {};
    if (isDefault) {
      await client.query('UPDATE buyer_addresses SET is_default = false WHERE buyer_id = $1', [req.user.sub]);
    }

    await client.query(
      `UPDATE buyer_addresses SET
         label = COALESCE($1, label), recipient_name = COALESCE($2, recipient_name),
         phone = COALESCE($3, phone), country = COALESCE($4, country), city = COALESCE($5, city),
         street_address = COALESCE($6, street_address), postal_code = COALESCE($7, postal_code),
         is_default = COALESCE($8, is_default)
       WHERE id = $9`,
      [label, recipientName, phone, country, city, streetAddress, postalCode, isDefault, req.params.id]
    );
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT * FROM buyer_addresses WHERE id = $1', [req.params.id]);
    res.json(toAddressDto(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/me/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: ownedRows } = await db.query(
      'SELECT * FROM buyer_addresses WHERE id = $1 AND buyer_id = $2',
      [req.params.id, req.user.sub]
    );
    if (ownedRows.length === 0) return res.status(404).json({ error: 'Address not found' });

    const wasDefault = ownedRows[0].is_default;
    await db.query('DELETE FROM buyer_addresses WHERE id = $1', [req.params.id]);

    // Real "only one default" invariant, other direction: if the
    // deleted address WAS the default and real addresses still remain,
    // promote the real next-oldest one to default rather than leaving
    // the buyer with addresses but no real default at all.
    if (wasDefault) {
      const { rows: remaining } = await db.query(
        'SELECT id FROM buyer_addresses WHERE buyer_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.sub]
      );
      if (remaining.length > 0) {
        await db.query('UPDATE buyer_addresses SET is_default = true WHERE id = $1', [remaining[0].id]);
      }
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
