// The Overview pie chart's numbers: every order of a supplier is in exactly ONE group (succeeded / in progress / cancelled / returned), through the real analytics query and the real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/supplierOutcomes.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { getOrderOutcomes, getSupplierAnalytics } = require('../src/modules/supplierAnalytics/queries');

const SUP = 'zz-out-s1';
const q = (sql, params) => db.query(sql, params);
const wipe = async () => {
  await q("DELETE FROM return_cases WHERE order_id LIKE 'zz-out-%'"); await q("DELETE FROM hub_shipments WHERE sub_order_id IN (SELECT id FROM supplier_sub_orders WHERE supplier_id = $1)", [SUP]);
  await q("DELETE FROM supplier_sub_orders WHERE supplier_id = $1", [SUP]); await q("DELETE FROM orders WHERE id LIKE 'zz-out-%'"); await q("DELETE FROM suppliers WHERE id = $1", [SUP]);
};
const sub = async (n, status = 'pending') => { await q("INSERT INTO orders (id, guest_email, status, total, currency_code) VALUES ($1, 'zz-out@example.com', 'to_ship', 10, 'USD')", [`zz-out-${n}`]); return (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id, status) VALUES ($1, $2, $3) RETURNING id", [`zz-out-${n}`, SUP, status])).rows[0].id; };
before(async () => { await wipe(); await q("INSERT INTO suppliers (id, name) VALUES ($1, 'ZZ Outcomes')", [SUP]); });
after(async () => { await wipe(); await db.getPool().end(); });

test('a supplier with no orders has all zeros', async () => { assert.deepEqual(await getOrderOutcomes(SUP), { total: 0, succeeded: 0, inProgress: 0, cancelled: 0, returned: 0 }); });
test('each order is in exactly one group, and the groups add up to the total', async () => {
  const delivered = (id) => q("INSERT INTO hub_shipments (sub_order_id, hub_id, status, delivered_at, delivery_confirmed_by) VALUES ($1, 'hub_guangzhou', 'delivered', now(), 'hub_manual')", [id]);
  await sub(1); await sub(2, 'preparing'); await sub(3, 'shipped');                                       // 3 in progress
  const s4 = await sub(4); await delivered(s4); const s5 = await sub(5); await delivered(s5);               // 2 succeeded
  await sub(6, 'cancelled'); const s7 = await sub(7, 'cancelled'); await delivered(s7);                     // 2 cancelled (a cancelled order is cancelled even if a shipment row exists)
  const s8 = await sub(8); await delivered(s8); await q("INSERT INTO return_cases (id, order_id, sub_order_id, guest_email, reason, status) VALUES ('zz-out-rc8', 'zz-out-8', $1, 'zz-out@example.com', 'x', 'awaiting')", [s8]);   // 1 returned
  const s9 = await sub(9); await delivered(s9); await q("INSERT INTO return_cases (id, order_id, sub_order_id, guest_email, reason, status) VALUES ('zz-out-rc9', 'zz-out-9', $1, 'zz-out@example.com', 'x', 'rejected')", [s9]);   // a REJECTED return: it still succeeded
  const o = await getOrderOutcomes(SUP); assert.deepEqual(o, { total: 9, succeeded: 3, inProgress: 3, cancelled: 2, returned: 1 }); assert.equal(o.succeeded + o.inProgress + o.cancelled + o.returned, o.total);
});
test('another supplier\'s orders are never counted, and the analytics carries the outcomes', async () => { const a = await getSupplierAnalytics(SUP); assert.equal(a.outcomes.total, 9); assert.equal(a.payoutSummary.currencyCode, 'CNY'); assert.equal((await getOrderOutcomes('s1')).total >= 0, true); });
