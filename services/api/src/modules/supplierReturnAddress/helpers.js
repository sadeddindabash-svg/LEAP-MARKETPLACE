const db = require('../../../db/pool');

/**
 * A supplier's return address (migration 092): where the inspection hub sends a faulty unit back to.
 * One row per supplier; saving replaces it. The same rules apply whether the supplier or an admin saves it.
 *
 * The text is stored exactly as entered -- in whatever language the supplier's courier needs -- so there is
 * deliberately no language or format check beyond "long enough to be a real address".
 */

const LIMITS = { name: [2, 100], phone: [5, 30], address: [10, 300] };
// digits, spaces and the usual phone punctuation only: this is read out to a courier, not free text
const PHONE_PATTERN = /^[0-9+\-().\s]+$/;

function validateReturnAddress(body) {
  const { contactName, phone, address } = body || {};
  const clean = {
    contactName: typeof contactName === 'string' ? contactName.trim() : '',
    phone: typeof phone === 'string' ? phone.trim() : '',
    address: typeof address === 'string' ? address.trim() : '',
  };
  const fields = [['contactName', 'Contact name', LIMITS.name], ['phone', 'Phone number', LIMITS.phone], ['address', 'Address', LIMITS.address]];
  for (const [key, label, [min, max]] of fields) {
    if (!clean[key]) return { error: `${label} is required.` };
    if (clean[key].length < min || clean[key].length > max) return { error: `${label} must be between ${min} and ${max} characters.` };
  }
  if (!PHONE_PATTERN.test(clean.phone)) return { error: 'Phone number may only contain digits, spaces and + - ( ) .' };
  return { value: clean };
}

function toDto(row) {
  return row ? { contactName: row.contact_name, phone: row.phone, address: row.address, updatedAt: row.updated_at } : null;
}

async function getReturnAddress(supplierId, client = db) {
  const { rows } = await client.query('SELECT * FROM supplier_return_addresses WHERE supplier_id = $1', [supplierId]);
  return toDto(rows[0]);
}

async function saveReturnAddress(supplierId, value, userId, client = db) {
  const { rows } = await client.query(
    `INSERT INTO supplier_return_addresses (supplier_id, contact_name, phone, address, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (supplier_id) DO UPDATE SET contact_name = $2, phone = $3, address = $4, updated_at = now(), updated_by = $5
     RETURNING *`,
    [supplierId, value.contactName, value.phone, value.address, userId]
  );
  return toDto(rows[0]);
}

module.exports = { validateReturnAddress, getReturnAddress, saveReturnAddress };
