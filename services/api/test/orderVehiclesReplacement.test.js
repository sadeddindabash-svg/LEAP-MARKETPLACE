// A REPLACEMENT order (an admin confirms a replacement for a faulty part) is for the same car as the part it replaces, so the supplier sees that car too. A REAL order is placed through the
// real POST /orders, a real fault case is built, the real confirmReplacement runs, and the replacement is read through the real supplier endpoint. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderVehiclesReplacement.test.js
// (it needs migration 110 applied; it refuses to run on a database whose name does not end in "_test", and removes everything it creates, ids starting "zz-rp".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { confirmReplacement } = require('../src/modules/faultCases/helpers');

let server, base, supplierToken;
const q = (sql, params) => db.query(sql, params);

const wipe = async () => {
  const mine = "SELECT o.id FROM orders o WHERE o.buyer_id LIKE 'zz-rp-%'";
  await q(`DELETE FROM fault_case_items WHERE fault_case_id IN (SELECT fc.id FROM fault_cases fc JOIN supplier_sub_orders so ON so.id = fc.sub_order_id WHERE so.order_id IN (${mine}))`);
  await q(`DELETE FROM fault_cases WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so WHERE so.order_id IN (${mine}))`);
  await q(`DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so WHERE so.order_id IN (${mine}))`);
  await q(`DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so WHERE so.order_id IN (${mine}))`);
  await q(`DELETE FROM supplier_sub_orders WHERE order_id IN (${mine})`);
  await q(`DELETE FROM order_addresses WHERE order_id IN (${mine})`);
  await q("DELETE FROM orders WHERE buyer_id LIKE 'zz-rp-%' AND replacement_of IS NOT NULL");
  await q("DELETE FROM orders WHERE buyer_id LIKE 'zz-rp-%'");
  await q("DELETE FROM product_fitment_entries WHERE product_id LIKE 'zz-rp-%'");
  await q("DELETE FROM products WHERE id LIKE 'zz-rp-%'");
  await q("DELETE FROM user_saved_generations WHERE buyer_id LIKE 'zz-rp-%'");
  await q("DELETE FROM users WHERE id LIKE 'zz-rp-%'");
  await q("DELETE FROM vehicle_versions WHERE id LIKE 'zz-rp-%'");
  await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-rp-%'");
  await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-rp-%'");
  await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-rp-%'");
};

before(async () => {
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false');
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  for (const c of ['state', 'national_address', 'source', 'postal_code']) await q(`ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  await wipe();
  await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh, photo_url) VALUES ('zz-rp-brand', 'RP Brand', 'ب', '品牌', '/uploads/zz-rp-brand.png')");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh) VALUES ('zz-rp-model', 'zz-rp-brand', 'RP Model', 'م', '车型')");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ('zz-rp-gA', 'zz-rp-model', '2022', 2022, 2022), ('zz-rp-gC', 'zz-rp-model', '2019', 2019, 2019)");
  await q(`INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url, sort_order) VALUES
    ('zz-rp-vA', 'zz-rp-gA', 'May Day', 'ا', '五一', '2.0T', 'ا', '2.0T', 5, '/uploads/zz-rp-ver.png', 1)`);
  await q("INSERT INTO users (id, email, role) VALUES ('zz-rp-b1', 'zz-rp-b1@example.com', 'buyer')");
  await q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, version_id, is_default) VALUES ('zz-rp-b1', 'zz-rp-gA', 2022, 'zz-rp-vA', true)");
  await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity) VALUES ('zz-rp-pad', 'RP Brake Pad', 10, 'USD', 's1', 100), ('zz-rp-wiper', 'RP Wiper', 5, 'USD', 's1', 100)");
  await q("INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ('zz-rp-pad', 'zz-rp-gA', 2022)");
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'supplier@leap.dev', password: 'supplier_dev_password_123' }) })).json();
  supplierToken = login.token; assert.ok(supplierToken);
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

async function placeOrder(productIds) {
  const res = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: productIds.map((productId) => ({ productId, quantity: 1 })), userId: 'zz-rp-b1', address: { recipientName: 'T', phone: '1', country: 'SA', city: 'Riyadh', streetAddress: 'x' } }) });
  const json = await res.json(); assert.equal(res.status, 201, JSON.stringify(json).slice(0, 200)); return json.id;
}
/** A real fault case on the sub-order of `orderId`, as if the hub found `productId` faulty and the supplier said they can replace it. */
async function faultCaseFor(orderId, productId) {
  const so = (await q('UPDATE supplier_sub_orders SET hub_id = $2 WHERE order_id = $1 AND supplier_id = $3 RETURNING id', [orderId, 'hub_guangzhou', 's1'])).rows[0].id;
  const shipment = (await q("INSERT INTO hub_shipments (sub_order_id, hub_id) VALUES ($1, 'hub_guangzhou') RETURNING id", [so])).rows[0].id;
  const fc = (await q("INSERT INTO fault_cases (shipment_id, sub_order_id, status, cost_bearer, supplier_can_replace, supplier_answered_at) VALUES ($1, $2, 'awaiting_admin', 'supplier', true, now()) RETURNING id", [shipment, so])).rows[0].id;
  await q('INSERT INTO fault_case_items (fault_case_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [fc, productId]);
  return { caseId: fc, subOrderId: so };
}
async function replace(caseId) {
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const out = await confirmReplacement(client, { caseId, adminId: 'admin_dev_seed' }); await client.query('COMMIT'); return out; }
  catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}
const replacementOf = async (caseId) => (await q('SELECT replacement_order_id FROM fault_cases WHERE id = $1', [caseId])).rows[0].replacement_order_id;
async function supplierView(orderId) {
  const res = await fetch(`${base}/supplier/me/orders`, { headers: { Authorization: `Bearer ${supplierToken}` } }); assert.equal(res.status, 200);
  return (await res.json()).filter((o) => o.orderId === orderId).flatMap((o) => o.items);
}

test('a replacement order shows the same car as the part it replaces, with its photo, to the supplier', async () => {
  const original = await placeOrder(['zz-rp-pad', 'zz-rp-wiper']);
  const { caseId } = await faultCaseFor(original, 'zz-rp-pad');
  await replace(caseId);
  const replacementId = await replacementOf(caseId);
  assert.equal(replacementId, `${original}-R1`);
  const items = await supplierView(replacementId);
  assert.deepEqual(items.map((i) => i.productId), ['zz-rp-pad'], 'the replacement has only the faulty part');
  assert.equal(items[0].vehicle.status, 'listed'); assert.equal(items[0].vehicle.car.brand.en, 'RP Brand'); assert.equal(items[0].vehicle.car.year, 2022); assert.equal(items[0].vehicle.car.seats, 5);
  assert.equal(items[0].vehicle.car.photoUrl, '/uploads/zz-rp-ver.png');
});

test('each replacement line gets the record of ITS OWN part: replacing the wiper (fits any car) never shows the brake pad\'s car', async () => {
  const original = await placeOrder(['zz-rp-pad', 'zz-rp-wiper']);
  const { caseId } = await faultCaseFor(original, 'zz-rp-wiper'); await replace(caseId);
  const items = await supplierView(await replacementOf(caseId));
  assert.deepEqual(items.map((i) => i.productId), ['zz-rp-wiper']);
  assert.deepEqual(items[0].vehicle, { status: 'universal', isDefaultCar: null, car: null });
});

test('the car is COPIED from the original order, not worked out again: a garage that changed since does not matter', async () => {
  const original = await placeOrder(['zz-rp-pad']);
  await q("DELETE FROM user_saved_generations WHERE buyer_id = 'zz-rp-b1'");
  await q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, is_default) VALUES ('zz-rp-b1', 'zz-rp-gC', 2019, true)");
  try {
    const { caseId } = await faultCaseFor(original, 'zz-rp-pad'); await replace(caseId);
    const [item] = await supplierView(await replacementOf(caseId));
    assert.equal(item.vehicle.car.year, 2022, 'the car the part was bought for, not the buyer\'s car today');
  } finally {
    await q("DELETE FROM user_saved_generations WHERE buyer_id = 'zz-rp-b1'");
    await q("INSERT INTO user_saved_generations (buyer_id, generation_id, year, version_id, is_default) VALUES ('zz-rp-b1', 'zz-rp-gA', 2022, 'zz-rp-vA', true)");
  }
});

test('a replacement of a part from an order placed before this existed is created normally, with no car', async () => {
  const original = await placeOrder(['zz-rp-pad']);
  await q("DELETE FROM order_line_vehicles WHERE line_item_id IN (SELECT oli.id FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1)", [original]);
  const { caseId } = await faultCaseFor(original, 'zz-rp-pad'); await replace(caseId);
  const [item] = await supplierView(await replacementOf(caseId));
  assert.equal(item.vehicle, null);
});

test('CRITICAL: if the car cannot be copied, the replacement is STILL created', async () => {
  const original = await placeOrder(['zz-rp-pad']);
  const { caseId } = await faultCaseFor(original, 'zz-rp-pad');
  await q('ALTER TABLE order_line_vehicles RENAME TO order_line_vehicles_off');
  let replacementId;
  try { await replace(caseId); replacementId = await replacementOf(caseId); }
  finally { await q('ALTER TABLE order_line_vehicles_off RENAME TO order_line_vehicles'); }
  assert.equal(replacementId, `${original}-R1`, 'the replacement order exists');
  assert.equal((await q("SELECT count(*)::int AS n FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1", [replacementId])).rows[0].n, 1, 'with its line');
  assert.equal((await q("SELECT outcome FROM fault_cases WHERE id = $1", [caseId])).rows[0].outcome, 'replacement', 'and the case moved on');
  assert.equal((await supplierView(replacementId))[0].vehicle, null);
});
