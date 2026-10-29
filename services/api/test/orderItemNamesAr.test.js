// The buyer's order details (GET /order/:id) give the items' product names in ARABIC when asked with ?lang=ar, English otherwise, English again where a product has no Arabic name. Real route, real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderItemNamesAr.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');

let server, base, buyerToken, adminToken, orderId;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const detail = async (query = '', token = buyerToken) => (await fetch(`${base}/order/${orderId}${query}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const names = (order) => order.supplierSubOrders.flatMap((so) => so.items.map((i) => [i.productId, i.name]));
const wipe = async () => {
  await q("DELETE FROM order_line_items WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id LIKE 'zz-na-%')"); await q("DELETE FROM supplier_sub_orders WHERE order_id LIKE 'zz-na-%'"); await q("DELETE FROM orders WHERE id LIKE 'zz-na-%'"); await q("DELETE FROM products WHERE id LIKE 'zz-na-%'");
};

before(async () => {
  await wipe(); const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/order', require('../src/modules/order/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  buyerToken = await login('ui-buyer@example.com', 'buyer_dev_password_123'); adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); assert.ok(buyerToken, 'the demo buyer can sign in'); const buyerId = (await q("SELECT id FROM users WHERE email = 'ui-buyer@example.com'")).rows[0].id;
  for (const [id, en, ar] of [['zz-na-p1', 'Front Brake Pad Set', 'طقم تيل فرامل أمامي'], ['zz-na-p2', 'Oil Filter', 'فلتر زيت'], ['zz-na-p3', 'Universal Wiper Blade', null], ['zz-na-p4', 'Spark Plug', '']]) await q("INSERT INTO products (id, name, name_ar, price, currency_code, supplier_id, stock_quantity, category, status, oem_number) VALUES ($1, $2, $3, 10, 'USD', 's1', 5, 'brake', 'active', $4)", [id, en, ar, `ZZ-NA-${id}`]);
  orderId = 'zz-na-1'; await q("INSERT INTO orders (id, buyer_id, status, total, currency_code) VALUES ($1, $2, 'to_ship', 40, 'USD')", [orderId, buyerId]);
  const so1 = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, 's1', 'pending') RETURNING id", [orderId])).rows[0].id; const so2 = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, 's2', 'pending') RETURNING id", [orderId])).rows[0].id;
  for (const [so, product, qty, price] of [[so1, 'zz-na-p1', 2, 10], [so1, 'zz-na-p2', 1, 12], [so2, 'zz-na-p3', 4, 3], [so2, 'zz-na-p4', 1, 5]]) await q('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [so, product, qty, price]);
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

const ENGLISH = [['zz-na-p1', 'Front Brake Pad Set'], ['zz-na-p2', 'Oil Filter'], ['zz-na-p3', 'Universal Wiper Blade'], ['zz-na-p4', 'Spark Plug']];
const sorted = (list) => [...list].sort((a, b) => a[0].localeCompare(b[0]));

test('CRITICAL: ?lang=ar gives the Arabic product names; a product with no Arabic name (none, or an empty one) keeps its English name', async () => {
  assert.deepEqual(sorted(names(await detail('?lang=ar'))), [['zz-na-p1', 'طقم تيل فرامل أمامي'], ['zz-na-p2', 'فلتر زيت'], ['zz-na-p3', 'Universal Wiper Blade'], ['zz-na-p4', 'Spark Plug']]);
});
test('CRITICAL: without the language (the old behaviour), in English, or for any other language, the names are English: nothing changes for English', async () => {
  for (const query of ['', '?lang=en', '?lang=fr', '?lang=AR', '?lang=', '?lang=ar%20']) assert.deepEqual(sorted(names(await detail(query))), ENGLISH, query || '(none)');
});
test('only the names change: the items, quantities, prices, order and the rest of the answer are the same in Arabic and in English', async () => {
  const en = await detail(); const ar = await detail('?lang=ar'); const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'name' && typeof v === 'string' && /^[A-Z]/.test(v) || /[\u0600-\u06FF]/.test(String(v)) ? '#' : v)));
  assert.equal(ar.supplierSubOrders.length, en.supplierSubOrders.length); assert.deepEqual(ar.supplierSubOrders.map((s) => s.items.map((i) => [i.productId, i.quantity, i.unitPrice, i.imageUrl])), en.supplierSubOrders.map((s) => s.items.map((i) => [i.productId, i.quantity, i.unitPrice, i.imageUrl])));
  assert.equal(ar.id, en.id); assert.equal(ar.status, en.status); assert.equal(ar.total, en.total); assert.equal(ar.displayStatus, en.displayStatus); assert.deepEqual(Object.keys(strip(ar)).sort(), Object.keys(strip(en)).sort());
});
test('the admin\'s view (no language) still has the English names, and the supplier labels are untouched', async () => {
  const admin = await detail('', adminToken); assert.deepEqual(sorted(names(admin)), ENGLISH);
});
test('the route reads the language exactly once per item: it is exactly "ar" that switches the name (read from the code too)', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'order', 'routes.js'), 'utf8'); assert.ok(s.includes("p.name, p.name_ar\n")); assert.ok(s.includes("name: (req.query.lang === 'ar' && i.name_ar) ? i.name_ar : i.name, quantity: i.quantity,"));
});
