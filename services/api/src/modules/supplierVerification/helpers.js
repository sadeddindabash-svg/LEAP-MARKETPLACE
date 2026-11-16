const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

/**
 * Supplier verification (migration 152, patch-supplier-verification): what a supplier sends so Leap can trust it is a real shop or warehouse,
 * and Leap's checklist on it. Nothing here blocks Approve (confirmed with the person: optional); the admin sees what is missing.
 *
 *   REQUIRED (counted as "sent"): license photo, registration / credit code, at least one outside photo, at least one inside photo, the location.
 *   EXTRA: legal representative, contact person + phone, business details (year founded, staff, size, brands, categories).
 *   CHECKLIST (Leap): license, code, outside photos, inside photos, location, contact (the phone was answered), business details.
 *   TRUST: every checklist item ticked = "verified" (Verified shop / warehouse / shop & warehouse); some = "partial"; none = "none".
 */
const PHOTO_KINDS = ['outside', 'inside'];
const MAX_PHOTOS_PER_KIND = 6;
const PREMISES = ['shop', 'warehouse', 'both'];
const CHECK_ITEMS = ['license', 'creditCode', 'outsidePhotos', 'insidePhotos', 'location', 'contact', 'business'];
const REQUIRED = ['license', 'creditCode', 'outsidePhotos', 'insidePhotos', 'location'];

class VerificationError extends Error { constructor(message) { super(message); this.statusCode = 400; } }

// China's 18-character Unified Social Credit Code (统一社会信用代码) has a check character: GB 32100-2015.
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
function creditCodeCheck(code) {
  if (!code) return null;
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(code)) return 'not_uscc';           // another country's number, or a typo: shown to the admin, not refused
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += USCC_CHARS.indexOf(code[i]) * USCC_WEIGHTS[i];
  const expected = USCC_CHARS[(31 - (sum % 31)) % 31];
  return code[17] === expected ? 'valid' : 'check_digit_wrong';
}

const text = (v, max) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new VerificationError('Every text must be text');
  const t = v.trim();
  if (t.length > max) throw new VerificationError(`A text is too long (at most ${max} characters)`);
  return t === '' ? null : t;
};
const whole = (v, min, max, label) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new VerificationError(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
const photoUrl = (u) => {
  if (typeof u !== 'string' || !(/^\/uploads\/[A-Za-z0-9._-]+$/.test(u) || /^https:\/\/[^\s]+$/.test(u)) || u.length > 500) throw new VerificationError('A photo is not one uploaded here');
  return u;
};

// The supplier's form -> the values to save. Throws VerificationError with a message the supplier can act on.
function validate(body) {
  const b = body || {};
  const premisesType = b.premisesType === undefined || b.premisesType === null || b.premisesType === '' ? null : b.premisesType;
  if (premisesType !== null && !PREMISES.includes(premisesType)) throw new VerificationError('premisesType must be shop, warehouse or both');
  const creditCode = text(b.creditCode, 40);
  const code = creditCode ? creditCode.toUpperCase().replace(/\s+/g, '') : null;
  if (code && !/^[A-Z0-9-]{4,40}$/.test(code)) throw new VerificationError('The registration / credit code may only have letters, digits and -');
  let latitude = b.latitude === '' || b.latitude === undefined ? null : b.latitude;
  let longitude = b.longitude === '' || b.longitude === undefined ? null : b.longitude;
  if ((latitude === null) !== (longitude === null)) throw new VerificationError('Give both the latitude and the longitude, or neither');
  if (latitude !== null) {
    latitude = Number(latitude); longitude = Number(longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new VerificationError('The map position is not a real place');
    latitude = Math.round(latitude * 1e6) / 1e6; longitude = Math.round(longitude * 1e6) / 1e6;
  }
  const contactPhone = text(b.contactPhone, 30);
  if (contactPhone && !/^[0-9 +\-()]{6,30}$/.test(contactPhone)) throw new VerificationError('The phone number may only have digits, spaces and + - ( )');
  const photos = {};
  for (const kind of PHOTO_KINDS) {
    const list = (b.photos && b.photos[kind]) || [];
    if (!Array.isArray(list)) throw new VerificationError('photos must be lists');
    if (list.length > MAX_PHOTOS_PER_KIND) throw new VerificationError(`At most ${MAX_PHOTOS_PER_KIND} photos of each kind`);
    photos[kind] = list.map(photoUrl);
  }
  const year = new Date().getFullYear();
  return {
    premisesType,
    licensePhotoUrl: b.licensePhotoUrl ? photoUrl(b.licensePhotoUrl) : null,
    creditCode: code,
    legalRepName: text(b.legalRepName, 80),
    addressText: text(b.addressText, 400),
    latitude, longitude,
    contactName: text(b.contactName, 80),
    contactRole: text(b.contactRole, 80),
    contactPhone,
    yearFounded: whole(b.yearFounded, 1900, year, 'The year founded'),
    staffCount: whole(b.staffCount, 1, 100000, 'The number of staff'),
    warehouseSizeM2: whole(b.warehouseSizeM2, 1, 10000000, 'The size (m²)'),
    mainBrands: text(b.mainBrands, 400),
    mainCategories: text(b.mainCategories, 400),
    photos,
  };
}

// which required items are there
function sentItems(v, photos) {
  const has = {
    license: Boolean(v && v.license_photo_url),
    creditCode: Boolean(v && v.credit_code),
    outsidePhotos: photos.outside.length > 0,
    insidePhotos: photos.inside.length > 0,
    location: Boolean(v && ((v.latitude !== null && v.latitude !== undefined) || v.address_text)),
  };
  return { has, sent: REQUIRED.filter((k) => has[k]).length, required: REQUIRED.length, missing: REQUIRED.filter((k) => !has[k]) };
}

function trustOf(checkedItems, premisesType) {
  const n = CHECK_ITEMS.filter((i) => checkedItems.includes(i)).length;
  const label = premisesType === 'warehouse' ? 'Verified warehouse' : premisesType === 'both' ? 'Verified shop & warehouse' : 'Verified shop';
  if (n === CHECK_ITEMS.length) return { level: 'verified', label, checked: n, total: CHECK_ITEMS.length };
  return { level: n > 0 ? 'partial' : 'none', label: n > 0 ? `${n} of ${CHECK_ITEMS.length} checked` : 'Not checked yet', checked: n, total: CHECK_ITEMS.length };
}

async function load(supplierId, q = db) {
  const { rows } = await q.query('SELECT * FROM supplier_verification WHERE supplier_id = $1', [supplierId]);
  const { rows: ph } = await q.query('SELECT kind, url FROM supplier_verification_photos WHERE supplier_id = $1 ORDER BY kind, sort_order, id', [supplierId]);
  const photos = { outside: [], inside: [] };
  for (const p of ph) photos[p.kind].push(p.url);
  return { v: rows[0] || null, photos };
}

function toDto(v, photos) {
  const num = (x) => (x === null || x === undefined ? null : Number(x));
  const s = sentItems(v, photos);
  return {
    premisesType: v ? v.premises_type : null,
    licensePhotoUrl: v ? v.license_photo_url : null,
    creditCode: v ? v.credit_code : null,
    creditCodeCheck: creditCodeCheck(v ? v.credit_code : null),
    legalRepName: v ? v.legal_rep_name : null,
    addressText: v ? v.address_text : null,
    latitude: v ? num(v.latitude) : null,
    longitude: v ? num(v.longitude) : null,
    contactName: v ? v.contact_name : null,
    contactRole: v ? v.contact_role : null,
    contactPhone: v ? v.contact_phone : null,
    yearFounded: v ? v.year_founded : null,
    staffCount: v ? v.staff_count : null,
    warehouseSizeM2: v ? v.warehouse_size_m2 : null,
    mainBrands: v ? v.main_brands : null,
    mainCategories: v ? v.main_categories : null,
    photos,
    sent: s.sent, required: s.required, missing: s.missing,
    submittedAt: v ? v.submitted_at : null,
    updatedAt: v ? v.updated_at : null,
  };
}

// The supplier's own view (no checklist, no notes).
async function getForSupplier(supplierId) {
  const { v, photos } = await load(supplierId);
  return toDto(v, photos);
}

// Saves the supplier's form (all of it, the photos replaced). Tells Leap's admins the first time every required item is there.
async function saveForSupplier(supplierId, value) {
  const client = await db.getPool().connect();
  let firstComplete = false;
  try {
    await client.query('BEGIN');
    // What changed since Leap checked it is unchecked again (a new license photo has to be checked again, and so on).
    const before = await load(supplierId, client);
    const b = before.v || {};
    const same = (x, y) => String(x === null || x === undefined ? '' : x) === String(y === null || y === undefined ? '' : y);
    const changed = {
      license: !same(b.license_photo_url, value.licensePhotoUrl),
      creditCode: !same(b.credit_code, value.creditCode),
      outsidePhotos: before.photos.outside.join('|') !== value.photos.outside.join('|'),
      insidePhotos: before.photos.inside.join('|') !== value.photos.inside.join('|'),
      location: !same(b.address_text, value.addressText) || !same(b.latitude === null || b.latitude === undefined ? null : Number(b.latitude), value.latitude) || !same(b.longitude === null || b.longitude === undefined ? null : Number(b.longitude), value.longitude),
      contact: !same(b.contact_name, value.contactName) || !same(b.contact_phone, value.contactPhone) || !same(b.contact_role, value.contactRole),
      business: ['year_founded:yearFounded', 'staff_count:staffCount', 'warehouse_size_m2:warehouseSizeM2', 'main_brands:mainBrands', 'main_categories:mainCategories'].some((pair) => { const [col, key] = pair.split(':'); return !same(b[col], value[key]); }),
    };
    const unchecked = CHECK_ITEMS.filter((i) => changed[i]);
    if (unchecked.length) await client.query('DELETE FROM supplier_verification_checks WHERE supplier_id = $1 AND item = ANY($2)', [supplierId, unchecked]);
    await client.query(
      `INSERT INTO supplier_verification (supplier_id, premises_type, license_photo_url, credit_code, legal_rep_name, address_text, latitude, longitude,
         contact_name, contact_role, contact_phone, year_founded, staff_count, warehouse_size_m2, main_brands, main_categories, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
       ON CONFLICT (supplier_id) DO UPDATE SET premises_type = $2, license_photo_url = $3, credit_code = $4, legal_rep_name = $5, address_text = $6,
         latitude = $7, longitude = $8, contact_name = $9, contact_role = $10, contact_phone = $11, year_founded = $12, staff_count = $13,
         warehouse_size_m2 = $14, main_brands = $15, main_categories = $16, updated_at = now()`,
      [supplierId, value.premisesType, value.licensePhotoUrl, value.creditCode, value.legalRepName, value.addressText, value.latitude, value.longitude,
        value.contactName, value.contactRole, value.contactPhone, value.yearFounded, value.staffCount, value.warehouseSizeM2, value.mainBrands, value.mainCategories]
    );
    await client.query('DELETE FROM supplier_verification_photos WHERE supplier_id = $1', [supplierId]);
    for (const kind of PHOTO_KINDS) {
      for (let i = 0; i < value.photos[kind].length; i++) {
        await client.query('INSERT INTO supplier_verification_photos (supplier_id, kind, url, sort_order) VALUES ($1, $2, $3, $4)', [supplierId, kind, value.photos[kind][i], i]);
      }
    }
    const { v, photos } = await load(supplierId, client);
    if (!v.submitted_at && sentItems(v, photos).missing.length === 0) {
      await client.query('UPDATE supplier_verification SET submitted_at = now() WHERE supplier_id = $1', [supplierId]);
      firstComplete = true;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  if (firstComplete) {
    try {
      const { rows: s } = await db.query('SELECT name FROM suppliers WHERE id = $1', [supplierId]);
      const name = s[0] ? s[0].name : 'A supplier';
      const { rows: admins } = await db.query("SELECT id FROM users WHERE role = 'admin'");
      for (const u of admins) {
        await createNotification({ userId: u.id, type: 'supplier_message', title: `${name} sent its verification documents`, body: `${name} sent its business license, premises photos and location. Check them in Suppliers.`,
          titleAr: `أرسل ${name} وثائق التحقق`, bodyAr: `أرسل ${name} الرخصة التجارية وصور المكان والموقع. راجعها في صفحة الموردين.`, linkType: 'supplier', linkId: supplierId });
      }
    } catch (e) { console.error('[supplierVerification] could not tell the admins:', e.message); }
  }
  return getForSupplier(supplierId);
}

// The admin's view: everything, with the checklist, the notes and the trust level.
async function getForAdmin(supplierId) {
  const { v, photos } = await load(supplierId);
  const { rows: checks } = await db.query(
    `SELECT c.item, c.checked_at, u.email AS checked_by_email FROM supplier_verification_checks c LEFT JOIN users u ON u.id::text = c.checked_by WHERE c.supplier_id = $1`, [supplierId]);
  const checked = checks.map((c) => c.item);
  return {
    ...toDto(v, photos),
    checks: Object.fromEntries(CHECK_ITEMS.map((i) => { const c = checks.find((x) => x.item === i); return [i, c ? { checkedAt: c.checked_at, checkedBy: c.checked_by_email || null } : null]; })),
    trust: trustOf(checked, v ? v.premises_type : null),
    adminNotes: v ? v.admin_notes : null,
    adminNotesUpdatedAt: v ? v.admin_notes_updated_at : null,
  };
}

async function setCheck(supplierId, item, checked, adminId) {
  if (!CHECK_ITEMS.includes(item)) throw new VerificationError(`item must be one of ${CHECK_ITEMS.join(', ')}`);
  if (checked) await db.query('INSERT INTO supplier_verification_checks (supplier_id, item, checked_by) VALUES ($1, $2, $3) ON CONFLICT (supplier_id, item) DO UPDATE SET checked_by = $3, checked_at = now()', [supplierId, item, adminId ? String(adminId) : null]);
  else await db.query('DELETE FROM supplier_verification_checks WHERE supplier_id = $1 AND item = $2', [supplierId, item]);
  return getForAdmin(supplierId);
}

async function saveNotes(supplierId, notes, adminId) {
  const value = text(notes, 4000);
  await db.query(
    `INSERT INTO supplier_verification (supplier_id, admin_notes, admin_notes_updated_at, admin_notes_updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (supplier_id) DO UPDATE SET admin_notes = $2, admin_notes_updated_at = now(), admin_notes_updated_by = $3`, [supplierId, value, adminId ? String(adminId) : null]);
  return getForAdmin(supplierId);
}

// For the Suppliers list: per supplier, how many required items were sent and the trust level. Map(supplierId -> summary).
async function summaries() {
  const { rows } = await db.query(
    `SELECT s.id, v.premises_type, v.license_photo_url, v.credit_code, v.latitude, v.address_text,
       (SELECT COUNT(*)::int FROM supplier_verification_photos p WHERE p.supplier_id = s.id AND p.kind = 'outside') AS outside_n,
       (SELECT COUNT(*)::int FROM supplier_verification_photos p WHERE p.supplier_id = s.id AND p.kind = 'inside') AS inside_n,
       ARRAY(SELECT c.item FROM supplier_verification_checks c WHERE c.supplier_id = s.id) AS checked
     FROM suppliers s LEFT JOIN supplier_verification v ON v.supplier_id = s.id`);
  const out = new Map();
  for (const r of rows) {
    const s = sentItems(r, { outside: new Array(r.outside_n).fill(1), inside: new Array(r.inside_n).fill(1) });
    out.set(r.id, { sent: s.sent, required: s.required, missing: s.missing, trust: trustOf(r.checked || [], r.premises_type) });
  }
  return out;
}

module.exports = { CHECK_ITEMS, REQUIRED, VerificationError, creditCodeCheck, validate, getForSupplier, saveForSupplier, getForAdmin, setCheck, saveNotes, summaries };
