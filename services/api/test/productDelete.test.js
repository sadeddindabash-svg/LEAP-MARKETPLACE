// Admin > All products > Delete: the check and the deletion, through the REAL routes with a real admin login and the real database; everything a test changes is put back exactly. It includes stand-ins for tables of a real server
// that point at products (a quote request, one with an unusual name) which the test database lacks. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/productDelete.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');

const UPLOADS = path.join(__dirname, '../uploads'); const PHRASE = 'DELETE PRODUCTS';
const SNAP = ['products']; const DEPENDENTS = ['cart_items', 'product_fitment', 'product_fitment_entries', 'product_images', 'product_reviews', 'recently_viewed_products', 'wishlist_items'];
let server, base, admin, supplier; const made = []; const q = (sql, params) => db.query(sql, params); const n = async (sql, params) => Number((await q(sql, params)).rows[0].n);
const restore = async () => {
  await q('DROP TABLE IF EXISTS zz_pd_quotes, "Zz Pd Odd" CASCADE'); await q("DELETE FROM order_line_items WHERE product_id LIKE 'zz-pd-%'"); await q("DELETE FROM supplier_sub_orders WHERE order_id = 'zz-pd-ord'"); await q("DELETE FROM orders WHERE id = 'zz-pd-ord'");
  for (const t of DEPENDENTS) await q(`DELETE FROM ${t}`);
  await q('DELETE FROM products WHERE id NOT IN (SELECT id FROM zz_pd_products)'); await q('INSERT INTO products SELECT * FROM zz_pd_products ON CONFLICT (id) DO NOTHING');
  for (const t of DEPENDENTS) await q(`INSERT INTO ${t} SELECT * FROM zz_pd_${t}`);
  await q("DELETE FROM admin_audit_log WHERE action IN ('products_deleted', 'products_sent_to_review') AND target_id LIKE '%zz-pd-%'");
  for (const f of made.splice(0)) try { fs.unlinkSync(path.join(UPLOADS, f)); } catch { /* gone */ }
};
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
before(async () => {
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier);
  for (const t of [...SNAP, ...DEPENDENTS]) { await q(`DROP TABLE IF EXISTS zz_pd_${t}`); await q(`CREATE TABLE zz_pd_${t} AS SELECT * FROM ${t}`); }
});
beforeEach(async () => { await restore(); await fixtures(); });
after(async () => { await restore(); for (const t of [...SNAP, ...DEPENDENTS]) await q(`DROP TABLE IF EXISTS zz_pd_${t}`); server.close(); await db.getPool().end(); });

const file = () => { const name = `${crypto.randomBytes(16).toString('hex')}.png`; fs.writeFileSync(path.join(UPLOADS, name), Buffer.from('x')); made.push(name); return name; };
let ONLY, SHARED;
async function fixtures() {
  ONLY = file(); SHARED = file();
  const prod = (id) => q("INSERT INTO products (id, name, price, currency_code, category, part, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $1, 10, 'USD', 'zz-pd-cat', 'zz part', 1, 1, 1, 1)", [id]);
  for (const id of ['zz-pd-plain', 'zz-pd-plain2', 'zz-pd-other', 'zz-pd-ordered', 'zz-pd-quoted']) await prod(id);
  await q('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, 0), ($1, $3, 1), ($4, $3, 0)', ['zz-pd-plain', `/uploads/${ONLY}`, `/uploads/${SHARED}`, 'zz-pd-other']);
  await q("INSERT INTO product_reviews (product_id, buyer_id, rating, comment, status) VALUES ('zz-pd-plain', 'admin_dev_seed', 5, 'good', 'approved')"); await q("INSERT INTO wishlist_items (buyer_id, product_id) VALUES ('admin_dev_seed', 'zz-pd-plain')");
  await q("INSERT INTO carts (id) VALUES ('zz-pd-cart') ON CONFLICT (id) DO NOTHING"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-pd-cart', 'zz-pd-plain', 2)");
  await q("INSERT INTO orders (id, buyer_id, currency_code, total) VALUES ('zz-pd-ord', 'admin_dev_seed', 'USD', 10)"); const sub = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id) VALUES ('zz-pd-ord', 's1') RETURNING id")).rows[0].id; await q('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [sub, 'zz-pd-ordered']);
  await q('CREATE TABLE zz_pd_quotes (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q("INSERT INTO zz_pd_quotes (product_id) VALUES ('zz-pd-quoted')");
}
const call = async (what, body, token = admin) => { const r = await fetch(`${base}/catalog/admin/products/${what}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const exists = async (id) => (await n('SELECT count(*) AS n FROM products WHERE id = $1', [id])) === 1; const onDisk = (name) => fs.existsSync(path.join(UPLOADS, name));

test('the CHECK says which products can go, which cannot and why, and what goes with the ones that can; it changes nothing', async () => {
  const r = await call('delete-check', { ids: ['zz-pd-plain', 'zz-pd-ordered', 'zz-pd-quoted', 'zz-pd-nope'] }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual(r.body.deletable.map((p) => p.id), ['zz-pd-plain']); assert.deepEqual(r.body.held.map((p) => p.id).sort(), ['zz-pd-ordered', 'zz-pd-quoted']); assert.deepEqual(r.body.missing, ['zz-pd-nope']);
  assert.match(r.body.held.find((p) => p.id === 'zz-pd-ordered').reason, /been in an order/); assert.match(r.body.held.find((p) => p.id === 'zz-pd-quoted').reason, /zz_pd_quotes/);
  const goes = Object.fromEntries(r.body.alsoRemoved.map((x) => [x.what, x.count])); assert.equal(goes.pictures, 2); assert.equal(goes.reviews, 1); assert.equal(goes['wishlist entries'], 1); assert.equal(goes["lines in shoppers' carts"], 1);
  assert.equal(r.body.needsPhrase, true); assert.equal(r.body.phrase, PHRASE); assert.ok(await exists('zz-pd-plain') && await n("SELECT count(*) AS n FROM product_images WHERE product_id = 'zz-pd-plain'") === 2, 'nothing was changed');
});
test('one product: needs confirm: true; then it goes with its pictures, reviews, wishlist entries and cart lines, and the picture file nobody else uses is deleted', async () => {
  assert.equal((await call('delete', { ids: ['zz-pd-plain'] })).status, 400); assert.equal((await call('delete', { ids: ['zz-pd-plain'], confirm: false })).status, 400); assert.ok(await exists('zz-pd-plain'), 'nothing is deleted without the confirm');
  const r = await call('delete', { ids: ['zz-pd-plain'], confirm: true }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); assert.deepEqual(r.body.deleted, [{ id: 'zz-pd-plain', name: 'zz-pd-plain' }]);
  assert.ok(!(await exists('zz-pd-plain'))); for (const t of ['product_images', 'product_reviews', 'wishlist_items', 'cart_items']) assert.equal(await n(`SELECT count(*) AS n FROM ${t} WHERE product_id = 'zz-pd-plain'`), 0, t);
  assert.ok(!onDisk(ONLY), 'its own picture file is deleted'); assert.ok(onDisk(SHARED), 'a picture another product still uses stays'); assert.equal(await n("SELECT count(*) AS n FROM product_images WHERE product_id = 'zz-pd-other'"), 1); assert.equal(r.body.picturesRemoved, 1);
});
test('several at once need the typed sentence (exactly), and without it nothing at all is deleted', async () => {
  for (const confirm of [undefined, true, '', 'delete products', 'DELETE PRODUCT', 'REPLACE CATALOG']) { const r = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-plain2'], confirm }); assert.equal(r.status, 400, `confirm=${confirm}`); assert.match(r.body.error, /DELETE PRODUCTS/); }
  assert.ok(await exists('zz-pd-plain') && await exists('zz-pd-plain2'));
  const r = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-plain2'], confirm: PHRASE }); assert.equal(r.status, 200); assert.deepEqual(r.body.deleted.map((d) => d.id).sort(), ['zz-pd-plain', 'zz-pd-plain2']); assert.ok(!(await exists('zz-pd-plain')) && !(await exists('zz-pd-plain2')));
});
test('a product an order or a quote request points at is NEVER deleted (even asked for with the right sentence); the others in the same request are, and the answer says which stayed and why', async () => {
  const r = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-ordered', 'zz-pd-quoted'], confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual(r.body.deleted.map((d) => d.id), ['zz-pd-plain']); assert.deepEqual(r.body.kept.map((k) => k.id).sort(), ['zz-pd-ordered', 'zz-pd-quoted']); assert.ok(await exists('zz-pd-ordered') && await exists('zz-pd-quoted')); assert.equal(await n('SELECT count(*) AS n FROM zz_pd_quotes'), 1); assert.equal(await n("SELECT count(*) AS n FROM order_line_items WHERE product_id = 'zz-pd-ordered'"), 1);
});
test('asking to delete only products that cannot go is not an error: nothing is deleted and each is explained', async () => {
  const r = await call('delete', { ids: ['zz-pd-ordered'], confirm: true }); assert.equal(r.status, 200); assert.deepEqual(r.body.deleted, []); assert.match(r.body.kept[0].reason, /order/); assert.ok(await exists('zz-pd-ordered'));
});
test('a table the deletion could not recognise (an unusual name) cannot make it fail: that product stays, and its cart line and pictures are untouched', async () => {
  await q('CREATE TABLE "Zz Pd Odd" (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q('INSERT INTO "Zz Pd Odd" (product_id) VALUES (\'zz-pd-plain\')');
  const r = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-plain2'], confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); assert.deepEqual(r.body.deleted.map((d) => d.id), ['zz-pd-plain2'], 'the other one was still deleted'); const stay = r.body.kept.find((k) => k.id === 'zz-pd-plain'); assert.match(stay.reason, /still used by something else/);
  assert.ok(await exists('zz-pd-plain') && !(await exists('zz-pd-plain2'))); assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-pd-plain'"), 1, 'the cart line was not lost'); assert.ok(onDisk(ONLY), 'its picture file stays'); assert.equal(r.body.picturesRemoved, 0);
});
test('wrong requests are refused: no ids, not a list, more than 200, and the same id twice counts once', async () => {
  for (const body of [{}, { ids: 'zz-pd-plain' }, { ids: [] }, { ids: [1, 2] }, { ids: Array.from({ length: 201 }, (_, i) => `x${i}`), confirm: PHRASE }]) for (const what of ['delete-check', 'delete']) assert.equal((await call(what, { ...body, confirm: PHRASE })).status, 400, `${what} ${JSON.stringify(body).slice(0, 40)}`);
  const twice = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-plain'], confirm: true }); assert.equal(twice.status, 200); assert.equal(twice.body.deleted.length, 1);
});
test('a product that is not there is reported, not an error, and does not stop the rest', async () => { const r = await call('delete', { ids: ['zz-pd-plain', 'zz-pd-ghost'], confirm: PHRASE }); assert.equal(r.status, 200); assert.deepEqual(r.body.missing, ['zz-pd-ghost']); assert.deepEqual(r.body.deleted.map((d) => d.id), ['zz-pd-plain']); });
test('it is written to the audit log; and only an admin may use it (no sign-in is refused, and so is a supplier)', async () => {
  await call('delete', { ids: ['zz-pd-plain', 'zz-pd-plain2'], confirm: PHRASE }); const log = (await q("SELECT details FROM admin_audit_log WHERE action = 'products_deleted' AND target_id LIKE '%zz-pd-plain%'")).rows; assert.equal(log.length, 1); const d = typeof log[0].details === 'string' ? JSON.parse(log[0].details) : log[0].details; assert.equal(d.count, 2);
  for (const what of ['delete-check', 'delete']) { assert.equal((await call(what, { ids: ['zz-pd-other'], confirm: true }, null)).status, 401); assert.equal((await call(what, { ids: ['zz-pd-other'], confirm: true }, supplier)).status, 403); } assert.ok(await exists('zz-pd-other'));
});

// ---- hidden products can be found again and sent back to review
const list = async (query = '', token = admin) => { const r = await fetch(`${base}/catalog/admin/products${query}`, { headers: { Authorization: `Bearer ${token}` } }); return { status: r.status, body: await r.json() }; };
const status = async (id) => (await q('SELECT status FROM products WHERE id = $1', [id])).rows[0].status;
test('hiding a product (Reject) makes it leave the live list, and ?status=hidden lists it so it can be found again', async () => {
  const hide = await fetch(`${base}/catalog/products/bulk-moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` }, body: JSON.stringify({ items: [{ productId: 'zz-pd-quoted', action: 'reject' }] }) }); assert.equal(hide.status, 200);
  assert.equal(await status('zz-pd-quoted'), 'inactive'); const live = await list('?search=zz-pd'); assert.ok(!live.body.products.some((p) => p.id === 'zz-pd-quoted') && live.body.products.some((p) => p.id === 'zz-pd-plain'));
  const hidden = await list('?status=hidden&search=zz-pd'); assert.equal(hidden.status, 200); assert.deepEqual(hidden.body.products.map((p) => p.id), ['zz-pd-quoted']); assert.equal(hidden.body.total, 1);
});
test('SEND TO REVIEW: hidden products go back to the moderation queue (not live); live ones are left alone; unknown ones are reported', async () => {
  await q("UPDATE products SET status = 'inactive' WHERE id IN ('zz-pd-quoted', 'zz-pd-plain2')");
  const r = await call('send-to-review', { ids: ['zz-pd-quoted', 'zz-pd-plain2', 'zz-pd-plain', 'zz-pd-ghost'] }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual(r.body.sent.map((p) => p.id).sort(), ['zz-pd-plain2', 'zz-pd-quoted']); assert.deepEqual(r.body.skipped.sort(), ['zz-pd-ghost', 'zz-pd-plain']);
  assert.equal(await status('zz-pd-quoted'), 'translating'); assert.equal(await status('zz-pd-plain2'), 'translating'); assert.equal(await status('zz-pd-plain'), 'active', 'a live product is untouched');
  // the moderation queue lists exactly the products whose status is 'translating' (catalog/routes.js: WHERE p.status = 'translating')
  assert.deepEqual((await q("SELECT id FROM products WHERE status = 'translating' AND id LIKE 'zz-pd-%' ORDER BY id")).rows.map((r) => r.id), ['zz-pd-plain2', 'zz-pd-quoted'], 'both are now waiting in the moderation queue, and the live product is not');
  assert.equal((await q("SELECT count(*)::int AS n FROM admin_audit_log WHERE action = 'products_sent_to_review' AND target_id LIKE '%zz-pd-%'")).rows[0].n, 1);
});
test('send to review: wrong requests are refused, and only an admin may use it', async () => {
  for (const body of [{}, { ids: [] }, { ids: 'x' }, { ids: Array.from({ length: 201 }, (_, i) => `x${i}`) }]) assert.equal((await call('send-to-review', body)).status, 400);
  await q("UPDATE products SET status = 'inactive' WHERE id = 'zz-pd-plain2'"); assert.equal((await call('send-to-review', { ids: ['zz-pd-plain2'] }, null)).status, 401); assert.equal((await call('send-to-review', { ids: ['zz-pd-plain2'] }, supplier)).status, 403); assert.equal(await status('zz-pd-plain2'), 'inactive');
});
