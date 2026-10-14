// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { login } from './auth';
import { asValidProduct } from './productFixtures';

// ONE product whose shipping fee cannot be worked out (no weight and size of its own, and its part has none either) used to make the whole product list an error for
// EVERYONE: the list prices all its products together. Now such a product is simply left out of the buyer-facing lists, and its own page says "not found".
// Real backend, real database, real pricing engine.
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
const SET = { weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 };
let n = 0;
const unique = () => `${Date.now()}${++n}`;

// A category and a part WITH a weight and size, and a product in it: the supplier sends none of the four, so the product stores none of its own.
async function makeProductInPartWithValues() {
  const admin = (await login('admin@leap.dev', 'admin_dev_password_123')).token;
  const supplier = (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
  const category = `test_cat_unpriceable_${unique()}`;
  expect((await fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ id: category, nameEn: `Unpriceable ${category}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg' }) })).status).toBe(201);
  const part = `Part ${unique()}`;
  const partRes = await fetch(`${BACKEND_URL}/catalog/categories/${category}/parts`, { method: 'POST', headers: auth(admin), body: JSON.stringify({ nameEn: part, nameAr: 'جزء', ...SET }) });
  expect(partRes.status).toBe(201);
  const partId = (await partRes.json()).id;
  const body = await asValidProduct({ nameZh: `无法定价测试${unique()}`, category, part, position: 'Front', oemNumber: `UNP-${unique()}`, price: 50, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 } });
  const created = await (await fetch(`${BACKEND_URL}/supplier/me/products`, { method: 'POST', headers: auth(supplier), body: JSON.stringify(body) })).json();
  await pool.query(`UPDATE products SET status = 'active', stock_quantity = 10 WHERE id = $1`, [created.id]);
  return { admin, category, part, partId, productId: created.id };
}
const removePartValues = (partId) => pool.query('UPDATE category_parts SET weight_kg = NULL, length_cm = NULL, width_cm = NULL, height_cm = NULL WHERE id = $1', [partId]);
const list = async (query = '') => {
  const res = await fetch(`${BACKEND_URL}/catalog/products${query}`);
  return { status: res.status, body: await res.json() };
};

describe.runIf(backendUp)('a product that cannot be priced must not take the catalog down (real backend)', () => {
  it('CRITICAL: the whole product list still answers, without that product, while other products stay; its own page says not found', async () => {
    const { category, partId, productId } = await makeProductInPartWithValues();
    const before = await list(`?category=${category}`);
    expect(before.status).toBe(200);
    expect(before.body.map((p) => p.id)).toEqual([productId]);                                       // priceable: listed
    expect((await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).status).toBe(200);

    await removePartValues(partId);                                                                  // now neither the product nor its part has a weight and size

    const all = await list();
    expect(all.status).toBe(200);                                                                    // THE BUG: this used to be a 500 for every visitor
    const ids = all.body.map((p) => p.id);
    expect(ids).not.toContain(productId);
    expect(ids.length).toBeGreaterThan(1);                                                           // the rest of the catalog is still there
    expect(ids).toContain('p1');
    const category_ = await list(`?category=${category}`);
    expect(category_.status).toBe(200);
    expect(category_.body).toEqual([]);
    const page = await fetch(`${BACKEND_URL}/catalog/products/${productId}`);
    expect(page.status).toBe(404);
    expect((await page.json()).error).toBe('Product not found');
    expect((await fetch(`${BACKEND_URL}/catalog/products/p1`)).status).toBe(200);                    // other pages are untouched
  }, 90000);

  it('CRITICAL: setting the part\'s weight and size again brings the product back at once', async () => {
    const { admin, category, part, partId, productId } = await makeProductInPartWithValues();
    await removePartValues(partId);
    expect((await list(`?category=${category}`)).body).toEqual([]);
    const fix = await fetch(`${BACKEND_URL}/catalog/parts/${partId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ nameEn: part, nameAr: 'جزء', ...SET }) });
    expect(fix.status).toBe(200);
    expect((await list(`?category=${category}`)).body.map((p) => p.id)).toEqual([productId]);
    expect((await fetch(`${BACKEND_URL}/catalog/products/${productId}`)).status).toBe(200);
  }, 90000);

  it('a product with its OWN weight and size is never hidden, even when its part has none', async () => {
    const { category, partId, productId } = await makeProductInPartWithValues();
    await pool.query('UPDATE products SET weight_kg = 2, length_cm = 10, width_cm = 10, height_cm = 10 WHERE id = $1', [productId]);
    await removePartValues(partId);
    expect((await list(`?category=${category}`)).body.map((p) => p.id)).toEqual([productId]);
  }, 90000);
});

// The error itself is recognisable (so a caller can tell "cannot be priced" from a real bug), and keeps its old message.
const require = createRequire(import.meta.url);
const { MissingShippingDataError } = require('../../../services/api/src/modules/pricing/engine.js');
describe('the pricing engine\'s missing-shipping-data error', () => {
  it('is an Error with its own name and code, and keeps the message callers and logs already know', () => {
    const err = new MissingShippingDataError('Cannot apply shipping fee "Shipping Fee" — product is missing weight/dimensions');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MissingShippingDataError);
    expect(err.name).toBe('MissingShippingDataError');
    expect(err.code).toBe('missing_shipping_data');
    expect(err.message).toMatch(/product is missing weight\/dimensions/);
  });
});
