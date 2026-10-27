// Free shipping above a limit, through the REAL routes and the real database: the rule on its own, the admin settings (/platform-settings/free-shipping), the real cart (/cart/:id) and real orders (POST /orders).
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/freeShipping.test.js
// (it needs migration 111; it refuses to run on a database whose name does not end in "_test", and puts back what it changes; everything it creates has an id starting "zz-fs".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');                       // installs the stand-ins for project files a working copy may not have
const express = require('express');
const { computeShipping, parseStored, SETTING_KEY } = require('../src/modules/shared/freeShipping');
// A spy on the order confirmation email, installed BEFORE the order route is loaded (the route takes the function when it loads).
const templates = require('../src/modules/email/templates'); const emailCalls = []; const realConfirmation = templates.orderConfirmationEmail;
templates.orderConfirmationEmail = (args) => { emailCalls.push(args); return realConfirmation(args); };

let server, base, adminToken, supplierToken, saved;
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const settings = (method, body, token = adminToken, url = '') => fetch(`${base}/platform-settings/free-shipping${url}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const set = (enabled, thresholdUsd, feeUsd) => q("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [SETTING_KEY, JSON.stringify({ enabled, thresholdUsd, feeUsd })]);
const wipe = async () => {
  await q("DELETE FROM order_line_items WHERE sub_order_id IN (SELECT so.id FROM supplier_sub_orders so JOIN orders o ON o.id = so.order_id WHERE o.guest_email LIKE 'zz-fs-%')");
  await q("DELETE FROM supplier_sub_orders WHERE order_id IN (SELECT id FROM orders WHERE guest_email LIKE 'zz-fs-%')");
  await q("DELETE FROM promo_code_redemptions WHERE promo_code LIKE 'ZZFS%'").catch(() => {});
  await q("DELETE FROM order_addresses WHERE order_id IN (SELECT id FROM orders WHERE guest_email LIKE 'zz-fs-%')");
  await q("DELETE FROM orders WHERE guest_email LIKE 'zz-fs-%'");
  await q("DELETE FROM cart_items WHERE cart_id LIKE 'zz-fs-%'"); await q("DELETE FROM carts WHERE id LIKE 'zz-fs-%'");
  await q("DELETE FROM promo_codes WHERE code LIKE 'ZZFS%'"); await q("DELETE FROM products WHERE id LIKE 'zz-fs-%'"); await q("DELETE FROM suppliers WHERE id LIKE 'zz-fs-%'");
  await q("DELETE FROM admin_audit_log WHERE action = 'free_shipping_changed'");
};
before(async () => {
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0');
  // columns that the project's later migrations add to the cart tables (not in every working copy); harmless where they already exist
  await q('ALTER TABLE carts ADD COLUMN IF NOT EXISTS applied_promo_code TEXT'); await q('ALTER TABLE carts ADD COLUMN IF NOT EXISTS checkout_locked_at TIMESTAMPTZ'); await q('ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS locked_price NUMERIC');
  await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false'); await q('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT');
  for (const c of ['state', 'national_address', 'source', 'postal_code']) await q(`ALTER TABLE order_addresses ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  saved = (await q('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY])).rows[0] || null; await wipe();
  await q("INSERT INTO suppliers (id, name) VALUES ('zz-fs-s1', 'FS Supplier')");
  for (const [id, price] of [['a', 20], ['b', 50], ['c', 60], ['d', 100]]) await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity) VALUES ($1, $2, $3, 'USD', 'zz-fs-s1', 1000)", [`zz-fs-${id}`, `FS part ${id}`, price]);
  await q("INSERT INTO promo_codes (code, type, value, source, is_active, max_uses_per_buyer) VALUES ('ZZFS20', 'percentage', 20, 'admin', true, 100), ('ZZFSSHIP', 'free_shipping', NULL, 'admin', true, 100)");
  const app = express(); app.use(express.json());
  app.use('/auth', require('../src/modules/auth/routes')); app.use('/orders', require('../src/modules/order/routes')); app.use('/platform-settings', require('../src/modules/platform-settings/routes')); app.use('/cart', require('../src/modules/cart/routes'));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  server = app.listen(0); base = `http://localhost:${server.address().port}`;
  adminToken = await login('admin@leap.dev', 'admin_dev_password_123'); supplierToken = await login('supplier@leap.dev', 'supplier_dev_password_123');
});
after(async () => {
  await wipe(); if (saved) await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [SETTING_KEY, saved.value]); else await q('DELETE FROM platform_settings WHERE key = $1', [SETTING_KEY]);
  server.close(); await db.getPool().end();
});
beforeEach(async () => { await set(true, 50, 5); });

const on = { enabled: true, thresholdUsd: 50, feeUsd: 5 };
test('the rule (pure): under the limit pays the fee, at or over it is free, measured on the goods AFTER the discount', () => {
  const s = (over) => computeShipping({ settings: on, itemsUsd: 20, ...over });
  assert.deepEqual(s({}), { enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false });
  assert.equal(s({ itemsUsd: 49.99 }).chargedUsd, 5); assert.equal(s({ itemsUsd: 49.99 }).remainingUsd, 0.01);
  for (const items of [50, 50.01, 500]) { const r = s({ itemsUsd: items }); assert.equal(r.chargedUsd, 0); assert.equal(r.remainingUsd, 0); assert.equal(r.qualifies, true); }
  assert.equal(s({ itemsUsd: 60, discountUsd: 12 }).chargedUsd, 5, '60 - 12 = 48 is under 50'); assert.equal(s({ itemsUsd: 60, discountUsd: 10 }).chargedUsd, 0, '60 - 10 = 50 reaches it');
  assert.equal(s({ itemsUsd: 10, discountUsd: 99 }).remainingUsd, 50, 'a discount larger than the goods leaves 0 of goods, never a negative'); assert.equal(s({ itemsUsd: 10, discountUsd: 99 }).chargedUsd, 5);
});
test('the rule (pure): off, an empty basket and a free-shipping promo code charge nothing', () => {
  for (const off of [{ enabled: false, thresholdUsd: 50, feeUsd: 5 }, { enabled: true, thresholdUsd: 0, feeUsd: 5 }, { enabled: true, thresholdUsd: 50, feeUsd: 0 }, null]) { const r = computeShipping({ settings: off, itemsUsd: 5 }); assert.equal(r.enabled, false); assert.equal(r.chargedUsd, 0); assert.equal(r.qualifies, true); }
  const empty = computeShipping({ settings: on, itemsUsd: 0, hasItems: false }); assert.equal(empty.chargedUsd, 0); assert.equal(empty.remainingUsd, 50);
  const promo = computeShipping({ settings: on, itemsUsd: 20, freeShippingPromo: true }); assert.equal(promo.chargedUsd, 0); assert.equal(promo.waivedByPromo, true); assert.equal(promo.remainingUsd, 30, 'the hint still says how far the limit is');
});
test('what is stored: anything missing or damaged means "off"; amounts are cleaned', () => {
  for (const raw of [undefined, '', 'not json', '[]', '"x"', 'null', '{}']) assert.deepEqual(parseStored(raw), { enabled: false, thresholdUsd: 0, feeUsd: 0 });
  assert.deepEqual(parseStored(JSON.stringify({ enabled: true, thresholdUsd: '50', feeUsd: 5.456 })), { enabled: true, thresholdUsd: 50, feeUsd: 5.46 });
  assert.deepEqual(parseStored(JSON.stringify({ enabled: 'yes', thresholdUsd: -5, feeUsd: 99999999 })), { enabled: false, thresholdUsd: 0, feeUsd: 0 });
});

test('settings: with nothing stored everyone reads "off"; the public answer is cached briefly', async () => {
  await q('DELETE FROM platform_settings WHERE key = $1', [SETTING_KEY]); const r = await fetch(`${base}/platform-settings/free-shipping`); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { enabled: false, thresholdUsd: 0, feeUsd: 0 }); assert.match(r.headers.get('cache-control'), /max-age=\d+/);
});
test('settings: only an admin may read the admin view or change anything', async () => {
  assert.equal((await settings('GET', undefined, null, '/admin')).status, 401); assert.equal((await settings('PUT', on, null)).status, 401);
  assert.equal((await settings('GET', undefined, supplierToken, '/admin')).status, 403); assert.equal((await settings('PUT', { enabled: false, thresholdUsd: 1, feeUsd: 1 }, supplierToken)).status, 403);
  const stored = JSON.parse((await q('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY])).rows[0].value); assert.deepEqual(stored, on, 'nothing was changed by the refused calls');
});
test('settings: every bad request is refused with a reason and changes nothing', async () => {
  const bad = async (body, re) => { const r = await settings('PUT', body); assert.equal(r.status, 400, JSON.stringify(body)); assert.match(r.body.error, re, JSON.stringify(body)); };
  await bad({ thresholdUsd: 50, feeUsd: 5 }, /on or off/); await bad({ enabled: 'true', thresholdUsd: 50, feeUsd: 5 }, /on or off/);
  await bad({ enabled: true, thresholdUsd: 'abc', feeUsd: 5 }, /limit must be a number/); await bad({ enabled: true, thresholdUsd: 50 }, /fee must be a number/); await bad({ enabled: true, thresholdUsd: null, feeUsd: 5 }, /limit must be a number/);
  await bad({ enabled: true, thresholdUsd: -1, feeUsd: 5 }, /cannot be negative/); await bad({ enabled: true, thresholdUsd: 50, feeUsd: -0.01 }, /cannot be negative/);
  await bad({ enabled: true, thresholdUsd: 100001, feeUsd: 5 }, /more than 100000/); await bad({ enabled: true, thresholdUsd: 50, feeUsd: 10001 }, /more than 10000/);
  await bad({ enabled: true, thresholdUsd: 50.123, feeUsd: 5 }, /two decimals/); await bad({ enabled: true, thresholdUsd: 50, feeUsd: 5.001 }, /two decimals/);
  await bad({ enabled: true, thresholdUsd: 0, feeUsd: 5 }, /limit above 0/); await bad({ enabled: true, thresholdUsd: 50, feeUsd: 0 }, /fee above 0/);
  assert.deepEqual(JSON.parse((await q('SELECT value FROM platform_settings WHERE key = $1', [SETTING_KEY])).rows[0].value), on);
});
test('settings: a good change is stored, read back by everyone, and recorded in the audit log with before and after', async () => {
  const r = await settings('PUT', { enabled: true, thresholdUsd: '75.5', feeUsd: 4.25 }); assert.equal(r.status, 200); assert.deepEqual({ ...r.body, limits: undefined }, { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25, limits: undefined });
  assert.deepEqual(await (await fetch(`${base}/platform-settings/free-shipping`)).json(), { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25 });
  const admin = await settings('GET', undefined, adminToken, '/admin'); assert.equal(admin.body.thresholdUsd, 75.5); assert.deepEqual(admin.body.limits, { maxThresholdUsd: 100000, maxFeeUsd: 10000 });
  const log = (await q("SELECT details FROM admin_audit_log WHERE action = 'free_shipping_changed' ORDER BY id DESC LIMIT 1")).rows[0]; assert.deepEqual(log.details.from, on); assert.deepEqual(log.details.to, { enabled: true, thresholdUsd: 75.5, feeUsd: 4.25 });
});
test('settings: switching it off keeps the amounts (and is allowed with them at 0)', async () => {
  const r = await settings('PUT', { enabled: false, thresholdUsd: 0, feeUsd: 0 }); assert.equal(r.status, 200); assert.equal(r.body.enabled, false);
  const keep = await settings('PUT', { enabled: false, thresholdUsd: 40, feeUsd: 3 }); assert.equal(keep.status, 200); assert.deepEqual(await (await fetch(`${base}/platform-settings/free-shipping`)).json(), { enabled: false, thresholdUsd: 40, feeUsd: 3 });
});

/** A cart with these parts (id -> quantity), optionally with a promo code applied. */
async function cart(name, lines, promo = null) { await q("INSERT INTO carts (id, applied_promo_code) VALUES ($1, $2)", [`zz-fs-${name}`, promo]); for (const [pid, qty] of Object.entries(lines)) await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)", [`zz-fs-${name}`, `zz-fs-${pid}`, qty]); return (await (await fetch(`${base}/cart/zz-fs-${name}`)).json()); }
test('the cart: under the limit it says the fee to pay and how much more is needed', async () => {
  const c = await cart('low', { a: 1 }); assert.deepEqual(c.shipping, { enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 30, qualifies: false, waivedByPromo: false });
});
test('the cart: at the limit and above it shipping is free', async () => {
  const at = await cart('at', { b: 1 }); assert.equal(at.shipping.chargedUsd, 0); assert.equal(at.shipping.qualifies, true); assert.equal(at.shipping.remainingUsd, 0);
  const over = await cart('over', { a: 2, c: 1 }); assert.equal(over.shipping.chargedUsd, 0);
});
test('the cart: the limit is measured AFTER a promo discount (60 with 20% off is 48: under the limit)', async () => {
  const c = await cart('promo', { c: 1 }, 'ZZFS20'); assert.equal(c.appliedDiscountUsd, 12); assert.equal(c.shipping.chargedUsd, 5); assert.equal(c.shipping.remainingUsd, 2);
});
test('the cart: a free-shipping promo code waives the fee, and the hint still shows the distance', async () => {
  const c = await cart('freeship', { a: 1 }, 'ZZFSSHIP'); assert.equal(c.shipping.chargedUsd, 0); assert.equal(c.shipping.waivedByPromo, true); assert.equal(c.shipping.remainingUsd, 30);
});
test('the cart: switched off, or nothing stored, there is no fee and nothing to show; an empty basket is charged nothing', async () => {
  await set(false, 50, 5); const off = await cart('off', { a: 1 }); assert.equal(off.shipping.enabled, false); assert.equal(off.shipping.chargedUsd, 0);
  await q('DELETE FROM platform_settings WHERE key = $1', [SETTING_KEY]); const none = await cart('none', { a: 1 }); assert.equal(none.shipping.enabled, false);
  await set(true, 50, 5); const empty = await cart('empty', {}); assert.equal(empty.shipping.chargedUsd, 0); assert.equal(empty.shipping.remainingUsd, 50);
});

async function place(lines, extra = {}) {
  const body = { items: Object.entries(lines).map(([p, quantity]) => ({ productId: `zz-fs-${p}`, quantity })), guestEmail: 'zz-fs-guest@example.com', ...extra };
  const r = await fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await r.json(); assert.equal(r.status, 201, JSON.stringify(json).slice(0, 300)); return json;
}
const row = async (id) => (await q('SELECT total, shipping_fee, discount_amount FROM orders WHERE id = $1', [id])).rows[0];
const detail = async (id) => (await fetch(`${base}/orders/${id}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
test('an order under the limit is charged the fee: in its total, in shipping_fee, and in what the buyer is told', async () => {
  const o = await place({ a: 1 }); assert.equal(o.subtotal, 20); assert.equal(o.shippingFee, 5); assert.equal(o.total, 25);
  const r = await row(o.id); assert.equal(Number(r.shipping_fee), 5); assert.equal(Number(r.total), 25);
  const d = await detail(o.id); assert.equal(d.shippingFee, 5); assert.equal(d.total, 25);
});
test('an order at or over the limit ships free: no fee, the total is just the goods', async () => {
  for (const lines of [{ b: 1 }, { c: 1 }, { a: 3 }]) { const o = await place(lines); assert.equal(o.shippingFee, 0); assert.equal(o.total, o.subtotal); assert.equal(Number((await row(o.id)).shipping_fee), 0); }
});
test('an order with the rule off, or never set up, has no fee at all (the shop works as it always did)', async () => {
  await set(false, 50, 5); const off = await place({ a: 1 }); assert.equal(off.shippingFee, 0); assert.equal(off.total, 20);
  await q('DELETE FROM platform_settings WHERE key = $1', [SETTING_KEY]); const none = await place({ a: 1 }); assert.equal(none.shippingFee, 0); assert.equal(none.total, 20);
});
test('the limit is measured on the goods AFTER a promo discount; a free-shipping code waives the fee', async () => {
  const p = await place({ c: 1 }, { promoCode: 'ZZFS20' }); assert.equal(p.discountAmount, 12); assert.equal(p.shippingFee, 5); assert.equal(p.total, 53, '60 - 12 + 5');
  const f = await place({ a: 1 }, { promoCode: 'ZZFSSHIP' }); assert.equal(f.shippingFee, 0); assert.equal(Number((await row(f.id)).shipping_fee), 0);
});
test('an order keeps the fee it was charged: changing the limit afterwards changes nothing already placed', async () => {
  const o = await place({ a: 1 }); await set(true, 10, 9); await settings('PUT', { enabled: false, thresholdUsd: 10, feeUsd: 9 });
  const r = await row(o.id); assert.equal(Number(r.shipping_fee), 5); assert.equal(Number(r.total), 25); assert.equal((await detail(o.id)).shippingFee, 5);
});
test('the fee is worked out on the server: nothing a client sends can change it', async () => {
  const o = await place({ a: 1 }, { shippingFee: 0, total: 20, shipping_fee: 0 }); assert.equal(o.shippingFee, 5); assert.equal(o.total, 25);
});

const haveReceiptAssets = ['leap-logo.png', 'noto-sans-arabic-regular.ttf', 'noto-sans-arabic-bold.ttf'].every((f) => require('fs').existsSync(require('path').join(__dirname, '../assets', f)));
test('the receipt (PDF) still draws, in English and in Arabic, with a shipping fee on it', { skip: !haveReceiptAssets && 'the receipt logo and fonts (services/api/assets) are not in this working copy' }, async () => {
  const o = await place({ a: 1 });
  for (const lang of ['en', 'ar']) {
    const r = await fetch(`${base}/orders/${o.id}/receipt?lang=${lang}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(r.status, 200, `receipt ${lang}`); assert.match(r.headers.get('content-type'), /pdf/); const buf = Buffer.from(await r.arrayBuffer()); assert.equal(buf.slice(0, 4).toString(), '%PDF');
  }
});

test('the confirmation email of an order with a fee is sent with the fee (the order route passes it on); with no fee it carries none', async () => {
  const withFee = await place({ a: 1 }); const free = await place({ b: 1 }); await new Promise((r) => setTimeout(r, 800));
  const a = emailCalls.find((c) => c.orderId === withFee.id); const b = emailCalls.find((c) => c.orderId === free.id);
  assert.ok(a, 'an email was prepared for the order with a fee'); assert.equal(a.shippingFee, 5); assert.equal(a.total, 25);
  assert.ok(b, 'an email was prepared for the free order'); assert.equal(b.shippingFee, 0); assert.equal(b.total, 50);
});
