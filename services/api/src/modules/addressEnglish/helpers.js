const db = require('../../../db/pool');
const { toEnglish, containsArabic } = require('./transliterate');

/**
 * The English version of an order's delivery address (migration 094). See db/migrations/094_order_address_english.sql for what
 * english_source means. The original address (recipient_name, country, city, street_address, state) is NEVER changed here.
 */

const TEXT_FIELDS = [
  ['recipient_name', 'recipient_name_en'],
  ['country', 'country_en'],
  ['city', 'city_en'],
  ['street_address', 'street_address_en'],
  ['state', 'state_en'],
];

// Works out the English values for an order_addresses row (or anything shaped like one).
function computeEnglish(row) {
  const values = {};
  let translated = false;
  for (const [original, english] of TEXT_FIELDS) {
    const text = row[original];
    if (text === null || text === undefined || text === '') { values[english] = null; continue; }
    if (containsArabic(text)) translated = true;
    values[english] = toEnglish(String(text));
  }
  return { values, source: translated ? 'auto' : 'same' };
}

// Computes and stores the English version. A version a PERSON has set ('buyer' / 'admin') is kept, unless `force` is true -- which is
// only used when the ORIGINAL address itself was just replaced, because then the old English version no longer describes it.
async function refreshEnglishAddress(orderId, { client = db, force = false } = {}) {
  const { rows } = await client.query('SELECT * FROM order_addresses WHERE order_id = $1', [orderId]);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!force && (row.english_source === 'buyer' || row.english_source === 'admin')) return row;
  const { values, source } = computeEnglish(row);
  const { rows: updated } = await client.query(
    `UPDATE order_addresses
     SET recipient_name_en = $2, country_en = $3, city_en = $4, street_address_en = $5, state_en = $6,
         english_source = $7, english_updated_at = now(), english_updated_by = NULL
     WHERE order_id = $1 RETURNING *`,
    [orderId, values.recipient_name_en, values.country_en, values.city_en, values.street_address_en, values.state_en, source]
  );
  return updated[0];
}

// For orders from before migration 094: fill the English version in the first time it is needed. Cheap when it is already there.
async function ensureEnglishAddress(orderId, client = db) {
  const { rows } = await client.query('SELECT * FROM order_addresses WHERE order_id = $1', [orderId]);
  if (rows.length === 0) return null;
  if (rows[0].english_source) return rows[0];
  return refreshEnglishAddress(orderId, { client });
}

// The English address as the API shows it.
function toEnglishDto(row) {
  if (!row) return null;
  return {
    recipientName: row.recipient_name_en,
    country: row.country_en,
    city: row.city_en,
    streetAddress: row.street_address_en,
    state: row.state_en,
    // 'same' | 'auto' | 'buyer' | 'admin'. Only 'auto' is a machine's guess that nobody has confirmed.
    source: row.english_source,
    confirmed: row.english_source === 'buyer' || row.english_source === 'admin',
    updatedAt: row.english_updated_at,
  };
}

// What the inspection hub sees: the same row shape the hub code always used, but with the ENGLISH text in place of the original.
// (Phone, postal code and national address are digits / codes and are not translated.)
async function getHubAddressRow(orderId, client = db) {
  const row = await ensureEnglishAddress(orderId, client);
  if (!row) return null;
  return {
    recipient_name: row.recipient_name_en || row.recipient_name,
    phone: row.phone,
    country: row.country_en || row.country,
    city: row.city_en || row.city,
    street_address: row.street_address_en || row.street_address,
    postal_code: row.postal_code,
    state: row.state_en || row.state,
    national_address: row.national_address,
    english_source: row.english_source, // lets the hub see whether the English text was produced automatically
  };
}

// ---- a person correcting the English version (admin, or the buyer confirming it) ----

const LIMITS = { recipientName: 100, country: 80, city: 80, streetAddress: 200, state: 80 };
const REQUIRED = [['recipientName', 'Recipient name'], ['country', 'Country'], ['city', 'City'], ['streetAddress', 'Street address']];

function validateEnglishAddress(body) {
  const clean = {};
  for (const [key, label] of REQUIRED) {
    const text = typeof body?.[key] === 'string' ? body[key].trim() : '';
    if (!text) return { error: `${label} is required.` };
    clean[key] = text;
  }
  clean.state = typeof body?.state === 'string' && body.state.trim() ? body.state.trim() : null;
  for (const key of Object.keys(LIMITS)) {
    if (clean[key] && clean[key].length > LIMITS[key]) return { error: `${key} must be at most ${LIMITS[key]} characters.` };
    // This IS the English version: it must be written in English letters, or the hub would be back to an address it cannot read.
    if (clean[key] && containsArabic(clean[key])) return { error: `The English address must be written in English letters (${key} contains Arabic).` };
  }
  return { value: clean };
}

async function saveEnglishAddress(orderId, value, source, userId, client = db) {
  const { rows } = await client.query(
    `UPDATE order_addresses
     SET recipient_name_en = $2, country_en = $3, city_en = $4, street_address_en = $5, state_en = $6,
         english_source = $7, english_updated_at = now(), english_updated_by = $8
     WHERE order_id = $1 RETURNING *`,
    [orderId, value.recipientName, value.country, value.city, value.streetAddress, value.state, source, userId || null]
  );
  return rows[0] || null;
}

// The buyer looked at the automatic English version and it is right: mark it confirmed without changing a word.
async function confirmEnglishAddressAsIs(orderId, userId, client = db) {
  await ensureEnglishAddress(orderId, client);
  const { rows } = await client.query(
    `UPDATE order_addresses SET english_source = 'buyer', english_updated_at = now(), english_updated_by = $2 WHERE order_id = $1 RETURNING *`,
    [orderId, userId || null]
  );
  return rows[0] || null;
}

module.exports = {
  computeEnglish, refreshEnglishAddress, ensureEnglishAddress, toEnglishDto, getHubAddressRow,
  validateEnglishAddress, saveEnglishAddress, confirmEnglishAddressAsIs,
};
