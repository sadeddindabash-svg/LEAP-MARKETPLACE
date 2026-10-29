// ONE CART PER ACCOUNT, through the real cart routes and the real database (needs migration 115):
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/accountCart.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');
const { signToken } = require('../src/modules/auth/middleware');
const { resolveCart } = require('../src/modules/cart/accountCart');

let server, base, U, V, tokenU, tokenV;
const q = (sql, params) => db.query(sql, params);
const call = async (method, p, token, body) => { const r = await fetch(`${base}${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = (id, token, query = '') => call('GET', `/cart/${id}${query}`, token);
const add = (id, productId, quantity, token) => call('POST', `/cart/${id}/items`, token, { productId, quantity });
const lines = (cart) => Object.fromEntries(cart.items.map((i) => [i.productId, i.quantity]));
const rowsOf = async (id) => Object.fromEntries((await q('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [id])).rows.map((r) => [r.product_id, r.quantity]));
let startedAt;
const wipe = async () => {
  const ids = [U?.id, V?.id].filter(Boolean);
  await q("DELETE FROM cart_items WHERE product_id LIKE 'zz-ac-%' OR cart_id LIKE 'zz-ac-%'"); await q("UPDATE carts SET merged_into = NULL WHERE id LIKE 'zz-ac-%' OR buyer_id = ANY($1) OR created_at >= $2", [ids, startedAt || new Date()]);
  await q("DELETE FROM carts WHERE id LIKE 'zz-ac-%' OR buyer_id = ANY($1) OR (created_at >= $2 AND id NOT IN (SELECT cart_id FROM cart_items))", [ids, startedAt || new Date()]); await q("DELETE FROM products WHERE id LIKE 'zz-ac-%'");
};
const product = (id, en, ar, stock) => q("INSERT INTO products (id, name, name_ar, price, currency_code, supplier_id, stock_quantity, category, status, oem_number) VALUES ($1, $2, $3, 10, 'USD', 's1', $4, 'brake', 'active', $5)", [id, en, ar, stock, `ZZ-AC-${id}`]);

before(async () => {
  startedAt = (await q('SELECT now() AS t')).rows[0].t; const buyers = (await q("SELECT id, email, role FROM users WHERE role = 'buyer' ORDER BY email LIMIT 2")).rows; assert.equal(buyers.length, 2, 'the test database needs two buyer accounts'); [U, V] = buyers; tokenU = signToken(U); tokenV = signToken(V);
  await wipe(); const app = express(); app.use(express.json()); app.use('/cart', require('../src/modules/cart/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
});
beforeEach(async () => { await wipe(); await product('zz-ac-p1', 'Brake Pad Set', 'طقم تيل فرامل', 5); await product('zz-ac-p2', 'Oil Filter', 'فلتر زيت', 2); await product('zz-ac-p3', 'Wiper Blade', 'شفرة مساحة', 9); await product('zz-ac-p4', 'Air Filter', 'فلتر هواء', 0); });
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

// ---------------------------------------------------------------- guests are unchanged
test('CRITICAL: a guest (not signed in) works exactly as before: the same cart id, add, change, remove', async () => {
  let r = await add('zz-ac-guest', 'zz-ac-p1', 2); assert.equal(r.status, 201); assert.equal(r.body.cartId, 'zz-ac-guest'); assert.deepEqual(lines(r.body), { 'zz-ac-p1': 2 }); assert.equal(r.body.merge, undefined);
  r = await call('PATCH', '/cart/zz-ac-guest/items/zz-ac-p1', null, { quantity: 3 }); assert.deepEqual(lines(r.body), { 'zz-ac-p1': 3 }); r = await call('DELETE', '/cart/zz-ac-guest/items/zz-ac-p1', null); assert.deepEqual(lines(r.body), {}); assert.equal((await get('zz-ac-guest')).body.cartId, 'zz-ac-guest');
});
// ---------------------------------------------------------------- signing in
test('CRITICAL: a buyer with no cart yet who signs in simply claims the device\'s cart: same id, items kept, no notice', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 2); const r = await get('zz-ac-phone', tokenU); assert.equal(r.body.cartId, 'zz-ac-phone'); assert.deepEqual(lines(r.body), { 'zz-ac-p1': 2 }); assert.equal(r.body.merge, undefined);
  assert.equal((await q("SELECT buyer_id FROM carts WHERE id = 'zz-ac-phone'")).rows[0].buyer_id, U.id);
});
test('CRITICAL: the second device\'s cart joins the account cart: the items are ADDED together, both devices then show the same cart, and ONE notice says what was combined', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 2, tokenU); await add('zz-ac-phone', 'zz-ac-p2', 1, tokenU); await add('zz-ac-web', 'zz-ac-p1', 1); await add('zz-ac-web', 'zz-ac-p3', 4);
  const joined = await get('zz-ac-web', tokenU); assert.equal(joined.body.cartId, 'zz-ac-phone', 'the website adopts the account cart\'s id'); assert.deepEqual(lines(joined.body), { 'zz-ac-p1': 3, 'zz-ac-p2': 1, 'zz-ac-p3': 4 });
  assert.deepEqual(joined.body.merge, { itemsAdded: 1, itemsCombined: 1, reduced: [], dropped: [] }); const phone = await get('zz-ac-phone', tokenU); assert.deepEqual(lines(phone.body), { 'zz-ac-p1': 3, 'zz-ac-p2': 1, 'zz-ac-p3': 4 }); assert.equal(phone.body.merge, undefined, 'the notice is shown once');
  assert.deepEqual(lines((await get('zz-ac-web', tokenU)).body), { 'zz-ac-p1': 3, 'zz-ac-p2': 1, 'zz-ac-p3': 4 }); assert.equal((await get('zz-ac-web', tokenU)).body.cartId, 'zz-ac-phone', 'the old id of the website still leads to the account cart');
  assert.deepEqual(await rowsOf('zz-ac-web'), {}, 'the combined cart is emptied'); assert.equal((await q("SELECT merged_into FROM carts WHERE id = 'zz-ac-web'")).rows[0].merged_into, 'zz-ac-phone');
});
test('CRITICAL: the combined quantity is lowered ONLY to the stock available, never below what the account cart already had; the notice says which line', async () => {
  await add('zz-ac-phone', 'zz-ac-p2', 1, tokenU); await add('zz-ac-web', 'zz-ac-p2', 2);      // oil filter: stock 2, 1 + 2 = 3
  const r = await get('zz-ac-web', tokenU); assert.deepEqual(lines(r.body), { 'zz-ac-p2': 2 }); assert.deepEqual(r.body.merge.reduced, [{ productId: 'zz-ac-p2', name: 'Oil Filter', from: 3, to: 2 }]);
  await q("UPDATE cart_items SET quantity = 5 WHERE cart_id = 'zz-ac-phone' AND product_id = 'zz-ac-p1'"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-phone', 'zz-ac-p1', 5) ON CONFLICT DO NOTHING");
  await q("UPDATE products SET stock_quantity = 3 WHERE id = 'zz-ac-p1'"); await add('zz-ac-web2', 'zz-ac-p1', 1); const r2 = await get('zz-ac-web2', tokenU); assert.equal(lines(r2.body)['zz-ac-p1'], 5, 'the account cart already had 5 (above the stock of 3): it is not reduced');
});
test('a line that would end with nothing (no stock) is dropped, and the notice says so; a line the account cart already has is left alone', async () => {
  await add('zz-ac-phone', 'zz-ac-p3', 1, tokenU); await q("INSERT INTO carts (id) VALUES ('zz-ac-web')"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-web', 'zz-ac-p4', 2), ('zz-ac-web', 'zz-ac-p3', 1) ON CONFLICT DO NOTHING");
  const r = await get('zz-ac-web', tokenU); assert.deepEqual(lines(r.body), { 'zz-ac-p3': 2 }); assert.deepEqual(r.body.merge.dropped, [{ productId: 'zz-ac-p4', name: 'Air Filter' }]); assert.deepEqual(r.body.merge.reduced, []);
});
test('the notice uses the Arabic product names in Arabic', async () => {
  await add('zz-ac-phone', 'zz-ac-p2', 1, tokenU); await add('zz-ac-web', 'zz-ac-p2', 2); const r = await get('zz-ac-web', tokenU, '?lang=ar'); assert.equal(r.body.merge.reduced[0].name, 'فلتر زيت'); assert.equal(r.body.items[0].name, 'فلتر زيت');
});
test('an empty cart joining the account cart gives no notice at all', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 1, tokenU); await q("INSERT INTO carts (id) VALUES ('zz-ac-empty')"); const r = await get('zz-ac-empty', tokenU); assert.equal(r.body.cartId, 'zz-ac-phone'); assert.equal(r.body.merge, undefined);
});
// ---------------------------------------------------------------- promo code and price lock
test('CRITICAL: the account cart\'s promo code is kept; the device\'s promo is taken only when the account cart has none', async () => {
  await q("INSERT INTO carts (id, buyer_id, applied_promo_code) VALUES ('zz-ac-a', $1, 'KEEPME')", [U.id]); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-a', 'zz-ac-p1', 1)"); await q("INSERT INTO carts (id, applied_promo_code) VALUES ('zz-ac-b', 'THEIRS')"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-b', 'zz-ac-p3', 1)");
  assert.equal((await resolveCart('zz-ac-b', U.id, 'en')).cartId, 'zz-ac-a'); assert.equal((await q("SELECT applied_promo_code FROM carts WHERE id = 'zz-ac-a'")).rows[0].applied_promo_code, 'KEEPME');
  await q("UPDATE carts SET applied_promo_code = NULL WHERE id = 'zz-ac-a'"); await q("INSERT INTO carts (id, applied_promo_code) VALUES ('zz-ac-c', 'ADOPTED')"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-c', 'zz-ac-p1', 1)"); await resolveCart('zz-ac-c', U.id, 'en'); assert.equal((await q("SELECT applied_promo_code FROM carts WHERE id = 'zz-ac-a'")).rows[0].applied_promo_code, 'ADOPTED');
});
test('the checkout price lock: the account cart\'s is kept; the device\'s is adopted only when the account cart was EMPTY (a lock must cover the whole cart)', async () => {
  await q("INSERT INTO carts (id, buyer_id) VALUES ('zz-ac-a', $1)", [U.id]); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-a', 'zz-ac-p1', 1)"); await q("INSERT INTO carts (id, checkout_locked_at) VALUES ('zz-ac-b', now())"); await q("INSERT INTO cart_items (cart_id, product_id, quantity, locked_price) VALUES ('zz-ac-b', 'zz-ac-p3', 1, 7.5)");
  await resolveCart('zz-ac-b', U.id, 'en'); assert.equal((await q("SELECT checkout_locked_at FROM carts WHERE id = 'zz-ac-a'")).rows[0].checkout_locked_at, null, 'a lock that covers only some lines is not adopted'); assert.equal((await q("SELECT locked_price FROM cart_items WHERE cart_id = 'zz-ac-a' AND product_id = 'zz-ac-p3'")).rows[0].locked_price, null);
  await q("DELETE FROM cart_items WHERE cart_id = 'zz-ac-a'"); await q("INSERT INTO carts (id, checkout_locked_at) VALUES ('zz-ac-c', now())"); await q("INSERT INTO cart_items (cart_id, product_id, quantity, locked_price) VALUES ('zz-ac-c', 'zz-ac-p3', 1, 7.5)"); await resolveCart('zz-ac-c', U.id, 'en');
  assert.notEqual((await q("SELECT checkout_locked_at FROM carts WHERE id = 'zz-ac-a'")).rows[0].checkout_locked_at, null, 'an empty account cart takes the whole locked cart'); assert.equal(Number((await q("SELECT locked_price FROM cart_items WHERE cart_id = 'zz-ac-a' AND product_id = 'zz-ac-p3'")).rows[0].locked_price), 7.5);
});
// ---------------------------------------------------------------- the carts that already exist
test('CRITICAL: a buyer who already has several carts (one per device, from before): the oldest is the account cart, the others are combined into it ONCE (nothing counted twice)', async () => {
  await q("INSERT INTO carts (id, buyer_id, created_at) VALUES ('zz-ac-old', $1, now() - interval '3 days'), ('zz-ac-mid', $1, now() - interval '2 days'), ('zz-ac-new', $1, now() - interval '1 day')", [U.id]);
  await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-ac-old', 'zz-ac-p1', 1), ('zz-ac-mid', 'zz-ac-p1', 2), ('zz-ac-mid', 'zz-ac-p3', 1), ('zz-ac-new', 'zz-ac-p3', 2)");
  const first = await get('zz-ac-new', tokenU); assert.equal(first.body.cartId, 'zz-ac-old'); assert.deepEqual(lines(first.body), { 'zz-ac-p1': 3, 'zz-ac-p3': 3 }); assert.ok(first.body.merge);
  for (let i = 0; i < 3; i += 1) { const again = await get(i % 2 ? 'zz-ac-mid' : 'zz-ac-old', tokenU); assert.deepEqual(lines(again.body), { 'zz-ac-p1': 3, 'zz-ac-p3': 3 }); assert.equal(again.body.merge, undefined); }
  assert.equal(Number((await q("SELECT count(*) AS n FROM carts WHERE buyer_id = $1 AND merged_into IS NULL", [U.id])).rows[0].n), 1);
});
test('two devices signing in at the same moment: one account cart, every item counted exactly once', async () => {
  await add('zz-ac-a', 'zz-ac-p1', 2); await add('zz-ac-b', 'zz-ac-p1', 1); await add('zz-ac-b', 'zz-ac-p3', 3);
  const [x, y] = await Promise.all([get('zz-ac-a', tokenU), get('zz-ac-b', tokenU)]); assert.equal(x.body.cartId, y.body.cartId); const final = await get(x.body.cartId, tokenU); assert.deepEqual(lines(final.body), { 'zz-ac-p1': 3, 'zz-ac-p3': 3 });
  assert.equal(Number((await q("SELECT count(*) AS n FROM carts WHERE buyer_id = $1 AND merged_into IS NULL", [U.id])).rows[0].n), 1); assert.equal(Number((await q("SELECT COALESCE(SUM(quantity), 0) AS n FROM cart_items WHERE cart_id IN ('zz-ac-a', 'zz-ac-b')")).rows[0].n), 6);
});
// ---------------------------------------------------------------- other accounts and signed-out devices
test('CRITICAL: another account never sees or takes the first account\'s cart, and the first account\'s cart is untouched', async () => {
  await add('zz-ac-shared', 'zz-ac-p1', 2, tokenU); const asV = await get('zz-ac-shared', tokenV); assert.notEqual(asV.body.cartId, 'zz-ac-shared'); assert.deepEqual(lines(asV.body), {}); assert.equal(asV.body.merge, undefined);
  await add(asV.body.cartId, 'zz-ac-p3', 1, tokenV); assert.deepEqual(await rowsOf('zz-ac-shared'), { 'zz-ac-p1': 2 }); assert.deepEqual(lines((await get('zz-ac-shared', tokenU)).body), { 'zz-ac-p1': 2 });
  assert.equal((await q("SELECT buyer_id FROM carts WHERE id = $1", [asV.body.cartId])).rows[0].buyer_id, V.id);
});
test('CRITICAL: a request that is NOT signed in never sees an account\'s cart (a signed-out device): it gets a fresh empty guest cart, and what it adds never reaches the account', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 2, tokenU); const out = await get('zz-ac-phone', null); assert.notEqual(out.body.cartId, 'zz-ac-phone'); assert.deepEqual(lines(out.body), {});
  const added = await add('zz-ac-phone', 'zz-ac-p3', 1, null); assert.notEqual(added.body.cartId, 'zz-ac-phone'); assert.deepEqual(await rowsOf('zz-ac-phone'), { 'zz-ac-p1': 2 }); const guestAgain = await get(added.body.cartId, null); assert.deepEqual(lines(guestAgain.body), { 'zz-ac-p3': 1 }, 'the fresh guest cart is a normal guest cart');
});
test('signing in again on that device brings the account cart back, and the signed-out guest items join it', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 2, tokenU); const guest = await add('zz-ac-phone', 'zz-ac-p3', 1, null); const back = await get(guest.body.cartId, tokenU); assert.equal(back.body.cartId, 'zz-ac-phone'); assert.deepEqual(lines(back.body), { 'zz-ac-p1': 2, 'zz-ac-p3': 1 });
});
// ---------------------------------------------------------------- changes go to the account cart, and after an order
test('adding, changing and removing through a device\'s OLD cart id changes the account cart (every device sees it)', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 1, tokenU); await add('zz-ac-web', 'zz-ac-p3', 1); await get('zz-ac-web', tokenU);
  let r = await add('zz-ac-web', 'zz-ac-p2', 1, tokenU); assert.equal(r.body.cartId, 'zz-ac-phone'); assert.deepEqual(lines((await get('zz-ac-phone', tokenU)).body), { 'zz-ac-p1': 1, 'zz-ac-p3': 1, 'zz-ac-p2': 1 });
  r = await call('PATCH', '/cart/zz-ac-web/items/zz-ac-p3', tokenU, { quantity: 4 }); assert.equal(lines(r.body)['zz-ac-p3'], 4); r = await call('DELETE', '/cart/zz-ac-web/items/zz-ac-p1', tokenU); assert.deepEqual(lines(r.body), { 'zz-ac-p3': 4, 'zz-ac-p2': 1 }); assert.deepEqual(lines((await get('zz-ac-phone', tokenU)).body), { 'zz-ac-p3': 4, 'zz-ac-p2': 1 });
});
test('CRITICAL: POST /cart/:id/clear (after an order) empties the cart, its promo code and its price lock, keeps the SAME cart, and every device shows it empty', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 2, tokenU); await q("UPDATE carts SET applied_promo_code = 'X', checkout_locked_at = now() WHERE id = 'zz-ac-phone'"); await add('zz-ac-web', 'zz-ac-p3', 1); await get('zz-ac-web', tokenU);
  const r = await call('POST', '/cart/zz-ac-web/clear', tokenU); assert.equal(r.status, 200); assert.equal(r.body.cartId, 'zz-ac-phone'); assert.deepEqual(lines(r.body), {}); const row = (await q("SELECT applied_promo_code, checkout_locked_at FROM carts WHERE id = 'zz-ac-phone'")).rows[0]; assert.equal(row.applied_promo_code, null); assert.equal(row.checkout_locked_at, null);
  assert.deepEqual(lines((await get('zz-ac-phone', tokenU)).body), {}); assert.deepEqual(lines((await get('zz-ac-web', tokenU)).body), {});
});
test('clearing a guest\'s own cart works; clearing never touches another account\'s cart', async () => {
  await add('zz-ac-guest', 'zz-ac-p1', 1); assert.deepEqual(lines((await call('POST', '/cart/zz-ac-guest/clear', null)).body), {}); await add('zz-ac-phone', 'zz-ac-p1', 2, tokenU);
  await call('POST', '/cart/zz-ac-phone/clear', tokenV); assert.deepEqual(await rowsOf('zz-ac-phone'), { 'zz-ac-p1': 2 }); await call('POST', '/cart/zz-ac-phone/clear', null); assert.deepEqual(await rowsOf('zz-ac-phone'), { 'zz-ac-p1': 2 });
});
test('the layer is wired in: the cart routes export the account cart router and getFullCart', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'cart', 'routes.js'), 'utf8'); assert.ok(s.includes("router.getFullCart = getFullCart;")); assert.ok(s.trimEnd().endsWith("module.exports = require('./accountCart').accountCartRouter(router);"));
});
test('a quote placed as an order puts its items into the ACCOUNT cart (the id the device sends may be a combined cart\'s old id): read from the code', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'quote-requests', 'routes.js'), 'utf8');
  assert.ok(s.includes("const { resolveCart } = require('../cart/accountCart');")); assert.ok(s.includes("const targetCartId = (await resolveCart(cartId, req.user.sub, 'en')).cartId;")); assert.ok(s.includes('[targetCartId, item.product_id, item.quantity]')); assert.ok(!s.includes('[cartId, item.product_id, item.quantity]'), 'no insert uses the id the device sent');
  assert.ok(s.indexOf("resolveCart(cartId, req.user.sub, 'en')") < s.indexOf("await client.query('BEGIN');"), 'resolved before the transaction starts');
});
test('the account cart resolver gives the same cart to a quote as to the cart routes (the id a device sends leads to the account cart)', async () => {
  await add('zz-ac-phone', 'zz-ac-p1', 1, tokenU); await add('zz-ac-web', 'zz-ac-p3', 1); await get('zz-ac-web', tokenU); assert.equal((await resolveCart('zz-ac-web', U.id, 'en')).cartId, 'zz-ac-phone'); assert.equal((await resolveCart('zz-ac-phone', U.id, 'en')).cartId, 'zz-ac-phone'); assert.equal((await resolveCart('zz-ac-fresh', U.id, 'en')).cartId, 'zz-ac-phone');
});
