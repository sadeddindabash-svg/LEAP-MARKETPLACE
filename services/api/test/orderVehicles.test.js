// The car of each order line, end to end: a REAL order is placed through the real POST /orders, the real supplier endpoint is read, over HTTP, against the real database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderVehicles.test.js
// (it needs migration 110 applied; it refuses to run on a database whose name does not end in "_test", and removes everything it creates, ids starting "zz-ov".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { chooseCar } = require('../src/modules/orderVehicles/choose');
const { writeOrderVehicles } = require('../src/modules/orderVehicles/record');
const { loadLineVehicles } = require('../src/modules/orderVehicles/read');

let server, base, supplierToken;
const q = (sql, params) => db.query(sql, params);

const wipe = async () => {
  const mine = "o.buyer_id LIKE 'zz-ov-%' OR o.guest_email LIKE 'zz-ov-%'";
  await q(`DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE ${mine})`);
  await q(`DELETE FROM supplier_sub_orders WHERE order_id IN (SELECT o.id FROM orders o WHERE ${mine})`);
  await q(`DELETE FROM order_addresses WHERE order_id IN (SELECT o.id FROM orders o WHERE ${mine})`);
  await q("DELETE FROM orders o WHERE o.buyer_id LIKE 'zz-ov-%' OR o.guest_email LIKE 'zz-ov-%'");
  await q("DELETE FROM product_fitment_entries WHERE product_id LIKE 'zz-ov-%'");
  await q("DELETE FROM products WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM user_saved_generations WHERE buyer_id LIKE 'zz-ov-%'");
  await q("DELETE FROM users WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM suppliers WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM vehicle_versions WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-ov-%'");
  await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-ov-%'");
};

before(async () => {
  // columns that the project's later migrations add to these tables (not in every working copy); harmless where they already exist
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false');
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  for (const c of ['state', 'national_address', 'source', 'postal_code']) await q(`ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  await wipe();
  await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh, photo_url) VALUES ('zz-ov-brand', 'ZZ Brand', 'ب', '品牌', '/uploads/zz-brand.png')");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh) VALUES ('zz-ov-model', 'zz-ov-brand', 'ZZ Model', 'م', '车型')");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, photo_url) VALUES ('zz-ov-gA', 'zz-ov-model', '2022', 2022, 2022, '/uploads/zz-genA.png'), ('zz-ov-gB', 'zz-ov-model', '2018', 2018, 2018, NULL)");
  await q(`INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url, sort_order) VALUES
    ('zz-ov-vA', 'zz-ov-gA', 'May Day', 'ا', '五一', '2.0T (190 kW)', 'ا', '2.0T (190 kW)', 5, '/uploads/zz-verA.png', 1), ('zz-ov-vB', 'zz-ov-gB', 'Base', 'ب', '基础', '1.5T', 'ب', '1.5T', 5, NULL, 1)`);
  for (const id of ['b1', 'b2', 'b3', 'b4', 'b5']) await q("INSERT INTO users (id, email, role) VALUES ($1, $2, 'buyer')", [`zz-ov-${id}`, `zz-ov-${id}@example.com`]);
  const car = (buyer, gen, year, version, isDefault, minutesAgo) => q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, version_id, is_default, created_at) VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' minutes')::interval)", [`zz-ov-${buyer}`, gen, year, version, isDefault, String(minutesAgo)]);
  await car('b1', 'zz-ov-gA', 2022, 'zz-ov-vA', true, 5);                      // b1: only car A, default
  await car('b2', 'zz-ov-gB', 2018, 'zz-ov-vB', true, 5); await car('b2', 'zz-ov-gA', 2022, 'zz-ov-vA', false, 10);     // b2: default B, and A
  await car('b3', 'zz-ov-gB', 2018, 'zz-ov-vB', true, 5);                      // b3: only B
  await car('b5', 'zz-ov-gA', 2021, null, true, 5);                            // b5: car A but the YEAR 2021 (the fit list names 2022); an older car saved without a version
  await q("INSERT INTO suppliers (id, name) VALUES ('zz-ov-s2', 'Other Supplier')");
  await q(`INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity) VALUES ('zz-ov-fitA', 'ZZ Part for A', 10, 'USD', 's1', 100), ('zz-ov-fitB', 'ZZ Part for B', 11, 'USD', 's1', 100),
    ('zz-ov-uni', 'ZZ Universal Part', 5, 'USD', 's1', 100), ('zz-ov-s2part', 'ZZ Other Supplier Part', 7, 'USD', 'zz-ov-s2', 100)`);
  await q("INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ('zz-ov-fitA', 'zz-ov-gA', 2022), ('zz-ov-fitB', 'zz-ov-gB', 2018), ('zz-ov-s2part', 'zz-ov-gA', 2022)");
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'supplier@leap.dev', password: 'supplier_dev_password_123' }) })).json();
  supplierToken = login.token; assert.ok(supplierToken, 'the seed supplier can log in');
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

const ADDRESS = { recipientName: 'Test Buyer', phone: '123', country: 'SA', city: 'Riyadh', streetAddress: 'Street 1' };
async function placeOrder(buyer, productIds, extra = {}) {
  const body = { items: productIds.map((productId) => ({ productId, quantity: 1 })), ...(buyer ? { userId: `zz-ov-${buyer}`, address: ADDRESS } : { guestEmail: 'zz-ov-guest@example.com' }), ...extra };
  const res = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json(); assert.equal(res.status, 201, JSON.stringify(json).slice(0, 300)); return json.id;
}
async function supplierView(orderId) {
  const res = await fetch(`${base}/supplier/me/orders`, { headers: { Authorization: `Bearer ${supplierToken}` } }); assert.equal(res.status, 200);
  return (await res.json()).filter((o) => o.orderId === orderId);
}
const itemOf = (subOrders, productId) => subOrders.flatMap((o) => o.items).find((i) => i.productId === productId);

test('the rule: which car a part is for (pure)', () => {
  const car = (generation_id, year, is_default = false) => ({ generation_id, year, version_id: null, is_default });
  const fitA = [{ generation_id: 'A', year: 2022 }];
  assert.equal(chooseCar([], [car('A', 2022, true)]).status, 'universal');
  assert.equal(chooseCar(fitA, []).status, 'no_car');
  assert.equal(chooseCar(fitA, undefined).status, 'no_car');
  assert.deepEqual(chooseCar(fitA, [car('A', 2022, true)]), { status: 'listed', car: car('A', 2022, true), isDefault: true });
  const other = chooseCar(fitA, [car('B', 2018, true), car('A', 2022)]);
  assert.equal(other.status, 'listed'); assert.equal(other.car.generation_id, 'A'); assert.equal(other.isDefault, false);
  const none = chooseCar(fitA, [car('B', 2018, true), car('C', 2019)]);
  assert.equal(none.status, 'not_listed'); assert.equal(none.car.generation_id, 'B', 'the default car is shown, with a warning');
  assert.equal(chooseCar(fitA, [car('A', 2021, true)]).status, 'not_listed', 'the same model in another year is not on a list that names 2022');
  assert.equal(chooseCar([{ generation_id: 'A', year: 2021 }, { generation_id: 'A', year: 2022 }], [car('A', 2022, true)]).status, 'listed', 'one of several fit-list rows is enough');
  const both = chooseCar([{ generation_id: 'A', year: 2022 }, { generation_id: 'B', year: 2018 }], [car('B', 2018, true), car('A', 2022)]);
  assert.equal(both.car.generation_id, 'B', 'when two garage cars both fit, the DEFAULT car (first in the garage) is the one chosen'); assert.equal(both.isDefault, true);
});

test('the default garage car fits the part: the supplier sees that car, its photo, and "listed"', async () => {
  const orderId = await placeOrder('b1', ['zz-ov-fitA']);
  const item = itemOf(await supplierView(orderId), 'zz-ov-fitA');
  assert.equal(item.vehicle.status, 'listed'); assert.equal(item.vehicle.isDefaultCar, true);
  assert.deepEqual(item.vehicle.car.brand, { en: 'ZZ Brand', ar: 'ب', zh: '品牌' }); assert.equal(item.vehicle.car.model.en, 'ZZ Model'); assert.equal(item.vehicle.car.year, 2022);
  assert.equal(item.vehicle.car.version.en, 'May Day'); assert.equal(item.vehicle.car.version.zh, '五一'); assert.equal(item.vehicle.car.engine.en, '2.0T (190 kW)'); assert.equal(item.vehicle.car.seats, 5);
  assert.equal(item.vehicle.car.photoUrl, '/uploads/zz-verA.png', "the version's photo comes first");
});

test('the default car does not fit but another garage car does: that car is shown, marked as not the default', async () => {
  const orderId = await placeOrder('b2', ['zz-ov-fitA']);
  const item = itemOf(await supplierView(orderId), 'zz-ov-fitA');
  assert.equal(item.vehicle.status, 'listed'); assert.equal(item.vehicle.isDefaultCar, false); assert.equal(item.vehicle.car.year, 2022);
});

test('the part fits none of the buyer\'s cars: the default car is shown with a "not listed" warning', async () => {
  const orderId = await placeOrder('b3', ['zz-ov-fitA']);
  const item = itemOf(await supplierView(orderId), 'zz-ov-fitA');
  assert.equal(item.vehicle.status, 'not_listed'); assert.equal(item.vehicle.isDefaultCar, true); assert.equal(item.vehicle.car.year, 2018);
  assert.equal(item.vehicle.car.photoUrl, '/uploads/zz-brand.png', 'no version photo, no year photo: the model, else the brand photo is used');
});

test('the same model in a different year is "not listed" (the fit list names the year)', async () => {
  const item = itemOf(await supplierView(await placeOrder('b5', ['zz-ov-fitA'])), 'zz-ov-fitA');
  assert.equal(item.vehicle.status, 'not_listed'); assert.equal(item.vehicle.car.year, 2021); assert.equal(item.vehicle.car.version, null, 'a car saved without a version has no version');
  assert.equal(item.vehicle.car.photoUrl, '/uploads/zz-genA.png', "no version: the year's photo");
});

test('a part that fits any car records no car; a buyer with no car, and a guest, give "no car on file"', async () => {
  const universal = itemOf(await supplierView(await placeOrder('b1', ['zz-ov-uni'])), 'zz-ov-uni');
  assert.deepEqual(universal.vehicle, { status: 'universal', isDefaultCar: null, car: null });
  const noGarage = itemOf(await supplierView(await placeOrder('b4', ['zz-ov-fitA'])), 'zz-ov-fitA');
  assert.deepEqual(noGarage.vehicle, { status: 'no_car', isDefaultCar: null, car: null });
  const guest = itemOf(await supplierView(await placeOrder(null, ['zz-ov-fitA'])), 'zz-ov-fitA');
  assert.equal(guest.vehicle.status, 'no_car');
});

test('each line gets its own car, and the buyer\'s own garage is the one used', async () => {
  const subOrders = await supplierView(await placeOrder('b2', ['zz-ov-fitA', 'zz-ov-fitB', 'zz-ov-uni']));
  assert.equal(itemOf(subOrders, 'zz-ov-fitA').vehicle.car.year, 2022); assert.equal(itemOf(subOrders, 'zz-ov-fitB').vehicle.car.year, 2018);
  assert.equal(itemOf(subOrders, 'zz-ov-fitB').vehicle.isDefaultCar, true); assert.equal(itemOf(subOrders, 'zz-ov-uni').vehicle.status, 'universal');
});

test('a supplier sees only the lines of their own sub-order, with their cars', async () => {
  const orderId = await placeOrder('b1', ['zz-ov-fitA', 'zz-ov-s2part']);
  const mine = await supplierView(orderId);
  assert.equal(mine.length, 1, 'one sub-order belongs to supplier s1'); assert.deepEqual(mine[0].items.map((i) => i.productId), ['zz-ov-fitA']);
  const lines = (await q("SELECT oli.id, oli.product_id FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1", [orderId])).rows;
  const otherLine = lines.find((l) => l.product_id === 'zz-ov-s2part'), myLine = lines.find((l) => l.product_id === 'zz-ov-fitA');
  const read = await loadLineVehicles(db, [myLine.id]);
  assert.deepEqual([...read.keys()], [myLine.id], 'reading one line never returns another');
  assert.ok(!read.has(otherLine.id));
});

test('the car is a SNAPSHOT: later changes to the vehicle or the garage do not change what the supplier was told, but the photo is looked up live', async () => {
  const orderId = await placeOrder('b1', ['zz-ov-fitA']);
  await q("UPDATE vehicle_versions SET name = 'Renamed', engine = '9.9T', seats = 7 WHERE id = 'zz-ov-vA'");
  await q("UPDATE vehicle_brands SET name = 'Renamed Brand' WHERE id = 'zz-ov-brand'");
  await q("DELETE FROM user_saved_generations WHERE buyer_id = 'zz-ov-b1'");
  let item = itemOf(await supplierView(orderId), 'zz-ov-fitA');
  assert.equal(item.vehicle.car.version.en, 'May Day'); assert.equal(item.vehicle.car.engine.en, '2.0T (190 kW)'); assert.equal(item.vehicle.car.seats, 5); assert.equal(item.vehicle.car.brand.en, 'ZZ Brand');
  await q("UPDATE vehicle_versions SET photo_url = '/uploads/zz-verA-NEW.png' WHERE id = 'zz-ov-vA'");
  item = itemOf(await supplierView(orderId), 'zz-ov-fitA'); assert.equal(item.vehicle.car.photoUrl, '/uploads/zz-verA-NEW.png', 'a replaced photo shows at once');
  await q("UPDATE vehicle_versions SET photo_url = NULL WHERE id = 'zz-ov-vA'");
  item = itemOf(await supplierView(orderId), 'zz-ov-fitA'); assert.equal(item.vehicle.car.photoUrl, '/uploads/zz-genA.png', 'a removed photo falls back to the next one');
  await q("UPDATE vehicle_versions SET name = 'May Day', engine = '2.0T (190 kW)', seats = 5, photo_url = '/uploads/zz-verA.png' WHERE id = 'zz-ov-vA'");
  await q("UPDATE vehicle_brands SET name = 'ZZ Brand' WHERE id = 'zz-ov-brand'");
  await q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, version_id, is_default) VALUES ('zz-ov-b1', 'zz-ov-gA', 2022, 'zz-ov-vA', true)");
});

test('CRITICAL: if the car cannot be recorded, the order is STILL placed (nothing is lost), and the problem does not poison the order', async () => {
  await q('ALTER TABLE order_line_vehicles RENAME TO order_line_vehicles_off');
  let orderId;
  try { orderId = await placeOrder('b1', ['zz-ov-fitA']); }
  finally { await q('ALTER TABLE order_line_vehicles_off RENAME TO order_line_vehicles'); }
  const lines = (await q("SELECT oli.id FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1", [orderId])).rows;
  assert.equal(lines.length, 1, 'the order and its line exist');
  assert.equal((await q('SELECT count(*)::int AS n FROM order_line_vehicles WHERE line_item_id = ANY($1)', [lines.map((l) => l.id)])).rows[0].n, 0, 'no car was recorded');
  const item = itemOf(await supplierView(orderId), 'zz-ov-fitA'); assert.equal(item.vehicle, null, 'the supplier simply sees no car for it');
  assert.equal((await q('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status, 'to_ship');
});

test('recording twice for the same order never duplicates (a retry is safe)', async () => {
  const orderId = await placeOrder('b1', ['zz-ov-fitA', 'zz-ov-uni']);
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const again = await writeOrderVehicles(client, { orderId, userId: 'zz-ov-b1' }); await client.query('COMMIT'); assert.equal(again, 0, 'nothing new was written'); } finally { client.release(); }
  assert.equal((await q("SELECT count(*)::int AS n FROM order_line_vehicles olv JOIN order_line_items oli ON oli.id = olv.line_item_id JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1", [orderId])).rows[0].n, 2);
});

test('an order placed before this existed shows no car (null), not an error', async () => {
  const orderId = await placeOrder('b1', ['zz-ov-fitA']);
  await q("DELETE FROM order_line_vehicles WHERE line_item_id IN (SELECT oli.id FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1)", [orderId]);
  assert.equal(itemOf(await supplierView(orderId), 'zz-ov-fitA').vehicle, null);
});

test('only the supplier sees the endpoint: no token is refused', async () => {
  assert.equal((await fetch(`${base}/supplier/me/orders`)).status, 401);
});
