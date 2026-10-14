// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { login } from './auth';

// The weight and package size of a category (backend migration 103): set by the admin, four numbers above zero, always together. Real backend, real database.
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
const create = (token, body) => fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: token ? auth(token) : json, body: JSON.stringify(body) });
const edit = (token, id, body) => fetch(`${BACKEND_URL}/catalog/categories/${id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify(body) });
const list = () => fetch(`${BACKEND_URL}/catalog/categories`).then((r) => r.json());
const base = (id) => ({ id, nameEn: `Cat ${id}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg' });

describe.runIf(backendUp)('a category\'s weight and size (real backend)', () => {
  it('CRITICAL: a new category needs all four values; each missing, zero, negative, non-numeric or impossible one is refused with its name, and nothing is created', async () => {
    const token = await adminToken();
    const id = newId();
    const cases = [
      ['no weight', { ...SET, weightKg: undefined }, 'weightKg is required'], ['no length', { ...SET, lengthCm: undefined }, 'lengthCm is required'],
      ['no width', { ...SET, widthCm: undefined }, 'widthCm is required'], ['no height', { ...SET, heightCm: undefined }, 'heightCm is required'],
      ['empty weight', { ...SET, weightKg: '' }, 'weightKg is required'], ['null height', { ...SET, heightCm: null }, 'heightCm is required'],
      ['zero weight', { ...SET, weightKg: 0 }, 'weightKg must be a number above zero'], ['negative width', { ...SET, widthCm: -3 }, 'widthCm must be a number above zero'],
      ['letters', { ...SET, lengthCm: 'abc' }, 'lengthCm must be a number above zero'], ['infinity', { ...SET, heightCm: 'Infinity' }, 'heightCm must be a number above zero'],
      ['too heavy for the column', { ...SET, weightKg: 100000 }, 'weightKg must be at most 99999'], ['too long for the column', { ...SET, lengthCm: 1000000 }, 'lengthCm must be at most 999999'],
    ];
    for (const [label, shipping, error] of cases) {
      const res = await create(token, { ...base(id), ...shipping });
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe(error);
    }
    expect((await list()).some((c) => c.id === id)).toBe(false);                    // none of the refusals created the category
  }, 60000);

  it('CRITICAL: a category created with all four returns them as numbers (text numbers are accepted), and the public list carries them', async () => {
    const token = await adminToken();
    const id = newId();
    const res = await create(token, { ...base(id), weightKg: '5.5', lengthCm: 30, widthCm: '30.25', heightCm: 5 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id, weightKg: 5.5, lengthCm: 30, widthCm: 30.25, heightCm: 5 });
    expect((await list()).find((c) => c.id === id)).toMatchObject({ weightKg: 5.5, lengthCm: 30, widthCm: 30.25, heightCm: 5 });
  }, 60000);

  it('categories that existed before have none (all four null) and still list and work', async () => {
    const id = newId();
    await pool.query(`INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, 'Old style', 'قديم', '/uploads/c.jpg', 9999)`, [id]);
    expect((await list()).find((c) => c.id === id)).toMatchObject({ weightKg: null, lengthCm: null, widthCm: null, heightCm: null });
  });

  it('CRITICAL: editing: names alone leave the four untouched; all four together replace them; some but not all is refused and changes nothing', async () => {
    const token = await adminToken();
    const id = newId();
    expect((await create(token, { ...base(id), ...SET })).status).toBe(201);
    const names = await edit(token, id, { nameEn: 'Renamed', nameAr: 'اسم جديد' });
    expect(names.status).toBe(200);
    expect(await names.json()).toMatchObject({ nameEn: 'Renamed', ...SET });
    const all = await edit(token, id, { nameEn: 'Renamed', nameAr: 'اسم جديد', weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });
    expect(all.status).toBe(200);
    expect(await all.json()).toMatchObject({ weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });
    for (const [label, partial, error] of [['only weight', { weightKg: 1 }, 'lengthCm is required'], ['weight and length', { weightKg: 1, lengthCm: 1 }, 'widthCm is required'], ['zero height', { weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 0 }, 'heightCm must be a number above zero']]) {
      const res = await edit(token, id, { nameEn: 'X', nameAr: 'س', ...partial });
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe(error);
    }
    expect((await list()).find((c) => c.id === id)).toMatchObject({ nameEn: 'Renamed', weightKg: 8, lengthCm: 40, widthCm: 20, heightCm: 10 });   // untouched by the refusals
    expect((await edit(token, 'cat_does_not_exist', { nameEn: 'X', nameAr: 'س', ...SET })).status).toBe(404);
    expect((await edit(token, id, { nameAr: 'س', ...SET })).status).toBe(400);                 // the names are still required
  }, 60000);

  it('only an admin with the Categories page can set them', async () => {
    const token = await adminToken();
    const id = newId();
    expect((await create(null, { ...base(id), ...SET })).status).toBe(401);
    const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
    expect((await create(supplier, { ...base(id), ...SET })).status).toBe(403);
    expect((await create(token, { ...base(id), ...SET })).status).toBe(201);
    expect((await edit(supplier, id, { nameEn: 'Hijack', nameAr: 'س', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 })).status).toBe(403);
    const limitedEmail = `perm-test-${Date.now()}@leap.dev`;
    expect((await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(token), body: JSON.stringify({ email: limitedEmail, password: 'test_password_123', allowedPages: ['orders'] }) })).status).toBe(201);
    const limited = (await login(limitedEmail, 'test_password_123')).token;
    expect((await edit(limited, id, { nameEn: 'Hijack', nameAr: 'س', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 })).status).toBe(403);
    expect((await list()).find((c) => c.id === id)).toMatchObject(SET);
  }, 90000);

  it('CRITICAL: the database itself refuses a category with some but not all four, or any at zero (a safety net below the API)', async () => {
    const id = newId();
    await pool.query(`INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, 'Constraint', 'قيد', '/uploads/c.jpg', 9999)`, [id]);
    await expect(pool.query('UPDATE product_categories SET weight_kg = 5 WHERE id = $1', [id])).rejects.toThrow(/product_categories_shipping_all_or_none/);
    await expect(pool.query('UPDATE product_categories SET weight_kg = 0, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id])).rejects.toThrow(/product_categories_shipping_all_or_none/);
    await expect(pool.query('UPDATE product_categories SET weight_kg = -1, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id])).rejects.toThrow(/product_categories_shipping_all_or_none/);
    await pool.query('UPDATE product_categories SET weight_kg = 1, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = $1', [id]);                    // all four: fine
    await pool.query('UPDATE product_categories SET weight_kg = NULL, length_cm = NULL, width_cm = NULL, height_cm = NULL WHERE id = $1', [id]);          // none: fine
  });
});

// The rule for which weight and size a product uses, on its own (no database): its own COMPLETE set, else its category's, else none.
const require = createRequire(import.meta.url);
const { effectiveShipping, hasOwnShipping } = require('../../../services/api/src/modules/shared/categoryShipping.js');
describe('which weight and size a product uses (pure rule)', () => {
  const map = new Map([['brake', { weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5 }]]);
  const row = (extra) => ({ id: 'p', category: 'brake', weight_kg: null, length_cm: null, width_cm: null, height_cm: null, ...extra });

  it('a product with its own complete set uses it, wherever its category stands', () => {
    const r = effectiveShipping(row({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 }), map);
    expect(r).toMatchObject({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12, shipping_source: 'product' });
    expect(effectiveShipping(row({ category: 'unknown', weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 }), map).shipping_source).toBe('product');
  });

  it('CRITICAL: a product without a complete own set uses its category\'s; an incomplete own set is not mixed with it', () => {
    expect(effectiveShipping(row(), map)).toMatchObject({ weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5, shipping_source: 'category' });
    const partial = effectiveShipping(row({ weight_kg: 2, length_cm: 10 }), map);
    expect(partial).toMatchObject({ weight_kg: 5, length_cm: 30, width_cm: 30, height_cm: 5, shipping_source: 'category' });      // never 2 kg with a 30 cm width
  });

  it('with neither, there is none (the price engine then reports it, as it always did)', () => {
    expect(effectiveShipping(row({ category: 'unknown' }), map)).toMatchObject({ weight_kg: null, length_cm: null, shipping_source: null });
    expect(effectiveShipping(row({ category: null }), map).shipping_source).toBeNull();
  });

  it('does not change the row it is given, and keeps its other fields', () => {
    const input = row({ name: 'Disc' });
    const out = effectiveShipping(input, map);
    expect(input.weight_kg).toBeNull();
    expect(out).toMatchObject({ id: 'p', name: 'Disc', category: 'brake' });
    expect(hasOwnShipping(input)).toBe(false);
  });
});
