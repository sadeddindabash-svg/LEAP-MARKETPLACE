// The status the buyer's order LIST and order page show (displayStatus): a cancelled order says "cancelled" (it used to say "to_ship"), through the REAL routes and the real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderDisplayStatus.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');

let server, base, buyerToken, adminToken, buyerId, n = 0;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const get = async (path, token) => (await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const wipe = async () => {
  await q("DELETE FROM return_cases WHERE order_id LIKE 'zz-ds-%'"); await q("DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id LIKE 'zz-ds-%')");
  await q("DELETE FROM supplier_sub_orders WHERE order_id LIKE 'zz-ds-%'"); await q("DELETE FROM orders WHERE id LIKE 'zz-ds-%'");
};
// an order of the buyer with the given order status and parts ([partStatus, hubStatus|null] ...)
const mk = async (orderStatus, parts) => {
  const id = `zz-ds-${++n}`; await q("INSERT INTO orders (id, buyer_id, status, total, currency_code) VALUES ($1, $2, $3, 10, 'USD')", [id, buyerId, orderStatus]);
  for (const [status, hub] of parts) { const so = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, 's1', $2) RETURNING id", [id, status])).rows[0].id; if (hub) await q("INSERT INTO hub_shipments (sub_order_id, hub_id, status) VALUES ($1, 'hub_guangzhou', $2)", [so, hub]); }
  return id;
};
const shown = async (id, token = buyerToken) => ({ list: (await get('/order', token)).find((o) => o.id === id)?.displayStatus, detail: (await get(`/order/${id}`, token)).displayStatus });

before(async () => {
  await wipe(); const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/order', require('../src/modules/order/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  buyerToken = await login('ui-buyer@example.com', 'buyer_dev_password_123'); adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); assert.ok(buyerToken, 'the demo buyer can sign in'); buyerId = (await q("SELECT id FROM users WHERE email = 'ui-buyer@example.com'")).rows[0].id;
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

test('CRITICAL: a cancelled order is "cancelled" in the list AND on the order page (it used to say "to_ship")', async () => {
  const id = await mk('cancelled', [['cancelled', null]]); assert.deepEqual(await shown(id), { list: 'cancelled', detail: 'cancelled' });
});
test('CRITICAL: an order whose EVERY part is cancelled is cancelled even if the order\'s own status was not updated (the supplier refused and nobody else could supply it)', async () => {
  const id = await mk('to_ship', [['cancelled', null], ['cancelled', null]]); assert.deepEqual(await shown(id), { list: 'cancelled', detail: 'cancelled' });
});
test('an order with a part still going is NOT cancelled: one part refused, another preparing is "to_ship"; with a part on its way it is "shipped"', async () => {
  const a = await mk('to_ship', [['cancelled', null], ['preparing', null]]); assert.deepEqual(await shown(a), { list: 'to_ship', detail: 'to_ship' });
  const b = await mk('to_ship', [['cancelled', null], ['shipped', 'shipped_to_buyer']]); assert.deepEqual(await shown(b), { list: 'shipped', detail: 'shipped' });
});
test('the other statuses are unchanged: to ship, delivered, returns (an order with a return case)', async () => {
  const a = await mk('to_ship', [['pending', null]]); assert.equal((await shown(a)).list, 'to_ship');
  const d = await mk('to_ship', [['shipped', 'delivered']]); assert.equal((await shown(d)).list, 'delivered');
  const r = await mk('to_ship', [['shipped', 'delivered']]); const so = (await q('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [r])).rows[0].id; await q("INSERT INTO return_cases (id, order_id, sub_order_id, buyer_id, reason, status) VALUES ($1, $2, $3, $4, 'x', 'awaiting')", [`zz-ds-rc${n}`, r, so, buyerId]); assert.equal((await shown(r)).list, 'returns');
});
test('an order with no parts yet is "to_ship" (never "cancelled" by an empty list)', async () => { const id = await mk('to_ship', []); assert.equal((await shown(id)).list, 'to_ship'); });
test('the list filter: a cancelled order is not under "to_ship" any more, and it is still in the full list', async () => {
  const c = await mk('cancelled', [['cancelled', null]]); const p = await mk('to_ship', [['pending', null]]); const toShip = (await get('/order?status=to_ship', buyerToken)).map((o) => o.id); assert.ok(toShip.includes(p)); assert.ok(!toShip.includes(c), 'a cancelled order is not "to ship"'); assert.ok((await get('/order', buyerToken)).some((o) => o.id === c));
});
test('the admin sees it as cancelled too', async () => { const id = await mk('cancelled', [['cancelled', null]]); const row = (await get('/order', adminToken)).find((o) => o.id === id); assert.equal(row.displayStatus, 'cancelled'); });
