// What the product page's lists and details need from the server, through the REAL catalog routes and the real database: the parts of the same MODEL, the parts of the same BRAND (which leave the
// model's parts out, so no part is in both rows), and whether a size is approximate. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/productPage.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
let server, base;
const q = (sql, params) => db.query(sql, params);
const ids = (list) => list.map((p) => p.id);
const getList = async (id, kind, query = '') => { const r = await fetch(`${base}/catalog/products/${id}/${kind}?limit=50${query}`); return { status: r.status, body: await r.json() }; };

const wipe = async () => {
  await q("DELETE FROM product_fitment_entries WHERE product_id LIKE 'zz-pp-%'"); await q("DELETE FROM products WHERE id LIKE 'zz-pp-%'");
  await q("DELETE FROM category_parts WHERE id LIKE 'zz-pp-%'"); await q("DELETE FROM product_categories WHERE id LIKE 'zz-pp-%'");
  await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-pp-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-pp-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-pp-%'");
};
before(async () => {
  await q('ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_ar TEXT');
  await q('CREATE TABLE IF NOT EXISTS product_attributes (id SERIAL PRIMARY KEY, product_id TEXT NOT NULL, attribute_name TEXT NOT NULL, attribute_value TEXT NOT NULL)');
  await wipe();
  await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh) VALUES ('zz-pp-b1', 'PP Brand One', 'ب1', 'b1'), ('zz-pp-b2', 'PP Brand Two', 'ب2', 'b2')");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh) VALUES ('zz-pp-m1', 'zz-pp-b1', 'PP Model 1', 'م1', 'm1'), ('zz-pp-m2', 'zz-pp-b1', 'PP Model 2', 'م2', 'm2'), ('zz-pp-m3', 'zz-pp-b2', 'PP Model 3', 'م3', 'm3')");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ('zz-pp-g1', 'zz-pp-m1', 'G1', 2020, 2022), ('zz-pp-g1b', 'zz-pp-m1', 'G1b', 2023, 2025), ('zz-pp-g2', 'zz-pp-m2', 'G2', 2020, 2025), ('zz-pp-g3', 'zz-pp-m3', 'G3', 2020, 2025)");
  await q("INSERT INTO product_categories (id, name_en, name_ar, sort_order) VALUES ('zz-pp-cat', 'PP Section', 'ق', 900)");
  await q("INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ('zz-pp-part', 'zz-pp-cat', 'PP Part', 'ج', 1, 2.5, 30, 20, 10)");
  const own = "weight_kg, length_cm, width_cm, height_cm";
  const add = (id, status, stock, extra = '') => q(`INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, ${own}${extra ? ', category, part' : ''}) VALUES ($1, $2, 10, 'USD', 's1', $3, $4, 1.4, 12, 8, 6${extra ? ", 'zz-pp-cat', 'PP Part'" : ''})`, [id, id, stock, status]);
  await add('zz-pp-cur', 'active', 5); await add('zz-pp-q', 'active', 5); await add('zz-pp-q2', 'active', 5); await add('zz-pp-r', 'active', 5); await add('zz-pp-s', 'active', 5);
  await add('zz-pp-nostock', 'active', 0); await add('zz-pp-pending', 'translating', 5); await add('zz-pp-universal', 'active', 5);
  await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, category, part) VALUES ('zz-pp-frompart', 'From part', 10, 'USD', 's1', 5, 'active', 'zz-pp-cat', 'PP Part')");
  const fit = (p, g) => q("INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ($1, $2, 2021)", [p, g]);
  await fit('zz-pp-cur', 'zz-pp-g1'); await fit('zz-pp-q', 'zz-pp-g1b'); await fit('zz-pp-q2', 'zz-pp-g1'); await fit('zz-pp-q2', 'zz-pp-g2'); await fit('zz-pp-r', 'zz-pp-g2'); await fit('zz-pp-s', 'zz-pp-g3');
  await fit('zz-pp-nostock', 'zz-pp-g1'); await fit('zz-pp-pending', 'zz-pp-g1'); await fit('zz-pp-frompart', 'zz-pp-g1');
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

test('same model: the other parts that fit the same vehicle model (in any section), never the part itself, one that is sold out, or one that is not live', async () => {
  const { status, body } = await getList('zz-pp-cur', 'same-model'); assert.equal(status, 200);
  assert.deepEqual(ids(body).sort(), ['zz-pp-frompart', 'zz-pp-q', 'zz-pp-q2']);
});
test('same brand: the other models of the brand, WITHOUT the parts already in the same-model row, and without another brand', async () => {
  const { body } = await getList('zz-pp-cur', 'same-brand'); assert.deepEqual(ids(body), ['zz-pp-r']);
});
test('no part is ever in both rows, and neither row has the part itself', async () => {
  const model = ids((await getList('zz-pp-cur', 'same-model')).body); const brand = ids((await getList('zz-pp-cur', 'same-brand')).body);
  assert.deepEqual(model.filter((id) => brand.includes(id)), []); assert.ok(!model.includes('zz-pp-cur') && !brand.includes('zz-pp-cur'));
});
test('a part that fits two models of the brand is shown once, in the model row', async () => {
  const model = ids((await getList('zz-pp-cur', 'same-model')).body); assert.equal(model.filter((id) => id === 'zz-pp-q2').length, 1);
  assert.ok(!ids((await getList('zz-pp-cur', 'same-brand')).body).includes('zz-pp-q2'));
});
test('paging works: one part per page, no repeats, and an empty page after the last', async () => {
  const seen = []; for (const page of [1, 2, 3]) { const { body } = await getList('zz-pp-cur', 'same-model', `&page=${page}`.replace('limit=50', '')); seen.push(...ids(body)); }
  const one = []; for (const page of [1, 2, 3, 4]) { const r = await fetch(`${base}/catalog/products/zz-pp-cur/same-model?limit=1&page=${page}`); one.push(...ids(await r.json())); }
  assert.deepEqual(one.sort(), ['zz-pp-frompart', 'zz-pp-q', 'zz-pp-q2']); assert.equal(new Set(one).size, one.length);
  assert.deepEqual(await (await fetch(`${base}/catalog/products/zz-pp-cur/same-model?limit=1&page=4`)).json(), []);
});
test('a part with no fitment (fits any car) has no model and no brand row; an unknown part is a 404', async () => {
  assert.deepEqual((await getList('zz-pp-universal', 'same-model')).body, []); assert.deepEqual((await getList('zz-pp-universal', 'same-brand')).body, []);
  assert.equal((await getList('zz-pp-nope', 'same-model')).status, 404); assert.equal((await getList('zz-pp-nope', 'same-brand')).status, 404);
});
test('the cards of the model row are complete buyer cards (name, price, images list)', async () => {
  const [card] = (await getList('zz-pp-cur', 'same-model')).body; assert.ok(card.name && typeof card.price === 'number' && Array.isArray(card.images));
});
test('a size the supplier gave for the product is exact; a size taken from the part is flagged approximate (and is the part\'s)', async () => {
  const own = await (await fetch(`${base}/catalog/products/zz-pp-cur`)).json(); assert.equal(own.sizeApprox, false); assert.deepEqual([own.weightKg, own.lengthCm, own.widthCm, own.heightCm], [1.4, 12, 8, 6]);
  const part = await (await fetch(`${base}/catalog/products/zz-pp-frompart`)).json(); assert.equal(part.sizeApprox, true); assert.deepEqual([part.weightKg, part.lengthCm, part.widthCm, part.heightCm], [2.5, 30, 20, 10]);
});
