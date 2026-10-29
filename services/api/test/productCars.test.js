// What a SUPPLIER receives for each item of an order: the part's main photo and the car(s) the PRODUCT is listed for, never the buyer's car; and what the BUYER's product page receives about the
// cars a product fits. A real order is placed through the real POST /orders and read through the real supplier endpoint, against the real database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/productCars.test.js
// (it needs migration 110 applied; it refuses to run on a database whose name does not end in "_test", and removes everything it creates, ids starting "zz-pc".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { loadBuyerFit, loadProductCars } = require('../src/modules/orderVehicles/productCars');

let server, base, supplierToken, orderId, view;
const q = (sql, params) => db.query(sql, params);

const wipe = async () => {
  const mine = "SELECT o.id FROM orders o WHERE o.buyer_id LIKE 'zz-pc-%'";
  await q(`DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so WHERE so.order_id IN (${mine}))`);
  await q(`DELETE FROM supplier_sub_orders WHERE order_id IN (${mine})`);
  await q(`DELETE FROM order_addresses WHERE order_id IN (${mine})`);
  await q("DELETE FROM orders WHERE buyer_id LIKE 'zz-pc-%'");
  await q("DELETE FROM product_fitment_entries WHERE product_id LIKE 'zz-pc-%'");
  await q("DELETE FROM product_images WHERE product_id LIKE 'zz-pc-%'");
  await q("DELETE FROM products WHERE id LIKE 'zz-pc-%'");
  await q("DELETE FROM user_saved_generations WHERE buyer_id LIKE 'zz-pc-%'");
  await q("DELETE FROM users WHERE id LIKE 'zz-pc-%'");
  await q("DELETE FROM suppliers WHERE id LIKE 'zz-pc-%'");
  await q("DELETE FROM vehicle_engines WHERE id LIKE 'zz-pc-%'"); await q("DELETE FROM vehicle_transmissions WHERE id LIKE 'zz-pc-%'");
  await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-pc-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-pc-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-pc-%'");
};

before(async () => {
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false');
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  for (const c of ['state', 'national_address', 'source', 'postal_code']) await q(`ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  await q('ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country_ar TEXT');            // columns and tables that later migrations add (not in every working copy); harmless where they exist
  await q('CREATE TABLE IF NOT EXISTS product_attributes (id SERIAL PRIMARY KEY, product_id TEXT NOT NULL, attribute_name TEXT NOT NULL, attribute_value TEXT NOT NULL)');
  await wipe();
  await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh, photo_url) VALUES ('zz-pc-brand', 'PC Brand', 'ب', '品牌', '/uploads/zz-pc-brand.png'), ('zz-pc-bbrand', 'ZZBUYERBRAND', 'ز', '买家品牌', NULL)");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh, photo_url) VALUES ('zz-pc-model', 'zz-pc-brand', 'PC Model', 'م', '车型', '/uploads/zz-pc-model.png'), ('zz-pc-model2', 'zz-pc-brand', 'PC Model 2', 'م2', '车型2', NULL), ('zz-pc-bmodel', 'zz-pc-bbrand', 'ZZBUYERMODEL', 'ز', '买家车型', NULL)");
  await q(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, photo_url) VALUES
    ('zz-pc-gA', 'zz-pc-model', '2022', 2022, 2022, '/uploads/zz-pc-genA.png'), ('zz-pc-gB', 'zz-pc-model', '2018', 2018, 2018, NULL), ('zz-pc-gC', 'zz-pc-model', '2019', 2019, 2019, NULL),
    ('zz-pc-gD', 'zz-pc-model', '2020', 2020, 2020, NULL), ('zz-pc-gE', 'zz-pc-model', '2021', 2021, 2021, NULL), ('zz-pc-gF', 'zz-pc-model2', '2017', 2017, 2017, NULL), ('zz-pc-gBuyer', 'zz-pc-bmodel', '2015', 2015, 2015, NULL)`);
  await q("INSERT INTO vehicle_engines (id, generation_id, name, sort_order) VALUES ('zz-pc-eng', 'zz-pc-gA', '2.0T', 1)");
  await q("INSERT INTO vehicle_transmissions (id, generation_id, name, sort_order) VALUES ('zz-pc-tr', 'zz-pc-gA', 'Automatic', 1)");
  await q("INSERT INTO users (id, email, role) VALUES ('zz-pc-b1', 'zz-pc-b1@example.com', 'buyer')");
  await q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, is_default) VALUES ('zz-pc-b1', 'zz-pc-gBuyer', 2015, true)");     // the buyer's own car: unrelated to every product
  await q("INSERT INTO suppliers (id, name) VALUES ('zz-pc-s2', 'Other Supplier')");
  await q(`INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, weight_kg, length_cm, width_cm, height_cm) VALUES ('zz-pc-single', 'PC Single', 10, 'USD', 's1', 100, 'active', 1, 10, 10, 10), ('zz-pc-multi', 'PC Multi', 10, 'USD', 's1', 100, 'active', 1, 10, 10, 10),
    ('zz-pc-uni', 'PC Universal', 5, 'USD', 's1', 100, 'active', 1, 10, 10, 10), ('zz-pc-noimg', 'PC No Image', 6, 'USD', 's1', 100, 'active', 1, 10, 10, 10), ('zz-pc-brandphoto', 'PC Brand Photo', 7, 'USD', 's1', 100, 'active', 1, 10, 10, 10), ('zz-pc-other', 'PC Other Supplier', 8, 'USD', 'zz-pc-s2', 100, 'active', 1, 10, 10, 10)`);
  await q("INSERT INTO product_images (product_id, url, sort_order) VALUES ('zz-pc-single', '/uploads/zz-pc-second.png', 2), ('zz-pc-single', '/uploads/zz-pc-first.png', 1), ('zz-pc-multi', '/uploads/zz-pc-multi.png', 1), ('zz-pc-uni', '/uploads/zz-pc-uni.png', 1), ('zz-pc-brandphoto', '/uploads/zz-pc-bp.png', 1), ('zz-pc-other', '/uploads/zz-pc-other.png', 1)");
  const fit = (product, gen, year, extra = 'NULL, NULL') => q(`INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, ${extra})`, [product, gen, year]);
  await fit('zz-pc-single', 'zz-pc-gA', 2022, "'zz-pc-eng', 'zz-pc-tr'");
  for (const [gen, year] of [['zz-pc-gB', 2018], ['zz-pc-gA', 2022], ['zz-pc-gC', 2019], ['zz-pc-gD', 2020], ['zz-pc-gE', 2021], ['zz-pc-gF', 2017]]) await fit('zz-pc-multi', gen, year);        // added in THIS order
  await fit('zz-pc-noimg', 'zz-pc-gA', 2022); await fit('zz-pc-brandphoto', 'zz-pc-gF', 2017); await fit('zz-pc-other', 'zz-pc-gA', 2022);
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'supplier@leap.dev', password: 'supplier_dev_password_123' }) })).json();
  supplierToken = login.token; assert.ok(supplierToken);
  const res = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ['zz-pc-single', 'zz-pc-multi', 'zz-pc-uni', 'zz-pc-noimg', 'zz-pc-brandphoto', 'zz-pc-other'].map((productId) => ({ productId, quantity: 1 })), userId: 'zz-pc-b1', address: { recipientName: 'T', phone: '1', country: 'SA', city: 'Riyadh', streetAddress: 'x' } }) });
  const json = await res.json(); assert.equal(res.status, 201, JSON.stringify(json).slice(0, 200)); orderId = json.id;
  view = async () => { const r = await fetch(`${base}/supplier/me/orders`, { headers: { Authorization: `Bearer ${supplierToken}` } }); assert.equal(r.status, 200); return (await r.json()).filter((o) => o.orderId === orderId); };
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });
const itemOf = (subOrders, productId) => subOrders.flatMap((o) => o.items).find((i) => i.productId === productId);

test('the supplier gets the part\'s MAIN photo: the first one by order, not the first one stored', async () => {
  assert.equal(itemOf(await view(), 'zz-pc-single').vehicle.partPhotoUrl, '/uploads/zz-pc-first.png');
});

test('the supplier gets the car the product is listed for: names in three languages, the year, the engine and transmission, and the car\'s photo', async () => {
  const v = itemOf(await view(), 'zz-pc-single').vehicle;
  assert.equal(v.fitsAnyCar, false); assert.equal(v.carCount, 1); assert.equal(v.cars.length, 1);
  assert.deepEqual(v.cars[0], { year: 2022, brand: { en: 'PC Brand', ar: 'ب', zh: '品牌' }, model: { en: 'PC Model', ar: 'م', zh: '车型' }, engine: '2.0T', transmission: 'Automatic', photoUrl: '/uploads/zz-pc-genA.png', versions: null });
});

test('PRIVACY: the buyer\'s own car is never sent to the supplier, and nothing about a "fit check" against it', async () => {
  const mine = await view(); const text = JSON.stringify(mine);
  assert.ok(!text.includes('ZZBUYERBRAND') && !text.includes('ZZBUYERMODEL') && !text.includes('zz-pc-gBuyer') && !text.includes('2015'), 'nothing of the buyer\'s car is in the answer');
  for (const item of mine.flatMap((o) => o.items)) for (const key of ['status', 'isDefaultCar', 'car']) assert.ok(!(key in item.vehicle), `no "${key}" in ${item.productId}`);
  const recorded = (await q("SELECT count(*)::int AS n FROM order_line_vehicles olv JOIN order_line_items oli ON oli.id = olv.line_item_id JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1 AND olv.brand = 'ZZBUYERBRAND'", [orderId])).rows[0].n;
  assert.ok(recorded > 0, 'the buyer\'s car IS still recorded internally for this order (it is just never sent to a supplier)');
});

test('a part listed for several cars: at most four are sent, the real total is given, and the first is the one the supplier added first', async () => {
  const v = itemOf(await view(), 'zz-pc-multi').vehicle;
  assert.equal(v.carCount, 6); assert.equal(v.cars.length, 4);
  assert.deepEqual(v.cars.map((c) => c.year), [2018, 2022, 2019, 2020], 'in the order the fitment was added');
});

test('the car\'s photo: the year\'s photo, else the model\'s, else the brand\'s', async () => {
  const cars = itemOf(await view(), 'zz-pc-multi').vehicle.cars;
  assert.equal(cars[1].photoUrl, '/uploads/zz-pc-genA.png', "2022 has its own photo"); assert.equal(cars[0].photoUrl, '/uploads/zz-pc-model.png', '2018 has none: the model\'s');
  assert.equal(itemOf(await view(), 'zz-pc-brandphoto').vehicle.cars[0].photoUrl, '/uploads/zz-pc-brand.png', 'a model with no photo: the brand\'s');
});

test('a part that fits any car says so, and still has its photo; a part with no photo has none', async () => {
  const uni = itemOf(await view(), 'zz-pc-uni').vehicle;
  assert.deepEqual(uni, { partPhotoUrl: '/uploads/zz-pc-uni.png', fitsAnyCar: true, carCount: 0, cars: [] });
  assert.equal(itemOf(await view(), 'zz-pc-noimg').vehicle.partPhotoUrl, null);
});

test('a supplier only ever sees their own lines', async () => {
  const mine = await view(); assert.equal(mine.length, 1, 'one sub-order belongs to supplier s1');
  assert.ok(!itemOf(mine, 'zz-pc-other'), "the other supplier's part is not there"); assert.ok(!JSON.stringify(mine).includes('zz-pc-other.png'));
});

test('the cars are read live: when the supplier changes the part\'s fitment, the order shows it', async () => {
  const before = (await q("SELECT id FROM product_fitment_entries WHERE product_id = 'zz-pc-single'")).rows[0].id;
  await q('DELETE FROM product_fitment_entries WHERE id = $1', [before]);
  try { assert.equal(itemOf(await view(), 'zz-pc-single').vehicle.fitsAnyCar, true); }
  finally { await q("INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ('zz-pc-single', 'zz-pc-gA', 2022, 'zz-pc-eng', 'zz-pc-tr')"); }
  assert.equal(itemOf(await view(), 'zz-pc-single').vehicle.cars[0].year, 2022);
});

test('only a signed-in supplier can read it', async () => {
  assert.equal((await fetch(`${base}/supplier/me/orders`)).status, 401);
});

test('the BUYER\'s view: the first three cars, the real total, and a key of EVERY car (so the storefront can test the buyer\'s own car)', async () => {
  const fit = await loadBuyerFit(db, 'zz-pc-multi');
  assert.equal(fit.fitCarCount, 6); assert.equal(fit.fitCars.length, 3);
  assert.deepEqual(fit.fitCars[0], { generationId: 'zz-pc-gB', year: 2018, brand: 'PC Brand', brandAr: 'ب', model: 'PC Model', modelAr: 'م' });
  assert.deepEqual(fit.fitKeys, ['zz-pc-gB|2018', 'zz-pc-gA|2022', 'zz-pc-gC|2019', 'zz-pc-gD|2020', 'zz-pc-gE|2021', 'zz-pc-gF|2017']);
  assert.deepEqual(await loadBuyerFit(db, 'zz-pc-uni'), { fitCarCount: 0, fitCars: [], fitKeys: [] });
});

test('CRITICAL: if the fit cannot be read, the product page is NOT taken down: the buyer\'s view is simply empty', async () => {
  const broken = { query: async () => { throw new Error('boom'); } };
  assert.deepEqual(await loadBuyerFit(broken, 'zz-pc-multi'), { fitCarCount: 0, fitCars: [], fitKeys: [] });
});

test('reading nothing is harmless', async () => {
  assert.equal((await loadProductCars(db, [])).size, 0); assert.equal((await loadProductCars(db, undefined)).size, 0);
});

test('the REAL product page endpoint returns what the storefront needs: the first cars, the real total, a key of every car; and the OLD fit list stays empty for a part that has only the structured fitment', async () => {
  const res = await fetch(`${base}/catalog/products/zz-pc-multi`); assert.equal(res.status, 200);
  const p = await res.json();
  assert.equal(p.fitCarCount, 6); assert.equal(p.fitCars.length, 3); assert.equal(p.fitCars[0].generationId, 'zz-pc-gB'); assert.equal(p.fitCars[0].brand, 'PC Brand'); assert.equal(p.fitCars[0].modelAr, 'م');
  assert.equal(p.fitKeys.length, 6); assert.ok(p.fitKeys.includes('zz-pc-gF|2017'), 'every car has a key, not only the first three');
  assert.deepEqual(p.fitsVehicleIds, [], 'the older list (which the old green badge reads) is empty for this part: that is why the new message reads fitKeys instead');
});

test('the real product page endpoint for a part that fits any car: nothing to match', async () => {
  const p = await (await fetch(`${base}/catalog/products/zz-pc-uni`)).json();
  assert.equal(p.fitCarCount, 0); assert.deepEqual(p.fitCars, []); assert.deepEqual(p.fitKeys, []);
});
