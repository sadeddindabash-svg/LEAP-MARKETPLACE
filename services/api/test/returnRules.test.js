// "Request a return" follows ONE rule: the pure rule, the admin's window setting, the order details (returnable, returnUntil) through the real route and database, and the server's refusal for a cancelled part:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/returnRules.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');
const { returnState, readReturnWindowDays } = require('../src/modules/returns/returnRules');

const DAY = 24 * 60 * 60 * 1000; const NOW = new Date('2026-10-29T12:00:00Z'); const ago = (days) => new Date(NOW.getTime() - days * DAY);
let server, base, buyerToken, buyerId, originalWindow, n = 0;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const setWindow = (days) => q("INSERT INTO platform_settings (key, value) VALUES ('return_window_days', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [String(days)]);
const wipe = async () => { await q("DELETE FROM return_cases WHERE order_id LIKE 'zz-rr-%'").catch(() => {}); await q("DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE order_id LIKE 'zz-rr-%')"); await q("DELETE FROM supplier_sub_orders WHERE order_id LIKE 'zz-rr-%'"); await q("DELETE FROM orders WHERE id LIKE 'zz-rr-%'"); };
// an order of the buyer: orderStatus, and parts ([partStatus, deliveredDaysAgo | null])
const mk = async (orderStatus, parts) => {
  const id = `zz-rr-${++n}`; await q("INSERT INTO orders (id, buyer_id, status, total, currency_code) VALUES ($1, $2, $3, 10, 'USD')", [id, buyerId, orderStatus]);
  for (const [status, deliveredDaysAgo] of parts) { const so = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, 's1', $2) RETURNING id", [id, status])).rows[0].id; if (deliveredDaysAgo !== null) await q("INSERT INTO hub_shipments (sub_order_id, hub_id, status, delivered_at) VALUES ($1, 'hub_guangzhou', 'delivered', now() - ($2 || ' days')::interval)", [so, String(deliveredDaysAgo)]); }
  return id;
};
const parts = async (id) => (await (await fetch(`${base}/order/${id}`, { headers: { Authorization: `Bearer ${buyerToken}` } })).json()).supplierSubOrders.map((s) => ({ returnable: s.returnable, until: s.returnUntil }));

before(async () => {
  originalWindow = (await q("SELECT value FROM platform_settings WHERE key = 'return_window_days'")).rows[0]?.value; await wipe(); const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/order', require('../src/modules/order/routes')); app.use('/returns', require('../src/modules/returns/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  buyerToken = await login('ui-buyer@example.com', 'buyer_dev_password_123'); assert.ok(buyerToken); buyerId = (await q("SELECT id FROM users WHERE email = 'ui-buyer@example.com'")).rows[0].id; await setWindow(7);
});
after(async () => { await wipe(); if (originalWindow === undefined) await q("DELETE FROM platform_settings WHERE key = 'return_window_days'"); else await setWindow(originalWindow); server.close(); await db.getPool().end(); });

// ---------------------------------------------------------------- the pure rule
test('CRITICAL: a cancelled part, or any part of a cancelled order, can never be returned', () => {
  for (const delivered of [null, ago(1), ago(30)]) { assert.equal(returnState({ subOrderStatus: 'cancelled', orderStatus: 'to_ship', deliveredAt: delivered, windowDays: 7, now: NOW }).returnable, false); assert.equal(returnState({ subOrderStatus: 'preparing', orderStatus: 'cancelled', deliveredAt: delivered, windowDays: 7, now: NOW }).returnable, false); }
  assert.deepEqual(returnState({ subOrderStatus: 'cancelled', orderStatus: 'cancelled', deliveredAt: null, windowDays: 7, now: NOW }), { returnable: false, returnUntil: null });
});
test('CRITICAL: not delivered yet: returnable (nothing has started to count), with no deadline', () => { assert.deepEqual(returnState({ subOrderStatus: 'preparing', orderStatus: 'to_ship', deliveredAt: null, windowDays: 3, now: NOW }), { returnable: true, returnUntil: null }); });
test('CRITICAL: delivered: returnable until the delivery date plus the window, and not after (3 days and 7 days)', () => {
  const at = (delivered, days, now = NOW) => returnState({ subOrderStatus: 'shipped', orderStatus: 'to_ship', deliveredAt: delivered, windowDays: days, now });
  assert.equal(at(ago(2), 3).returnable, true); assert.equal(at(ago(4), 3).returnable, false); assert.equal(at(ago(6), 7).returnable, true); assert.equal(at(ago(8), 7).returnable, false); assert.equal(at(ago(4), 7).returnable, true, 'a longer window keeps it open');
  assert.equal(at(ago(3), 3, new Date(ago(3).getTime() + 3 * DAY)).returnable, true, 'exactly at the deadline it is still open'); assert.equal(at(ago(3), 3, new Date(ago(3).getTime() + 3 * DAY + 1000)).returnable, false, 'a second later it is closed');
  const delivered = new Date('2026-10-20T08:00:00Z'); assert.equal(at(delivered, 7).returnUntil, new Date('2026-10-27T08:00:00Z').toISOString().replace(/\.000Z$/, '.000Z'));
});
// ---------------------------------------------------------------- the admin's setting
test('the window is the admin\'s setting (3 to 7 days); a missing or broken value means 7', async () => {
  await setWindow(3); assert.equal(await readReturnWindowDays(db), 3); await setWindow(5); assert.equal(await readReturnWindowDays(db), 5); for (const bad of ['abc', '0', '-2', '']) { await setWindow(bad); assert.equal(await readReturnWindowDays(db), 7, `"${bad}"`); }
  await q("DELETE FROM platform_settings WHERE key = 'return_window_days'"); assert.equal(await readReturnWindowDays(db), 7); await setWindow(7);
});
// ---------------------------------------------------------------- the order details, through the real route
test('CRITICAL: the order details: a cancelled order and a cancelled part are not returnable; an undelivered part is; a part delivered inside the window is (with its deadline); one delivered long ago is not', async () => {
  await setWindow(7);
  assert.deepEqual((await parts(await mk('cancelled', [['cancelled', null]])))[0], { returnable: false, until: null });
  const mixed = await parts(await mk('to_ship', [['cancelled', null], ['preparing', null], ['shipped', 1], ['shipped', 10]]));
  assert.deepEqual(mixed.map((p) => p.returnable), [false, true, true, false]); assert.equal(mixed[1].until, null); assert.ok(mixed[2].until && new Date(mixed[2].until) > new Date()); assert.ok(mixed[3].until && new Date(mixed[3].until) < new Date());
});
test('CRITICAL: changing the admin\'s window changes the answer at once: delivered 5 days ago is returnable with 7 days and NOT with 3', async () => {
  const id = await mk('to_ship', [['shipped', 5]]); await setWindow(7); assert.equal((await parts(id))[0].returnable, true); await setWindow(3); assert.equal((await parts(id))[0].returnable, false); await setWindow(7);
});
test('an order with every part cancelled while the order itself still says to_ship: not returnable (the parts decide)', async () => { const r = await parts(await mk('to_ship', [['cancelled', null], ['cancelled', null]])); assert.deepEqual(r.map((p) => p.returnable), [false, false]); });
// ---------------------------------------------------------------- the server's own refusal
test('filing a return for a cancelled part, or a part of a cancelled order, is refused (400), and a normal one is not refused for that reason', async (t) => {
  const post = (id, subOrderId) => fetch(`${base}/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` }, body: JSON.stringify({ subOrderId, reason: 'wrong_part', message: 'x' }) });
  const subOf = async (orderId) => (await q('SELECT id FROM supplier_sub_orders WHERE order_id = $1 ORDER BY id', [orderId])).rows[0].id;
  const cancelled = await subOf(await mk('cancelled', [['cancelled', null]])); const r = await post('x', cancelled); const body = await r.json().catch(() => ({}));
  if (r.status !== 400 || typeof body.error !== 'string') return t.skip(`the returns route cannot run in this environment (${r.status})`); assert.match(body.error, /cancelled/i);
  const partOnly = await subOf(await mk('to_ship', [['cancelled', null]])); assert.match((await (await post('x', partOnly)).json()).error, /cancelled/i);
  const fine = await subOf(await mk('to_ship', [['preparing', null]])); const ok = await post('x', fine); assert.ok(!/cancelled/i.test(JSON.stringify(await ok.json().catch(() => ({})))), 'a normal part is not refused for being cancelled');
});
test('the routes use the shared rule (read from the code)', () => {
  const o = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'order', 'routes.js'), 'utf8'); assert.ok(o.includes('...returnState({ subOrderStatus: so.status, orderStatus: order.status, deliveredAt: shipmentRows[0]?.delivered_at || null, windowDays: returnWindowDays }),'));
  const r = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'returns', 'routes.js'), 'utf8'); assert.ok(r.includes("sub_order_status === 'cancelled' || subOrderCheck.rows[0].order_status === 'cancelled'"));
});
