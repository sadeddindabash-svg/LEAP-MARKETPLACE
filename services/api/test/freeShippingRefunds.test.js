// The refund SUGGESTED for a faulty part is worked out from what the buyer paid for the GOODS, never a share of the shipping fee. Real orders are placed through the real POST /orders; the real helper reads them back.
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/freeShippingRefunds.test.js
// (needs migrations 110-111 and patch-free-shipping-refunds.js; it refuses to run on a database whose name does not end in "_test"; everything it creates has an id starting "zz-fr".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { computeRefundSuggestion } = require('../src/modules/faultCases/helpers');
const { SETTING_KEY } = require('../src/modules/shared/freeShipping');

let server, base, saved; const q = (sql, params) => db.query(sql, params);
const wipe = async () => {
  await q("DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email LIKE 'zz-fr-%')");
  await q("DELETE FROM supplier_sub_orders WHERE order_id IN (SELECT id FROM orders WHERE guest_email LIKE 'zz-fr-%')");
  await q("DELETE FROM promo_code_redemptions WHERE promo_code LIKE 'ZZFR%'").catch(() => {}); await q("DELETE FROM orders WHERE guest_email LIKE 'zz-fr-%'");
  await q("DELETE FROM promo_codes WHERE code LIKE 'ZZFR%'"); await q("DELETE FROM products WHERE id LIKE 'zz-fr-%'"); await q("DELETE FROM suppliers WHERE id LIKE 'zz-fr-%'");
};
before(async () => {
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0'); await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false'); await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  saved = (await q('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY])).rows[0] || null; await wipe();
  await q("INSERT INTO suppliers (id, name) VALUES ('zz-fr-s', 'FR Supplier')");
  for (const [id, price] of [['a', 20], ['b', 50], ['c', 60]]) await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity) VALUES ($1, $2, $3, 'USD', 'zz-fr-s', 1000)", [`zz-fr-${id}`, `FR part ${id}`, price]);
  await q("INSERT INTO promo_codes (code, type, value, source, is_active, max_uses_per_buyer) VALUES ('ZZFR20', 'percentage', 20, 'admin', true, 100)");
  await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [SETTING_KEY, JSON.stringify({ enabled: true, thresholdUsd: 50, feeUsd: 5 })]);
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
});
after(async () => { await wipe(); if (saved) await q("UPDATE platform_settings SET value = $2 WHERE key = $1", [SETTING_KEY, saved.value]); else await q('DELETE FROM platform_settings WHERE key = $1', [SETTING_KEY]); server.close(); await db.getPool().end(); });

async function place(lines, extra = {}) {
  const body = { items: Object.entries(lines).map(([p, quantity]) => ({ productId: `zz-fr-${p}`, quantity })), guestEmail: 'zz-fr-guest@example.com', ...extra };
  const r = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await r.json(); assert.equal(r.status, 201, JSON.stringify(json).slice(0, 200)); return json;
}
const suggestion = async (orderId, items) => { const sub = (await q('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [orderId])).rows[0]; return computeRefundSuggestion(db, { sub_order_id: sub.id }, items); };

test('an order with a shipping fee: the suggested refund for its goods is the price of the goods, WITHOUT a share of the fee', async () => {
  const o = await place({ a: 1 }); assert.equal(o.total, 25);
  const s = await suggestion(o.id, [{ unitPrice: 20, quantity: 1 }]); assert.equal(s.suggested, 20); assert.equal(s.discountShare, 0); assert.equal(s.orderedValue, 20);
});
test('with a discount and a fee: only the goods paid count (60 less 12 = 48), not the 53 charged', async () => {
  const o = await place({ c: 1 }, { promoCode: 'ZZFR20' }); assert.equal(o.total, 53);
  const s = await suggestion(o.id, [{ unitPrice: 60, quantity: 1 }]); assert.equal(s.suggested, 48); assert.equal(s.discountShare, 12);
});
test('an order with no fee is exactly as before: the whole value of the part', async () => {
  const o = await place({ b: 1 }); assert.equal(o.total, 50);
  const s = await suggestion(o.id, [{ unitPrice: 50, quantity: 1 }]); assert.equal(s.suggested, 50);
});
