// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { login } from './auth';

// The weight and package size of a PART (the sub-category; backend migration 104): set by the admin, four numbers above zero, always together. A major category
// carries none. Real backend, real database.
const BACKEND_URL = 'http://localhost:4000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const pool = new Pool({ connectionString: DB_URL });
afterAll(async () => { await pool.end(); });
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const SET = { weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 };
const newId = () => `test_cat_shipapi_${Date.now()}${Math.floor(Math.random() * 1000)}`;      // "test_cat_": recognised by the cleanup tool (remove-test-data)
const makeCategory = async (token) => {
  const id = newId();
  const res = await fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: auth(token), body: JSON.stringify({ id, nameEn: `Cat ${id}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg' }) });
  expect(res.status).toBe(201);
  return id;
};
const createPart = (token, categoryId, body) => fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/parts`, { method: 'POST', headers: token ? auth(token) : json, body: JSON.stringify(body) });
const editPart = (token, id, body) => fetch(`${BACKEND_URL}/catalog/parts/${id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify(body) });
const partsOf = (categoryId) => fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/parts`).then((r) => r.json());
const base = (name) => ({ nameEn: name, nameAr: 'جزء' });
let n = 0;
const partName = () => `Part ${Date.now()}${++n}`;

describe.runIf(backendUp)('a part\'s weight and size (real backend)', () => {
  it('CRITICAL: a new part needs all four values; each missing, zero, negative, non-numeric or impossible one is refused with its name, and nothing is created', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    const name = partName();
    const cases = [
      ['no weight', { ...SET, weightKg: undefined }, 'weightKg is required'], ['no length', { ...SET, lengthCm: undefined }, 'lengthCm is required'],
      ['no width', { ...SET, widthCm: undefined }, 'widthCm is required'], ['no height', { ...SET, heightCm: undefined }, 'heightCm is required'],
      ['empty weight', { ...SET, weightKg: '' }, 'weightKg is required'], ['null height', { ...SET, heightCm: null }, 'heightCm is required'],
      ['zero weight', { ...SET, weightKg: 0 }, 'weightKg must be a number above zero'], ['negative width', { ...SET, widthCm: -3 }, 'widthCm must be a number above zero'],
      ['letters', { ...SET, lengthCm: 'abc' }, 'lengthCm must be a number above zero'], ['infinity', { ...SET, heightCm: 'Infinity' }, 'heightCm must be a number above zero'],
      ['too heavy for the column', { ...SET, weightKg: 100000 }, 'weightKg must be at most 99999'], ['too long for the column', { ...SET, lengthCm: 1000000 }, 'lengthCm must be at most 999999'],
    ];
    for (const [label, shipping, error] of cases) {
      const res = await createPart(token, category, { ...base(name), ...shipping });
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe(error);
    }
    expect(await partsOf(category)).toEqual([]);                                  // none of the refusals created the part
  }, 60000);

  it('CRITICAL: a part created with all four returns them as numbers (text numbers are accepted), and the public list of the category\'s parts carries them', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    const name = partName();
    const res = await createPart(token, category, { ...base(name), weightKg: '5.5', lengthCm: 30, widthCm: '30.25', heightCm: 5 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ nameEn: name, weightKg: 5.5, lengthCm: 30, widthCm: 30.25, heightCm: 5 });
    expect((await partsOf(category)).find((p) => p.nameEn === name)).toMatchObject({ weightKg: 5.5, lengthCm: 30, widthCm: 30.25, heightCm: 5 });
  }, 60000);

  it('parts that existed before have none (all four null) and still list and work', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    await pool.query(`INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order) VALUES ($1, $2, 'Old style', 'قديم', 10)`, [`part_old_${Date.now()}`, category]);
    expect((await partsOf(category))[0]).toMatchObject({ nameEn: 'Old style', weightKg: null, lengthCm: null, widthCm: null, heightCm: null });
  });

  it('CRITICAL: editing: names alone leave the four untouched; all four together replace them; some but not all is refused and changes nothing', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    const name = partName();
    const part = await createPart(token, category, { ...base(name), ...SET }).then((r) => r.json());
    const names = await editPart(token, part.id, { nameEn: name, nameAr: 'اسم جديد' });
    expect(names.status).toBe(200);
    expect(await names.json()).toMatchObject({ nameAr: 'اسم جديد', ...SET });
    const all = await editPart(token, part.id, { nameEn: name, nameAr: 'اسم جديد', weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });
    expect(all.status).toBe(200);
    expect(await all.json()).toMatchObject({ weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });
    for (const [label, partial, error] of [['only weight', { weightKg: 1 }, 'lengthCm is required'], ['weight and length', { weightKg: 1, lengthCm: 1 }, 'widthCm is required'], ['zero height', { weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 0 }, 'heightCm must be a number above zero']]) {
      const res = await editPart(token, part.id, { nameEn: name, nameAr: 'س', ...partial });
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe(error);
    }
    expect((await partsOf(category)).find((p) => p.id === part.id)).toMatchObject({ weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });   // untouched by the refusals
    expect((await editPart(token, 'part_does_not_exist', { nameEn: 'X', nameAr: 'س', ...SET })).status).toBe(404);
    expect((await editPart(token, part.id, { nameAr: 'س', ...SET })).status).toBe(400);              // the names are still required
  }, 60000);

  it('a part cannot be renamed to a name another part of the SAME category already has (409), but the same name in another category is fine', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    const other = await makeCategory(token);
    const a = await createPart(token, category, { ...base(partName()), ...SET }).then((r) => r.json());
    const b = await createPart(token, category, { ...base(partName()), ...SET }).then((r) => r.json());
    const clash = await editPart(token, b.id, { nameEn: a.nameEn.toUpperCase(), nameAr: 'جزء' });
    expect(clash.status).toBe(409);
    expect((await createPart(token, other, { ...base(a.nameEn), ...SET })).status).toBe(201);        // the same name elsewhere is allowed
  }, 60000);

  it('only an admin with the Categories page can set them', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    expect((await createPart(null, category, { ...base(partName()), ...SET })).status).toBe(401);
    const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
    expect((await createPart(supplier, category, { ...base(partName()), ...SET })).status).toBe(403);
    const part = await createPart(token, category, { ...base(partName()), ...SET }).then((r) => r.json());
    expect((await editPart(supplier, part.id, { nameEn: part.nameEn, nameAr: 'س', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 })).status).toBe(403);
    const limitedEmail = `perm-test-${Date.now()}@leap.dev`;
    expect((await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email: limitedEmail, password: 'test_password_123', allowedPages: ['orders'] }) })).status).toBe(201);
    const limited = (await login(limitedEmail, 'test_password_123')).token;
    expect((await editPart(limited, part.id, { nameEn: part.nameEn, nameAr: 'س', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 })).status).toBe(403);
    expect((await partsOf(category)).find((p) => p.id === part.id)).toMatchObject(SET);
  }, 90000);

  it('CRITICAL: a MAJOR category carries no weight or size any more: its API has none, and anything sent to it is ignored', async () => {
    const token = await adminToken();
    const id = newId();
    const created = await fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: auth(token), body: JSON.stringify({ id, nameEn: `Cat ${id}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg', ...SET }) });
    expect(created.status).toBe(201);                                             // no longer required, and not stored
    const body = await created.json();
    for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) expect(body).not.toHaveProperty(key);
    const list = await fetch(`${BACKEND_URL}/catalog/categories`).then((r) => r.json());
    expect(Object.keys(list.find((c) => c.id === id)).sort()).toEqual(['commissionPercent', 'id', 'nameAr', 'nameEn', 'photoUrl', 'sortOrder']);
    const patch = await fetch(`${BACKEND_URL}/catalog/categories/${id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ nameEn: 'Renamed', nameAr: 'س', ...SET }) });
    expect(patch.status).toBe(200);
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_categories' AND column_name IN ('weight_kg', 'length_cm', 'width_cm', 'height_cm')`);
    expect(rows).toEqual([]);                                                     // migration 104 removed the columns after copying their values down to the parts
  }, 60000);

  it('CRITICAL: the database itself refuses a part with some but not all four, or any at zero (a safety net below the API)', async () => {
    const token = await adminToken();
    const category = await makeCategory(token);
    const id = `part_constraint_${Date.now()}`;
    await pool.query(`INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order) VALUES ($1, $2, 'Constraint', 'قيد', 10)`, [id, category]);
    await expect(pool.query('UPDATE category_parts SET weight_kg = 5 WHERE id = $1', [id])).rejects.toThrow(/category_parts_shipping_all_or_none/);
    await expect(pool.query('UPDATE category_parts SET weight_kg = 0, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id])).rejects.toThrow(/category_parts_shipping_all_or_none/);
    await expect(pool.query('UPDATE category_parts SET weight_kg = -1, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id])).rejects.toThrow(/category_parts_shipping_all_or_none/);
    await pool.query('UPDATE category_parts SET weight_kg = 1, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id]);                    // all four: fine
    await pool.query('UPDATE category_parts SET weight_kg = NULL, length_cm = NULL, width_cm = NULL, height_cm = NULL WHERE id = $1', [id]);          // none: fine
  }, 60000);
});

// The rule for which weight and size a product uses, on its own (no database): its own COMPLETE set, else its part's, else none. A part is found by (category, name).
const require = createRequire(import.meta.url);
const { effectiveShipping, hasOwnShipping, partKey } = require('../../../services/api/src/modules/shared/partShipping.js');
describe('which weight and size a product uses (pure rule)', () => {
  const map = new Map([[partKey('brake', 'Front Brake Disc'), { weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5 }]]);
  const row = (extra) => ({ id: 'p', category: 'brake', part: 'Front Brake Disc', weight_kg: null, length_cm: null, width_cm: null, height_cm: null, ...extra });

  it('a product with its own complete set uses it, wherever its part stands', () => {
    const r = effectiveShipping(row({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 }), map);
    expect(r).toMatchObject({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12, shipping_source: 'product' });
    expect(effectiveShipping(row({ part: 'Unknown part', weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 }), map).shipping_source).toBe('product');
  });

  it('CRITICAL: a product without a complete own set uses its part\'s; an incomplete own set is not mixed with it', () => {
    expect(effectiveShipping(row(), map)).toMatchObject({ weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5, shipping_source: 'part' });
    expect(effectiveShipping(row({ weight_kg: 2, length_cm: 10 }), map)).toMatchObject({ weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5, shipping_source: 'part' });   // never 2 kg with a 30 cm width
  });

  it('the part is found by its category AND name, ignoring capitals and extra spaces: the same name in another category is a different part', () => {
    expect(effectiveShipping(row({ part: '  front brake DISC ' }), map).shipping_source).toBe('part');
    expect(effectiveShipping(row({ category: 'filters' }), map).shipping_source).toBeNull();
  });

  it('with neither, there is none (the price engine then reports it, as it always did)', () => {
    expect(effectiveShipping(row({ part: 'Unknown part' }), map)).toMatchObject({ weight_kg: null, length_cm: null, shipping_source: null });
    expect(effectiveShipping(row({ category: null }), map).shipping_source).toBeNull();
    expect(effectiveShipping(row({ part: null }), map).shipping_source).toBeNull();
  });

  it('does not change the row it is given, and keeps its other fields', () => {
    const input = row({ name: 'Disc' });
    const out = effectiveShipping(input, map);
    expect(input.weight_kg).toBeNull();
    expect(out).toMatchObject({ id: 'p', name: 'Disc', category: 'brake', part: 'Front Brake Disc' });
    expect(hasOwnShipping(input)).toBe(false);
  });
});
