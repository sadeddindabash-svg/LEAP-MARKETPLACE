// "Optional: start clean" (Categories > Import from Excel): removing the OLD catalog, with and without "also delete the test products". Through the REAL routes with a real admin login and the real database; everything a test
// changes is put back exactly. These tests add what the test database lacks: tables of a real server that point at products, categories and sub-categories (for example `quote_request_items`), which made the check fail with
// "Internal server error". Run:   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/catalogCleanup.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../db/pool');

const SNAP = ['product_categories', 'category_parts', 'products', 'catalog_import_batches']; const DEPENDENTS = ['cart_items', 'product_fitment', 'product_fitment_entries', 'product_images', 'product_reviews', 'recently_viewed_products', 'wishlist_items'];
let server, base, admin; const q = (sql, params) => db.query(sql, params); const n = async (sql, params) => Number((await q(sql, params)).rows[0].n);
const restore = async () => {
  await q('DROP TABLE IF EXISTS zz_cl_quotes, zz_cl_catrefs, "Zz Cl Odd" CASCADE');
  await q("DELETE FROM order_line_items WHERE product_id LIKE 'zz-cl-%'"); await q("DELETE FROM supplier_sub_orders WHERE order_id = 'zz-cl-ord'"); await q("DELETE FROM orders WHERE id = 'zz-cl-ord'");
  for (const t of DEPENDENTS) await q(`DELETE FROM ${t}`);
  await q('DELETE FROM category_parts'); await q('DELETE FROM product_categories'); await q('DELETE FROM products WHERE id NOT IN (SELECT id FROM zz_cl_products)'); await q('DELETE FROM catalog_import_batches');
  await q('INSERT INTO product_categories SELECT * FROM zz_cl_product_categories'); await q('INSERT INTO category_parts SELECT * FROM zz_cl_category_parts'); await q('INSERT INTO products SELECT * FROM zz_cl_products ON CONFLICT (id) DO NOTHING');
  for (const t of [...DEPENDENTS, 'catalog_import_batches']) await q(`INSERT INTO ${t} SELECT * FROM zz_cl_${t}`);
};
before(async () => {
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/catalog/admin', require('../src/modules/catalogImport/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  await new Promise((r) => { server = app.listen(0, r); }); base = `http://localhost:${server.address().port}`;
  admin = (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) })).json()).token; assert.ok(admin);
  for (const t of [...SNAP, ...DEPENDENTS]) { await q(`DROP TABLE IF EXISTS zz_cl_${t}`); await q(`CREATE TABLE zz_cl_${t} AS SELECT * FROM ${t}`); }
});
beforeEach(async () => { await restore(); await fixtures(); });
after(async () => { await restore(); for (const t of [...SNAP, ...DEPENDENTS]) await q(`DROP TABLE IF EXISTS zz_cl_${t}`); server.close(); await db.getPool().end(); });

async function fixtures() {
  const cat = (id, name) => q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, $2, 'ع', '/uploads/placeholder-category.png', 9000)", [id, name]);
  const part = (id, category, name) => q("INSERT INTO category_parts (id, category_id, name_en, name_ar, photo_url, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, 'ع', '/uploads/placeholder-part.png', 9000, 1, 1, 1, 1)", [id, category, name]);
  const prod = (id, category, partName) => q("INSERT INTO products (id, name, price, currency_code, category, part, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $1, 10, 'USD', $2, $3, 1, 1, 1, 1)", [id, category, partName]);
  await cat('zz-cl-free', 'Zz Cl Free'); await part('zz-cl-free-1', 'zz-cl-free', 'Zz Cl Free Part');
  await cat('zz-cl-old', 'Zz Cl Old'); await part('zz-cl-old-1', 'zz-cl-old', 'Zz Cl Old Part 1'); await part('zz-cl-old-2', 'zz-cl-old', 'Zz Cl Old Part 2'); await part('zz-cl-old-3', 'zz-cl-old', 'Zz Cl Old Part 3'); await part('zz-cl-old-4', 'zz-cl-old', 'Zz Cl Old Part 4');
  await prod('zz-cl-plain', 'zz-cl-old', 'Zz Cl Old Part 1'); await prod('zz-cl-quoted', 'zz-cl-old', 'Zz Cl Old Part 2'); await prod('zz-cl-ordered', 'zz-cl-old', 'Zz Cl Old Part 3'); await prod('zz-cl-plain2', 'zz-cl-old', 'Zz Cl Old Part 4');
  await q("INSERT INTO carts (id) VALUES ('zz-cl-cart') ON CONFLICT (id) DO NOTHING"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-cl-cart', 'zz-cl-plain', 1)");
  await q("INSERT INTO orders (id, buyer_id, currency_code, total) VALUES ('zz-cl-ord', 'admin_dev_seed', 'USD', 10)"); const sub = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id) VALUES ('zz-cl-ord', 's1') RETURNING id")).rows[0].id; await q('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [sub, 'zz-cl-ordered']);
}
const api = async (method, url, body, token = admin) => { const r = await fetch(`${base}/catalog/admin${url}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const CONFIRM = { confirm: 'REMOVE OLD' }; const exists = async (table, id) => (await n(`SELECT count(*) AS n FROM ${table} WHERE id = $1`, [id])) === 1;

test('baseline (as before): without the products choice, the check lists what would go and removes nothing; a part or category a product uses stays', async () => {
  const r = await api('GET', '/cleanup/preview'); assert.equal(r.status, 200); assert.ok(r.body.removed.categories.some((c) => c.id === 'zz-cl-free')); assert.ok(!r.body.removed.categories.some((c) => c.id === 'zz-cl-old')); assert.ok(r.body.kept.categories.some((c) => c.id === 'zz-cl-old'));
  assert.ok(await exists('product_categories', 'zz-cl-free'), 'the check removed nothing');
});
test('"also delete the test products": the CHECK works (it failed with "Internal server error" when a quote request points at a product), and offers the product for deletion only when nothing points at it', async () => {
  await q('CREATE TABLE zz_cl_quotes (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q("INSERT INTO zz_cl_quotes (product_id) VALUES ('zz-cl-quoted')");
  const r = await api('GET', '/cleanup/preview?alsoProducts=1'); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); const gone = r.body.removed.products.map((p) => p.id);
  assert.ok(gone.includes('zz-cl-plain'), 'a plain test product can go'); assert.ok(!gone.includes('zz-cl-quoted'), 'one a quote request points at cannot'); assert.ok(!gone.includes('zz-cl-ordered'), 'nor one that was ordered');
  assert.match(r.body.kept.products.find((p) => p.id === 'zz-cl-quoted').reason, /zz_cl_quotes/); assert.match(r.body.kept.products.find((p) => p.id === 'zz-cl-ordered').reason, /order/);
  assert.ok(await exists('products', 'zz-cl-plain'), 'the check removed nothing');
});
test('the removal itself: the plain product (with its cart line) goes, the quoted and the ordered stay with their part and category, the quote request is intact', async () => {
  await q('CREATE TABLE zz_cl_quotes (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q("INSERT INTO zz_cl_quotes (product_id) VALUES ('zz-cl-quoted')");
  const r = await api('POST', '/cleanup/commit', { ...CONFIRM, alsoProducts: true }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.ok(!(await exists('products', 'zz-cl-plain'))); assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-cl-plain'"), 0); assert.ok(await exists('products', 'zz-cl-quoted')); assert.ok(await exists('products', 'zz-cl-ordered')); assert.equal(await n('SELECT count(*) AS n FROM zz_cl_quotes'), 1);
  assert.ok(await exists('category_parts', 'zz-cl-old-2') && await exists('category_parts', 'zz-cl-old-3') && await exists('product_categories', 'zz-cl-old'), 'their part and category stay'); assert.ok(!(await exists('category_parts', 'zz-cl-old-1')), 'the part of the product that went goes too'); assert.ok(!(await exists('product_categories', 'zz-cl-free')));
  assert.ok(r.body.removed.products.some((p) => p.id === 'zz-cl-plain') && !r.body.removed.products.some((p) => ['zz-cl-quoted', 'zz-cl-ordered'].includes(p.id))); assert.equal(r.body.counts.products, r.body.removed.products.length, 'the count is of products really removed');
});
test('a table the cleanup could not recognise (an unusual name) cannot make it fail: that product stays and the answer says what was REALLY removed', async () => {
  await q('CREATE TABLE "Zz Cl Odd" (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q('INSERT INTO "Zz Cl Odd" (product_id) VALUES (\'zz-cl-plain\')');
  const r = await api('POST', '/cleanup/commit', { ...CONFIRM, alsoProducts: true }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); assert.ok(await exists('products', 'zz-cl-plain'), 'it stays'); assert.ok(!r.body.removed.products.some((p) => p.id === 'zz-cl-plain')); assert.ok(!(await exists('products', 'zz-cl-plain2')) && r.body.removed.products.some((p) => p.id === 'zz-cl-plain2'), 'the other plain product was still removed: the refusal of one did not stop the rest'); assert.equal(r.body.counts.products, r.body.removed.products.length, 'the count is of products really removed'); assert.equal(await n('SELECT count(*) AS n FROM products WHERE id = ANY($1)', [r.body.removed.products.map((p) => p.id)]), 0, 'and they are really gone'); assert.ok(r.body.kept.products.some((p) => p.id === 'zz-cl-plain' && /still used by something else/.test(p.reason)));
  assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-cl-plain'"), 1, 'its cart line was not lost');
});
test('a category or sub-category that another table points at stays, in the check and in the removal, and nothing fails', async () => {
  await q('CREATE TABLE zz_cl_catrefs (id serial PRIMARY KEY, category_id text REFERENCES product_categories(id), part_id text REFERENCES category_parts(id))'); await q("INSERT INTO zz_cl_catrefs (category_id, part_id) VALUES ('zz-cl-free', 'zz-cl-free-1')");
  const c = await api('GET', '/cleanup/preview'); assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200)); assert.ok(!c.body.removed.categories.some((x) => x.id === 'zz-cl-free') && !c.body.removed.parts.some((x) => x.id === 'zz-cl-free-1')); assert.match(c.body.kept.categories.find((x) => x.id === 'zz-cl-free').reason, /other records use/);
  const r = await api('POST', '/cleanup/commit', CONFIRM); assert.equal(r.status, 200); assert.ok(await exists('product_categories', 'zz-cl-free') && await exists('category_parts', 'zz-cl-free-1'));
});
test('still guarded as before: the typed confirmation, and only an admin', async () => {
  for (const body of [{}, { confirm: 'yes' }, { confirm: 'remove old' }]) assert.equal((await api('POST', '/cleanup/commit', body)).status, 400); assert.equal((await api('GET', '/cleanup/preview', null, null)).status, 401); assert.ok(await exists('product_categories', 'zz-cl-free'));
});
