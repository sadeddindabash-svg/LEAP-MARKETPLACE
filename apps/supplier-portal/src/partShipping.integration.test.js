// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { asValidProduct } from './productFixtures';

// A PART (the sub-category: "Front Brake Disc" under "Brake System") has a weight and a package size set by the ADMIN (backend migration 104), and the shipping cost of
// every product with that part uses them automatically:
//   - a product with its OWN complete set keeps using it (nothing that already has one changes);
//   - otherwise it uses its part's;
//   - the supplier enters none of the four when the part has them.
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

// A category (names and photo only) ...
async function makeCategory() {
  const id = `test_cat_shipping_${unique()}`;      // the "test_cat_" start is how the cleanup tool (remove-test-data) recognises it
  const res = await fetch(`${BACKEND_URL}/catalog/categories`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ id, nameEn: `CS ${id}`, nameAr: 'فئة', photoUrl: '/uploads/c.jpg' }) });
  expect(res.status).toBe(201);
  return id;
}
// ... and a PART in it. `shipping` null = a part that has none yet (made directly in the database: the API now always requires the four values).
async function makePart(categoryId, shipping, name = `Part ${unique()}`) {
  if (shipping) {
    const res = await fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/parts`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ nameEn: name, nameAr: 'جزء', ...shipping }) });
    expect(res.status).toBe(201);
    return { category: categoryId, part: name, partId: (await res.json()).id };
  }
  const partId = `part_cs_${unique()}`;
  await pool.query(`INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order) VALUES ($1, $2, $3, 'جزء', 9999)`, [partId, categoryId, name]);
  return { category: categoryId, part: name, partId };
}
const newPart = async (shipping) => makePart(await makeCategory(), shipping);

async function createProduct(target, extra = {}, price = 120) {
  const token = await supplierToken();
  const body = await asValidProduct({ nameZh: `类别重量测试${unique()}`, category: target.category, part: target.part, position: 'Front', oemNumber: `OEM-${unique()}`, price, currencyCode: 'CNY', fitment: FITMENT, ...extra });
  return fetch(`${BACKEND_URL}/supplier/me/products`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
}
const own = async (productId) => (await pool.query('SELECT weight_kg, length_cm, width_cm, height_cm FROM products WHERE id = $1', [productId])).rows[0];
const NONE = { weight_kg: null, length_cm: null, width_cm: null, height_cm: null };
const activate = (productId) => pool.query(`UPDATE products SET status = 'active', stock_quantity = 10 WHERE id = $1`, [productId]);
async function expectedPriceUsd(supplierCostCny, shipping) {
  const res = await fetch(`${BACKEND_URL}/pricing/preview`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ supplierCostCny, ...shipping }) });
  expect(res.status).toBe(200);
  return (await res.json()).buyerPriceUsd;
}
const buyerView = (productId) => fetch(`${BACKEND_URL}/catalog/products/${productId}`).then((r) => r.json());
const supplierList = async () => (await fetch(`${BACKEND_URL}/supplier/me/products`, { headers: auth(await supplierToken()) }).then((r) => r.json()));
const editPart = async (partId, body) => fetch(`${BACKEND_URL}/catalog/parts/${partId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify(body) });

describe.runIf(backendUp)('part weight and size in the shipping cost (real backend)', () => {
  it('CRITICAL: for a part that has them, the supplier enters none of the four: a product is created without them and stores none of its own', async () => {
    const target = await newPart(SET);
    const res = await createProduct(target);
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(await own(created.id)).toEqual(NONE);
    expect(created).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5, shippingSource: 'part' });       // what the supplier sees: the ones in use
    expect((await supplierList()).find((p) => p.id === created.id)).toMatchObject({ weightKg: 5, shippingSource: 'part' });
  }, 60000);

  it('whatever weight or size a supplier sends for such a part is ignored (even invalid), so every product with that part is treated the same', async () => {
    const target = await newPart(SET);
    const res = await createProduct(target, { weightKg: 99, lengthCm: 200, widthCm: -1, heightCm: 0 });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(await own(created.id)).toEqual(NONE);
    expect(created).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
  }, 60000);

  it('CRITICAL: for a part with none yet, the supplier still has to enter all four (named when missing), and the product keeps its own', async () => {
    const target = await newPart(null);
    const missing = await createProduct(target);
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('Missing required field(s): weightKg, lengthCm, widthCm, heightCm');
    expect((await createProduct(target, { ...SET, weightKg: -2 })).status).toBe(400);
    const ok = await createProduct(target, { weightKg: 2, lengthCm: 10, widthCm: 11, heightCm: 12 });
    expect(ok.status).toBe(201);
    const created = await ok.json();
    expect(Object.fromEntries(Object.entries(await own(created.id)).map(([k, v]) => [k, Number(v)]))).toEqual({ weight_kg: 2, length_cm: 10, width_cm: 11, height_cm: 12 });
    expect(created).toMatchObject({ weightKg: 2, shippingSource: 'product' });
  }, 60000);

  it('CRITICAL: it is the PART that decides, not the category: two parts of one category with different values give different weights and prices, and a third with none still asks the supplier', async () => {
    const category = await makeCategory();
    const light = await makePart(category, { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 5 });
    const heavy = await makePart(category, { weightKg: 40, lengthCm: 60, widthCm: 40, heightCm: 30 });
    const bare = await makePart(category, null);
    const a = await (await createProduct(light, {}, 120)).json();
    const b = await (await createProduct(heavy, {}, 120)).json();
    expect(a).toMatchObject({ weightKg: 1, lengthCm: 10 });
    expect(b).toMatchObject({ weightKg: 40, lengthCm: 60 });
    await activate(a.id); await activate(b.id);
    const priceA = (await buyerView(a.id)).price;
    const priceB = (await buyerView(b.id)).price;
    expect(priceA).toBeCloseTo(await expectedPriceUsd(120, { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 5 }), 2);
    expect(priceB).toBeCloseTo(await expectedPriceUsd(120, { weightKg: 40, lengthCm: 60, widthCm: 40, heightCm: 30 }), 2);
    expect(priceB).toBeGreaterThan(priceA);
    expect((await createProduct(bare)).status).toBe(400);                         // the third part has none: the supplier must enter them
  }, 90000);

  it('CRITICAL: the buyer price uses the part\'s weight and size, and equals the admin price calculator for exactly those numbers', async () => {
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
    await activate(created.id);
    const view = await buyerView(created.id);
    expect(view).toMatchObject({ weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
    expect(view.price).toBeCloseTo(await expectedPriceUsd(120, SET), 2);
  }, 60000);

  it('CRITICAL: a change to the part\'s weight reaches the price at once (prices are live), and a bigger package costs more', async () => {
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
    await activate(created.id);
    const before = (await buyerView(created.id)).price;
    const heavier = { weightKg: 50, lengthCm: 30, widthCm: 30, heightCm: 5 };
    const patch = await editPart(target.partId, { nameEn: target.part, nameAr: 'جزء', ...heavier });
    expect(patch.status).toBe(200);
    const after = (await buyerView(created.id)).price;
    expect(after).toBeCloseTo(await expectedPriceUsd(120, heavier), 2);
    expect(after).toBeGreaterThan(before);
    expect(await expectedPriceUsd(120, heavier)).toBeGreaterThan(await expectedPriceUsd(120, SET));
  }, 60000);

  it('CRITICAL: renaming a part carries its products along, so they keep the part\'s weight and size (and their price does not change)', async () => {
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
    await activate(created.id);
    const before = await buyerView(created.id);
    const renamed = `${target.part} Renamed`;
    const res = await editPart(target.partId, { nameEn: renamed, nameAr: 'جزء' });
    expect(res.status).toBe(200);
    expect((await pool.query('SELECT part FROM products WHERE id = $1', [created.id])).rows[0].part).toBe(renamed);       // the product now points at the new name
    const after = await buyerView(created.id);
    expect(after).toMatchObject({ weightKg: 5, lengthCm: 30 });
    expect(after.price).toBeCloseTo(before.price, 6);
    expect((await supplierList()).find((p) => p.id === created.id)).toMatchObject({ part: renamed, shippingSource: 'part' });
    // a capital-letters-only rename keeps the link too
    expect((await editPart(target.partId, { nameEn: renamed.toUpperCase(), nameAr: 'جزء' })).status).toBe(200);
    expect(await buyerView(created.id)).toMatchObject({ weightKg: 5 });
  }, 90000);

  it('a rename touches only the products of THAT part in THAT category (another category\'s part with the same name keeps its products)', async () => {
    const name = `Shared Name ${unique()}`;
    const one = await makePart(await makeCategory(), SET, name);
    const other = await makePart(await makeCategory(), SET, name);
    const a = await (await createProduct(one)).json();
    const b = await (await createProduct(other)).json();
    expect((await editPart(one.partId, { nameEn: `${name} New`, nameAr: 'جزء' })).status).toBe(200);
    expect((await pool.query('SELECT part FROM products WHERE id = $1', [a.id])).rows[0].part).toBe(`${name} New`);
    expect((await pool.query('SELECT part FROM products WHERE id = $1', [b.id])).rows[0].part).toBe(name);
  }, 90000);

  it('CRITICAL: a product that already has its OWN complete set keeps using it, even for a part that has one (no existing price changes)', async () => {
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
    const ownSet = { weightKg: 2, lengthCm: 10, widthCm: 10, heightCm: 10 };
    await pool.query('UPDATE products SET weight_kg = $2, length_cm = $3, width_cm = $4, height_cm = $5 WHERE id = $1', [created.id, ownSet.weightKg, ownSet.lengthCm, ownSet.widthCm, ownSet.heightCm]);
    await activate(created.id);
    const view = await buyerView(created.id);
    expect(view).toMatchObject({ weightKg: 2, lengthCm: 10 });
    expect(view.price).toBeCloseTo(await expectedPriceUsd(120, ownSet), 2);
    expect(view.price).not.toBeCloseTo(await expectedPriceUsd(120, SET), 2);
    await pool.query('UPDATE products SET length_cm = NULL WHERE id = $1', [created.id]);          // an INCOMPLETE own set is not used: the part's is
    const partial = await buyerView(created.id);
    expect(partial).toMatchObject({ weightKg: 5, lengthCm: 30 });
    expect(partial.price).toBeCloseTo(await expectedPriceUsd(120, SET), 2);
  }, 60000);

  it('the cart shows the part\'s weight and prices the line with it', async () => {
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
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
    const target = await newPart(SET);
    const created = await (await createProduct(target, {}, 120)).json();
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
    expect(detail.effectiveShipping).toEqual({ source: 'part', weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 5 });
  }, 60000);

  it('CRITICAL: bulk import: a row whose part has them keeps no weight or size of its own; a row whose part has none keeps what the file gave', async () => {
    const withSet = await newPart(SET);
    const without = await newPart(null);
    const token = await supplierToken();
    const res = await fetch(`${BACKEND_URL}/supplier/me/products/bulk-import`, {
      method: 'POST', headers: auth(token),
      body: JSON.stringify({ fitment: FITMENT, nameLanguage: 'zh', items: [
        { oemNumber: `B1-${unique()}`, itemName: '批量导入测试商品名称一二三四', price: 10, category: withSet.category, part: withSet.part, weightKg: 9, lengthCm: 9, widthCm: 9, heightCm: 9 },
        { oemNumber: `B2-${unique()}`, itemName: '批量导入测试商品名称五六七八', price: 10, category: without.category, part: without.part, weightKg: 3, lengthCm: 4, widthCm: 5, heightCm: 6 },
        { oemNumber: `B3-${unique()}`, itemName: '批量导入测试商品名称九十甲乙', price: 10, category: without.category, part: without.part },
      ] }),
    });
    expect(res.status).toBe(201);
    const { results } = await res.json();
    expect(results.every((r) => r.success)).toBe(true);
    expect(await own(results[0].productId)).toEqual(NONE);
    expect(Number((await own(results[1].productId)).weight_kg)).toBe(3);
    const drafts = await fetch(`${BACKEND_URL}/supplier/me/products/drafts`, { headers: auth(token) }).then((r) => r.json());
    const missingOf = (id) => drafts.find((d) => d.id === id).missing;
    expect(missingOf(results[0].productId)).not.toContain('dimensions');       // the part supplies them
    expect(missingOf(results[1].productId)).not.toContain('dimensions');       // its own were given
    expect(missingOf(results[2].productId)).toContain('dimensions');           // neither: still to be entered
  }, 90000);

  it('CRITICAL: finishing a draft whose part has them needs no weight or size, and stores none; for a part with none they are still required', async () => {
    const withSet = await newPart(SET);
    const without = await newPart(null);
    const token = await supplierToken();
    const imp = await fetch(`${BACKEND_URL}/supplier/me/products/bulk-import`, {
      method: 'POST', headers: auth(token),
      body: JSON.stringify({ fitment: FITMENT, nameLanguage: 'zh', items: [
        { oemNumber: `D1-${unique()}`, itemName: '草稿完成测试商品名称一二三四', price: 10 }, { oemNumber: `D2-${unique()}`, itemName: '草稿完成测试商品名称五六七八', price: 10 },
      ] }),
    }).then((r) => r.json());
    const [a, b] = imp.results.map((r) => r.productId);
    const finish = async (id, target, extra = {}) => fetch(`${BACKEND_URL}/supplier/me/products/${id}/complete`, {
      method: 'PATCH', headers: auth(token),
      body: JSON.stringify(await asValidProduct({ category: target.category, part: target.part, position: 'Front', ...extra })),
    });
    const ok = await finish(a, withSet);
    expect(ok.status).toBe(200);
    expect(await own(a)).toEqual(NONE);
    const refused = await finish(b, without);
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/weightKg/);
    const done = await finish(b, without, { weightKg: 1, lengthCm: 2, widthCm: 3, heightCm: 4 });
    expect(done.status).toBe(200);
    expect(Number((await own(b)).length_cm)).toBe(2);
  }, 90000);
});
