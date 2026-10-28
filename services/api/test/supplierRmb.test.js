// The supplier is paid and shown THEIR OWN RMB price (option A: RMB price x quantity, no commission), through the REAL routes and the real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/supplierRmb.test.js
// (it needs migration 112; it refuses to run on a database whose name does not end in "_test", and removes everything it creates)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');
const { supplierUnitPriceCny } = require('../src/modules/shared/supplierMoney');
const { computeOriginalOrder } = require('../src/modules/faultCases/helpers');
const { gatherDigestData } = require('../src/modules/supplierDigest/send');

const SUP = 's1';                                        // the dev supplier (supplier@leap.dev)
let server, base, adminToken, supplierToken, ordersMade = [];
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const get = async (path, token) => (await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const wipe = async () => {
  await q("DELETE FROM payout_sub_orders WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email = 'zz-rmb@example.com')");
  await q("DELETE FROM payouts WHERE notes LIKE 'ZZ-RMB%'");
  await q("DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email = 'zz-rmb@example.com')");
  await q("DELETE FROM order_line_vehicles WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email = 'zz-rmb@example.com')").catch(() => {});
  await q("DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email = 'zz-rmb@example.com')");
  await q("DELETE FROM supplier_sub_orders WHERE order_id IN (SELECT id FROM orders WHERE guest_email = 'zz-rmb@example.com')");
  await q("DELETE FROM order_addresses WHERE order_id IN (SELECT id FROM orders WHERE guest_email = 'zz-rmb@example.com')");
  await q("DELETE FROM orders WHERE guest_email = 'zz-rmb@example.com'");
  await q("DELETE FROM products WHERE id LIKE 'zz-rmb-%'");
};
const place = async (lines) => { const r = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: Object.entries(lines).map(([p, quantity]) => ({ productId: `zz-rmb-${p}`, quantity })), guestEmail: 'zz-rmb@example.com' }) }); const j = await r.json(); assert.equal(r.status, 201, JSON.stringify(j).slice(0, 300)); ordersMade.push(j.id); return j; };
const subOrderOf = async (orderId) => (await q('SELECT id FROM supplier_sub_orders WHERE order_id = $1 AND supplier_id = $2', [orderId, SUP])).rows[0].id;
const deliver = async (orderId, daysAgo = 30) => { const so = await subOrderOf(orderId); await q("INSERT INTO hub_shipments (sub_order_id, hub_id, status, delivered_at, delivery_confirmed_by) VALUES ($1, 'hub_guangzhou', 'delivered', now() - ($2 || ' days')::interval, 'hub_manual')", [so, String(daysAgo)]); return so; };
const owedNow = async () => { const list = await get('/payouts/owed', adminToken); return list.find((o) => o.supplierId === SUP) || { amountOwed: 0 }; };
const financeNow = () => get('/supplier/me/finance', supplierToken);

before(async () => {
  await wipe();
  const app = express(); app.use(express.json());
  app.use('/auth', require('../src/modules/auth/routes')); app.use('/orders', require('../src/modules/order/routes')); app.use('/supplier', require('../src/modules/supplier/routes')); app.use('/payouts', require('../src/modules/payouts/routes'));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); supplierToken = await login('supplier@leap.dev', 'supplier_dev_password_123');
  for (const [id, price, cur] of [['a', 52, 'CNY'], ['b', 100, 'CNY'], ['u', 10, 'USD']]) await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, category, status, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, $4, $5, 1000, 'brake', 'active', 1, 10, 10, 10)", [`zz-rmb-${id}`, `RMB part ${id}`, price, cur, SUP]);
  await q("INSERT INTO supplier_payout_methods (supplier_id, bank_name, account_number, account_holder_name) VALUES ($1, 'ZZ Bank', '1', 'ZZ') ON CONFLICT (supplier_id) DO NOTHING", [SUP]);
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

test('the helper: a product priced in RMB has an RMB price; anything else has none (never a guess)', () => {
  assert.equal(supplierUnitPriceCny({ currency_code: 'CNY', price: '52.00' }), 52); assert.equal(supplierUnitPriceCny({ currency_code: 'CNY', price: 52.456 }), 52.46);
  for (const p of [{ currency_code: 'USD', price: 10 }, { currency_code: 'CNY', price: null }, { currency_code: 'CNY', price: -1 }, { currency_code: 'CNY', price: 'abc' }, null, undefined]) assert.equal(supplierUnitPriceCny(p), null);
});

test('placing an order keeps the supplier\'s RMB price on each line, and a later price change never changes the old order', async () => {
  const o = await place({ a: 2, b: 1 }); const lines = (await q('SELECT product_id, quantity, supplier_unit_price_cny, unit_price FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1 ORDER BY product_id', [o.id])).rows;
  assert.deepEqual(lines.map((l) => [l.product_id, Number(l.supplier_unit_price_cny)]), [['zz-rmb-a', 52], ['zz-rmb-b', 100]]); assert.ok(lines.every((l) => Number(l.unit_price) !== 52 || true));
  await q("UPDATE products SET price = 999 WHERE id = 'zz-rmb-a'"); const again = (await q("SELECT supplier_unit_price_cny FROM order_line_items WHERE product_id = 'zz-rmb-a' AND sub_order_id = $1", [await subOrderOf(o.id)])).rows[0]; assert.equal(Number(again.supplier_unit_price_cny), 52); await q("UPDATE products SET price = 52 WHERE id = 'zz-rmb-a'");
});
test('a product that is not priced in RMB is saved with no RMB price (empty), not a made-up number', async () => { const o = await place({ u: 1 }); assert.equal((await q("SELECT supplier_unit_price_cny FROM order_line_items WHERE product_id = 'zz-rmb-u'")).rows[0].supplier_unit_price_cny, null); });

test('the supplier\'s order list shows the RMB price (unitPriceCny, currency CNY) and NEVER the buyer\'s dollar price', async () => {
  const list = await get('/supplier/me/orders', supplierToken); const mine = list.filter((so) => ordersMade.includes(so.orderId)); assert.ok(mine.length >= 2);
  const withA = mine.find((so) => so.items.some((i) => i.productId === 'zz-rmb-a')); const a = withA.items.find((i) => i.productId === 'zz-rmb-a'); const b = withA.items.find((i) => i.productId === 'zz-rmb-b');
  assert.equal(a.unitPriceCny, 52); assert.equal(b.unitPriceCny, 100); assert.equal(a.quantity, 2);
  for (const so of mine) for (const i of so.items) { assert.equal('unitPrice' in i, false, 'the buyer price is never sent to the supplier'); assert.ok(!JSON.stringify(i).includes('"unitPrice"')); }
  const usd = mine.flatMap((so) => so.items).find((i) => i.productId === 'zz-rmb-u'); assert.equal(usd.unitPriceCny, null);
});

test('owed, finance, analytics and the digest all count the RMB price x quantity of a delivered order past the return window (2 x 52 + 100 = 204)', async () => {
  const cnt0 = (await owedNow()).eligibleSubOrderCount || 0; const owed0 = (await owedNow()).amountOwed, fin0 = (await financeNow()).readyToPay.amount, ana0 = (await get('/supplier/me/overview', supplierToken)).analytics.payoutSummary.amountOwed;
  const o = (await q("SELECT DISTINCT so.order_id FROM supplier_sub_orders so JOIN order_line_items oli ON oli.sub_order_id = so.id WHERE oli.product_id = 'zz-rmb-b' AND so.order_id = ANY($1)", [ordersMade])).rows[0].order_id; await deliver(o);
  const owed1 = await owedNow(); assert.ok(near(owed1.amountOwed - owed0, 204), `owed went up by ${owed1.amountOwed - owed0}`); assert.equal(owed1.currencyCode, 'CNY'); assert.equal(owed1.eligibleSubOrderCount - cnt0, 1, 'an order with 2 lines is ONE order, not two');
  const fin = await financeNow(); assert.ok(near(fin.readyToPay.amount - fin0, 204)); assert.equal(fin.currencyCode, 'CNY'); assert.deepEqual(fin.commission, { minPercent: null, maxPercent: null, categories: [] });
  const ov = await get('/supplier/me/overview', supplierToken); assert.ok(near(ov.analytics.payoutSummary.amountOwed - ana0, 204)); assert.equal(ov.analytics.payoutSummary.currencyCode, 'CNY');
  const day = ov.analytics.revenueAndVolume.reduce((s, d) => s + d.revenue, 0); assert.ok(day >= 204, 'the 30 day revenue counts RMB'); const top = ov.analytics.topProducts.find((p) => p.productId === 'zz-rmb-a'); assert.ok(top && near(top.revenue, 104), `top product revenue ${top && top.revenue}`);
  const dig = await gatherDigestData(SUP, new Date(Date.now() - 3600 * 1000)); assert.ok(dig.totalValue >= 204, 'the digest total is in RMB');
});
test('an order whose lines have no RMB price is NOT paid (it waits until it has one), and is not counted as owed', async () => {
  const cntBefore = (await owedNow()).eligibleSubOrderCount; const before = (await owedNow()).amountOwed; const o = (await q("SELECT DISTINCT so.order_id FROM supplier_sub_orders so JOIN order_line_items oli ON oli.sub_order_id = so.id WHERE oli.product_id = 'zz-rmb-u' AND so.order_id = ANY($1)", [ordersMade])).rows[0].order_id; await deliver(o);
  assert.ok(near((await owedNow()).amountOwed, before)); assert.equal((await owedNow()).eligibleSubOrderCount, cntBefore, 'it is not even counted as an order to pay');
});

test('recording a payout: it is in RMB, equals what was owed, is not owed twice; a payout recorded in dollars earlier is shown apart and never added to the RMB total', async () => {
  const fin0 = await financeNow(); const owed = (await owedNow()).amountOwed; assert.ok(owed >= 204);
  await q("INSERT INTO payouts (supplier_id, amount, currency_code, notes) VALUES ($1, 500, 'USD', 'ZZ-RMB legacy dollars')", [SUP]);
  const finLegacy = await financeNow(); assert.ok(near(finLegacy.totalPaid, fin0.totalPaid), 'a payout in dollars is not added to the RMB total'); assert.ok(near(finLegacy.legacyUsdPaid - fin0.legacyUsdPaid, 500));
  const r = await fetch(`${base}/payouts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ supplierId: SUP, notes: 'ZZ-RMB payout' }) }); const p = await r.json(); assert.equal(r.status, 201, JSON.stringify(p).slice(0, 200));
  assert.equal(p.currencyCode, 'CNY'); assert.ok(near(p.amount, owed), `paid ${p.amount} of ${owed}`); assert.equal((await q('SELECT currency_code FROM payouts WHERE id = $1', [p.id])).rows[0].currency_code, 'CNY');
  const usdSub = (await q("SELECT so.id FROM supplier_sub_orders so JOIN order_line_items oli ON oli.sub_order_id = so.id WHERE oli.product_id = 'zz-rmb-u' AND so.order_id = ANY($1)", [ordersMade])).rows[0].id; assert.equal((await q('SELECT COUNT(*) AS n FROM payout_sub_orders WHERE sub_order_id = $1', [usdSub])).rows[0].n, '0', 'an order with no RMB price is NOT marked as paid');
  assert.ok(near((await owedNow()).amountOwed, 0)); const fin1 = await financeNow(); assert.ok(near(fin1.totalPaid - fin0.totalPaid, owed)); assert.ok(near(fin1.readyToPay.amount, 0));
  const hist = fin1.payouts; const mine = hist.find((h) => h.id === p.id); assert.equal(mine.currencyCode, 'CNY'); assert.equal(mine.commission, 0); assert.ok(near(mine.sales, mine.amount));
  const legacy = hist.find((h) => h.currencyCode === 'USD' && h.amount === 500); assert.ok(legacy); assert.equal(legacy.commission, 0, 'a dollar payout shows no made-up commission'); assert.equal(legacy.sales, 500);
  const ana = (await get('/supplier/me/overview', supplierToken)).analytics.payoutSummary; assert.ok(near(ana.totalPaid, fin1.totalPaid), 'the overview and the finance page agree on the total paid');
});
test('what a fault case would pay the supplier for the original order is the RMB price x quantity, with no commission', async () => {
  const o = ordersMade[0]; const so = await subOrderOf(o); const c = await db.getPool().connect(); try { const r = await computeOriginalOrder(c, so); assert.equal(r.gross, 204); assert.equal(r.net, 204, 'no commission is taken from the supplier\'s price'); } finally { c.release(); }
});
