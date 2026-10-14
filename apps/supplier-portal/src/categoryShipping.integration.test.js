// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { asValidProduct } from './productFixtures';

// A category has a weight and a package size set by the ADMIN (backend migration 103), and the shipping cost of every product in it uses them automatically:
//   - a product with its OWN complete set keeps using it (nothing that already has one changes);
//   - otherwise it uses its category's;
//   - the supplier enters none of the four when the category has them.
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
const loginAs = async (email, password) => (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) }).then((r) => r.json())).token;
const adminToken = () => loginAs('admin@leap.dev', 'admin_dev_password_123');
const supplierToken = () => loginAs('supplier@leap.dev', 'supplier_dev_password_123');
const FITMENT = { generationId: 'gen_bmw_1_series_f20', year: 2017 };       // seeded
const SET = { weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 };

let counter = 0;
const unique = () => `${Date.now()}${++counter}`;

// A category, with a part. `shipping` null = a category that has none yet (made directly in the database: the API now always requires the four values).
async function makeCategory(shipping) {
  const token = await adminToken();
  const id = `test_cat_shipping_${unique()}`;      // the "test_cat_" start is how the cleanup tool (remove-test-data) recognises it
  if (shipping) {
    const res = await fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: auth(token), body: JSON.stringify({ id, nameEn: `CS ${id}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg', ...shipping }) });
    expect(res.status).toBe(201);
  } else {
    await pool.query(`INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, $2, 'فئة', '/uploads/c.jpg', 9999)`, [id, `CS ${id}`]);
  }
  const part = await fetch(`${BACKEND_URL}/catalog/categories/${id}/parts`, { method: 'POST', headers: auth(token), body: JSON.stringify({ nameEn: `Part ${id}`, nameAr: 'جزء' }) });
  expect(part.status).toBe(201);
  return { id, part: `Part ${id}` };
}

async function createProduct(category, extra = {}, price = 120) {
  const token = await supplierToken();
  const body = await asValidProduct({ nameZh: `类别重量测试${unique()}`, category: category.id, part: category.part, position: 'Front', oemNumber: `OEM-${unique()}`, price, currencyCode: 'CNY', fitment: FITMENT, ...extra });
  return fetch(`${BACKEND_URL}/supplier/me/products`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
}
const own = async (productId) => (await pool.query('SELECT weight_kg, length_cm, width_cm, height_cm FROM products WHERE id = $1', [productId])).rows[0];
const activate = (productId) => pool.query(`UPDATE products SET status = 'active', stock_quantity = 10 WHERE id = $1`, [productId]);
async function expectedPriceUsd(supplierCostCny, shipping) {
  const res = await fetch(`${BACKEND_URL}/pricing/preview`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ supplierCostCny, ...shipping }) });
  expect(res.status).toBe(200);
  return (await res.json()).buyerPriceUsd;
}
const buyerView = (productId) => fetch(`${BACKEND_URL}/catalog/products/${productId}`).then((r) => r.json());
const supplierList = async () => (await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: auth(await supplierToken()) }).then((r) => r.json()));

describe.runIf(backendUp)('category weight and size in the shipping cost (real backend)', () => {
  it('CRITICAL: in a category that has them, the supplier enters none of the four: a product is created without them and stores none of its own', async () => {
    const cat = await makeCategory(SET);
    const res = await createProduct(cat);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(await own(created.id)).toEqual({ weight_kg: null, length_cm: null, width_cm: null, height_cm: null });
    expect(created).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5, shippingSource: 'category' });       // what the supplier sees: the ones in use
    const listed = (await supplierList()).find((p) => p.id === created.id);
    expect(listed).toMatchObject({ weightKg: 5, shippingSource: 'category' });
  }, 60000);

  it('whatever weight or size a supplier sends for such a category is ignored (even invalid), so every product in it is treated the same', async () => {
    const cat = await makeCategory(SET);
    const res = await createProduct(cat, { weightKg: 99, lengthCm: 200, widthCm: -1, heightCm: 0 });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(await own(created.id)).toEqual({ weight_kg: null, length_cm: null, width_cm: null, height_cm: null });
    expect(created).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
  }, 60000);

  it('CRITICAL: in a category with none yet, the supplier still has to enter all four (named when missing), and the product keeps its own', async () => {
    const cat = await makeCategory(null);
    const missing = await createProduct(cat);
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('Missing required field(s): weightKg, lengthCm, widthCm, heightCm');
    const bad = await createProduct(cat, { ...SET, weightKg: -2 });
    expect(bad.status).toBe(400);
    const ok = await createProduct(cat, { weightKg: 2, lengthCm: 10, widthCm: 11, heightCm: 12 });
    expect(ok.status).toBe(201);
    const created = await ok.json();
    expect(Object.fromEntries(Object.entries(await own(created.id)).map(([k, v]) => [k, Number(v)]))).toEqual({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 });
    expect(created).toMatchObject({ weightKg: 2, shippingSource: 'product' });
  }, 60000);

  it('CRITICAL: the buyer price uses the category\'s weight and size, and equals the admin price calculator for exactly those numbers', async () => {
    const cat = await makeCategory(SET);
    const created = await (await createProduct(cat, {}, 120)).json();
    await activate(created.id);
    const view = await buyerView(created.id);
    expect(view).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
    expect(view.price).toBeCloseTo(await expectedPriceUsd(120, SET), 2);
  }, 60000);

  it('CRITICAL: a change to the category\'s weight reaches the price at once (prices are live), and a bigger package costs more', async () => {
    const cat = await makeCategory(SET);
    const created = await (await createProduct(cat, {}, 120)).json();
    await activate(created.id);
    const before = (await buyerView(created.id)).price;
    const heavier = { weightKg: 50, lengthCm: 30, widthCm: 30, heightCm: 5 };
    const patch = await fetch(`${BACKEND_URL}/catalog/categories/${cat.id}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ nameEn: `CS ${cat.id}`, nameAr: 'فئة', ...heavier }) });
    expect(patch.status).toBe(200);
    const after = (await buyerView(created.id)).price;
    expect(after).toBeCloseTo(await expectedPriceUsd(120, heavier), 2);
    expect(after).toBeGreaterThan(before);                                    // so the shipping fee really depends on it
    expect(await expectedPriceUsd(120, heavier)).toBeGreaterThan(await expectedPriceUsd(120, SET));
  }, 60000);

  it('CRITICAL: a product that already has its OWN complete set keeps using it, even in a category that has one (no existing price changes)', async () => {
    const cat = await makeCategory(SET);
    const created = await (await createProduct(cat, {}, 120)).json();
    const ownSet = { weightKg: 2, lengthCm: 10, widthCm: 10, heightCm: 10 };
    await pool.query('UPDATE products SET weight_kg = $2, length_cm = $3, width_cm = $4, height_cm = $5 WHERE id = $1', [created.id, ownSet.weightKg, ownSet.lengthCm, ownSet.widthCm, ownSet.heightCm]);
    await activate(created.id);
    const view = await buyerView(created.id);
    expect(view).toMatchObject({ weightKg: 2, lengthCm: 10 });
    expect(view.price).toBeCloseTo(await expectedPriceUsd(120, ownSet), 2);
    expect(view.price).not.toBeCloseTo(await expectedPriceUsd(120, SET), 2);
    // an INCOMPLETE own set (only some of the four) is not used: the category's is
    await pool.query('UPDATE products SET length_cm = NULL WHERE id = $1', [created.id]);
    const partial = await buyerView(created.id);
    expect(partial).toMatchObject({ weightKg: 5, lengthCm: 30 });
    expect(partial.price).toBeCloseTo(await expectedPriceUsd(120, SET), 2);
  }, 60000);

  it('the cart shows the category\'s weight and prices the line with it', async () => {
    const cat = await makeCategory(SET);
    const created = await (await createProduct(cat, {}, 120)).json();
    await activate(created.id);
    const cartId = `cart_cs_${unique()}`;
    const add = await fetch(`${BACKEND_URL}/cart/${cartId}/items`, { method: 'POST', headers: json, body: JSON.stringify({ productId: created.id, quantity: 1 }) });
    expect(add.status).toBeLessThan(300);
    const cart = await fetch(`${BACKEND_URL}/cart/${cartId}`).then((r) => r.json());
    const line = cart.items.find((i) => i.productId === created.id);
    expect(line.weightKg).toBe(5);
    expect(line.price).toBeCloseTo(await expectedPriceUsd(120, SET), 2);
  }, 60000);

  it('the admin product list and its weight filters use the effective weight; the admin detail keeps the product\'s OWN values empty and reports what is used', async () => {
    const cat = await makeCategory(SET);
    const created = await (await createProduct(cat, {}, 120)).json();
    await activate(created.id);
    const token = await adminToken();
    const list = (query) => fetch(`${BACKEND_URL}/catalog/admin/products?search=${encodeURIComponent(created.nameZh || created.name)}&${query}`, { headers: auth(token) }).then((r) => r.json());
    const inRange = await list('weightMin=4&weightMax=6');
    expect(inRange.products.map((p) => p.id)).toContain(created.id);
    expect(inRange.products.find((p) => p.id === created.id)).toMatchObject({ weightKg: 5, volumeCm3: 4500 });
    expect((await list('weightMin=10')).products.map((p) => p.id)).not.toContain(created.id);
    expect((await list('volumeMin=4000&volumeMax=5000')).products.map((p) => p.id)).toContain(created.id);
    const detail = await fetch(`${BACKEND_URL}/catalog/admin/products/${created.id}`, { headers: auth(token) }).then((r) => r.json());
    expect(detail).toMatchObject({ weightKg: null, lengthCm: null, widthCm: null, heightCm: null });      // the edit form saves these back: they must stay the product's own (none)
    expect(detail.effectiveShipping).toEqual({ source: 'category', weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
  }, 60000);

  it('CRITICAL: bulk import: a row in a category that has them keeps no weight or size of its own; a row in one that has none keeps what the file gave', async () => {
    const withSet = await makeCategory(SET);
    const without = await makeCategory(null);
    const token = await supplierToken();
    const res = await fetch(`${BACKEND_URL}/supplier/me/products/bulk-import`, {
      method: 'POST', headers: auth(token),
      body: JSON.stringify({ fitment: FITMENT, nameLanguage: 'zh', items: [
        { oemNumber: `B1-${unique()}`, itemName: '批量导入测试商品名称一二三四', price: 10, category: withSet.id, part: withSet.part, weightKg: 9, lengthCm: 9, widthCm: 9, heightCm: 9 },
        { oemNumber: `B2-${unique()}`, itemName: '批量导入测试商品名称五六七八', price: 10, category: without.id, part: without.part, weightKg: 3, lengthCm: 4, widthCm: 5, heightCm: 6 },
        { oemNumber: `B3-${unique()}`, itemName: '批量导入测试商品名称九十甲乙', price: 10, category: without.id, part: without.part },
      ] }),
    });
    expect(res.status).toBe(201);
    const { results } = await res.json();
    expect(results.every((r) => r.success)).toBe(true);
    expect(await own(results[0].productId)).toEqual({ weight_kg: null, length_cm: null, width_cm: null, height_cm: null });
    expect(Number((await own(results[1].productId)).weight_kg)).toBe(3);
    const drafts = await fetch(`${BACKEND_URL}/supplier/me/products/drafts`, { headers: auth(token) }).then((r) => r.json());
    const missingOf = (id) => drafts.find((d) => d.id === id).missing;
    expect(missingOf(results[0].productId)).not.toContain('dimensions');       // the category supplies them
    expect(missingOf(results[1].productId)).not.toContain('dimensions');       // its own were given
    expect(missingOf(results[2].productId)).toContain('dimensions');           // neither: still to be entered
  }, 90000);

  it('CRITICAL: finishing a draft in a category that has them needs no weight or size, and stores none; in one that has none they are still required', async () => {
    const withSet = await makeCategory(SET);
    const without = await makeCategory(null);
    const token = await supplierToken();
    const imp = await fetch(`${BACKEND_URL}/supplier/me/products/bulk-import`, {
      method: 'POST', headers: auth(token),
      body: JSON.stringify({ fitment: FITMENT, nameLanguage: 'zh', items: [
        { oemNumber: `D1-${unique()}`, itemName: '草稿完成测试商品名称一二三四', price: 10 }, { oemNumber: `D2-${unique()}`, itemName: '草稿完成测试商品名称五六七八', price: 10 },
      ] }),
    }).then((r) => r.json());
    const [a, b] = imp.results.map((r) => r.productId);
    const finish = async (id, category, extra = {}) => fetch(`${BACKEND_URL}/supplier/me/products/${id}/complete`, {
      method: 'PATCH', headers: auth(token),
      body: JSON.stringify(await asValidProduct({ category: category.id, part: category.part, position: 'Front', ...extra })),
    });
    const ok = await finish(a, withSet);
    expect(ok.status).toBe(200);
    expect(await own(a)).toEqual({ weight_kg: null, length_cm: null, width_cm: null, height_cm: null });
    const refused = await finish(b, without);
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/weightKg/);
    const done = await finish(b, without, { weightKg: 1, lengthCm: 2, widthCm: 3, heightCm: 4 });
    expect(done.status).toBe(200);
    expect(Number((await own(b)).length_cm)).toBe(2);
  }, 90000);
});
