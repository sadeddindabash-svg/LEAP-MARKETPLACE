// Categories: what still uses a category, and removing it together with its products. Through the REAL routes with a real admin login and the real database; everything a test changes is put back exactly. It includes stand-ins for
// tables of a real server that point at products and sub-categories (a quote request, an unusual name). Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/categoryRemove.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');

const UPLOADS = path.join(__dirname, '../uploads'); const PHRASE = 'DELETE CATEGORY';
const SNAP = ['product_categories', 'category_parts', 'products']; const DEPENDENTS = ['cart_items', 'product_fitment', 'product_fitment_entries', 'product_images', 'product_reviews', 'recently_viewed_products', 'wishlist_items'];
let server, base, admin, supplier; const made = []; const q = (sql, params) => db.query(sql, params); const n = async (sql, params) => Number((await q(sql, params)).rows[0].n);
const restore = async () => {
  await q('DROP TABLE IF EXISTS zz_cr_quotes, zz_cr_partrefs, "Zz Cr Odd" CASCADE'); await q("DELETE FROM order_line_items WHERE product_id LIKE 'zz-cr-%'"); await q("DELETE FROM supplier_sub_orders WHERE order_id = 'zz-cr-ord'"); await q("DELETE FROM orders WHERE id = 'zz-cr-ord'");
  for (const t of DEPENDENTS) await q(`DELETE FROM ${t}`);
  await q('DELETE FROM category_parts'); await q('DELETE FROM product_categories'); await q('DELETE FROM products WHERE id NOT IN (SELECT id FROM zz_cr_products)');
  await q('INSERT INTO product_categories SELECT * FROM zz_cr_product_categories'); await q('INSERT INTO category_parts SELECT * FROM zz_cr_category_parts'); await q('INSERT INTO products SELECT * FROM zz_cr_products ON CONFLICT (id) DO NOTHING');
  for (const t of DEPENDENTS) await q(`INSERT INTO ${t} SELECT * FROM zz_cr_${t}`);
  await q("DELETE FROM admin_audit_log WHERE action = 'category_removed_with_products' AND target_id LIKE 'zz-cr-%'"); for (const f of made.splice(0)) try { fs.unlinkSync(path.join(UPLOADS, f)); } catch { /* gone */ }
};
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
before(async () => {
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier);
  for (const t of [...SNAP, ...DEPENDENTS]) { await q(`DROP TABLE IF EXISTS zz_cr_${t}`); await q(`CREATE TABLE zz_cr_${t} AS SELECT * FROM ${t}`); }
});
beforeEach(async () => { await restore(); await fixtures(); });
after(async () => { await restore(); for (const t of [...SNAP, ...DEPENDENTS]) await q(`DROP TABLE IF EXISTS zz_cr_${t}`); server.close(); await db.getPool().end(); });

const file = () => { const name = `${crypto.randomBytes(16).toString('hex')}.png`; fs.writeFileSync(path.join(UPLOADS, name), Buffer.from('x')); made.push(name); return name; }; let PIC;
async function fixtures() {
  PIC = file();
  await q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ('zz-cr-cat', 'Zz CR Category', 'ع', '/uploads/placeholder-category.png', 9000), ('zz-cr-other', 'Zz CR Other', 'ع', '/uploads/placeholder-category.png', 9001)");
  const part = (id, cat, name) => q("INSERT INTO category_parts (id, category_id, name_en, name_ar, photo_url, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, 'ع', '/uploads/placeholder-part.png', 9000, 1, 1, 1, 1)", [id, cat, name]);
  await part('zz-cr-p1', 'zz-cr-cat', 'Zz CR Part 1'); await part('zz-cr-p2', 'zz-cr-cat', 'Zz CR Part 2'); await part('zz-cr-po', 'zz-cr-other', 'Zz CR Other Part');
  const prod = (id, status, partName, cat = 'zz-cr-cat') => q("INSERT INTO products (id, name, price, currency_code, category, part, status, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $1, 10, 'USD', $2, $3, $4, 1, 1, 1, 1)", [id, cat, partName, status]);
  await prod('zz-cr-live', 'active', 'Zz CR Part 1'); await prod('zz-cr-hidden', 'inactive', 'Zz CR Part 1'); await prod('zz-cr-draft', 'draft', 'Zz CR Part 1'); await prod('zz-cr-review', 'translating', 'Zz CR Part 1'); await prod('zz-cr-ordered', 'active', 'Zz CR Part 2'); await prod('zz-cr-quoted', 'active', 'Zz CR Part 2'); await prod('zz-cr-elsewhere', 'active', 'Zz CR Other Part', 'zz-cr-other');
  await q('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, 0)', ['zz-cr-live', `/uploads/${PIC}`]); await q("INSERT INTO product_reviews (product_id, buyer_id, rating, comment, status) VALUES ('zz-cr-live', 'admin_dev_seed', 5, 'x', 'approved')");
  await q("INSERT INTO carts (id) VALUES ('zz-cr-cart') ON CONFLICT (id) DO NOTHING"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-cr-cart', 'zz-cr-live', 1)");
  await q("INSERT INTO orders (id, buyer_id, currency_code, total) VALUES ('zz-cr-ord', 'admin_dev_seed', 'USD', 10)"); const sub = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id) VALUES ('zz-cr-ord', 's1') RETURNING id")).rows[0].id; await q('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [sub, 'zz-cr-ordered']);
  await q('CREATE TABLE zz_cr_quotes (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q("INSERT INTO zz_cr_quotes (product_id) VALUES ('zz-cr-quoted')");
}
const call = async (method, url, body, token = admin) => { const r = await fetch(`${base}/catalog${url}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const exists = async (table, id) => (await n(`SELECT count(*) AS n FROM ${table} WHERE id = $1`, [id])) === 1; const onDisk = (name) => fs.existsSync(path.join(UPLOADS, name));
const releaseHolds = async () => { await q("DELETE FROM order_line_items WHERE product_id = 'zz-cr-ordered'"); await q('DROP TABLE zz_cr_quotes'); };

test('the old delete still refuses, with the same words, and now says WHY it refused (inUse), so the screen can show what is in the way', async () => {
  const r = await call('DELETE', '/categories/zz-cr-cat'); assert.equal(r.status, 409); assert.equal(r.body.error, 'Cannot delete this category — real products still reference it'); assert.equal(r.body.inUse, true); assert.ok(await exists('product_categories', 'zz-cr-cat'));
  assert.equal((await call('DELETE', '/categories/zz-cr-other')).status, 409, 'another category with a product');
});
test('"in use" shows exactly what is using the category by state (also what no list shows: hidden, waiting for review, drafts), which can go and which cannot; it changes nothing', async () => {
  const r = await call('GET', '/admin/categories/zz-cr-cat/in-use'); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); const b = r.body;
  assert.equal(b.total, 6); assert.deepEqual(b.byState, { live: 3, hidden: 1, 'waiting for review': 1, 'supplier drafts': 1 }); assert.equal(b.parts, 2); assert.equal(b.deletable, 4); assert.equal(b.heldTotal, 2);
  assert.deepEqual(b.held.map((h) => h.id).sort(), ['zz-cr-ordered', 'zz-cr-quoted']); assert.match(b.held.find((h) => h.id === 'zz-cr-ordered').reason, /order/); assert.match(b.held.find((h) => h.id === 'zz-cr-quoted').reason, /zz_cr_quotes/);
  assert.deepEqual(b.sample.map((x) => x.id).sort(), ['zz-cr-draft', 'zz-cr-hidden', 'zz-cr-live', 'zz-cr-review']); const goes = Object.fromEntries(b.alsoRemoved.map((x) => [x.what, x.count])); assert.equal(goes.pictures, 1); assert.equal(goes.reviews, 1); assert.equal(b.phrase, PHRASE);
  assert.equal(await n("SELECT count(*) AS n FROM products WHERE category = 'zz-cr-cat'"), 6, 'nothing was changed');
});
test('removing needs the typed sentence (exactly); without it nothing at all changes', async () => {
  for (const confirm of [undefined, '', true, 'delete category', 'DELETE CATEGORIES', 'DELETE PRODUCTS']) { const r = await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm }); assert.equal(r.status, 400, `confirm=${confirm}`); assert.match(r.body.error, /DELETE CATEGORY/); }
  assert.equal(await n("SELECT count(*) AS n FROM products WHERE category = 'zz-cr-cat'"), 6);
});
test('removing: the products nothing points at are deleted (with pictures, reviews, cart lines), the ones an order or a quote request points at STAY, and so do their sub-category and the category, with the reasons', async () => {
  const r = await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250));
  assert.equal(r.body.removedProducts, 4); for (const id of ['zz-cr-live', 'zz-cr-hidden', 'zz-cr-draft', 'zz-cr-review']) assert.ok(!(await exists('products', id)), id); for (const id of ['zz-cr-ordered', 'zz-cr-quoted']) assert.ok(await exists('products', id), id);
  assert.equal(await n("SELECT count(*) AS n FROM product_reviews WHERE product_id = 'zz-cr-live'"), 0); assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-cr-live'"), 0); assert.ok(!onDisk(PIC), 'the picture file is gone'); assert.equal(r.body.picturesRemoved, 1);
  assert.ok(!(await exists('category_parts', 'zz-cr-p1')), 'its sub-category nobody uses any more is gone'); assert.ok(await exists('category_parts', 'zz-cr-p2')); assert.equal(r.body.removedSubCategories, 1); assert.match(r.body.kept.subCategories[0].reason, /a product that has to stay uses it/);
  assert.equal(r.body.categoryRemoved, false); assert.ok(await exists('product_categories', 'zz-cr-cat')); assert.match(r.body.kept.category, /2 products have to stay/); assert.deepEqual(r.body.kept.products.map((p) => p.id).sort(), ['zz-cr-ordered', 'zz-cr-quoted']); assert.ok(r.body.kept.products.every((p) => p.reason));
  assert.ok(await exists('products', 'zz-cr-elsewhere') && await exists('category_parts', 'zz-cr-po') && await exists('product_categories', 'zz-cr-other'), 'another category is untouched');
});
test('when nothing has to stay, the category goes too (and its sub-categories), in one step; and the plain delete then says it is gone', async () => {
  await releaseHolds(); const r = await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250));
  assert.equal(r.body.removedProducts, 6); assert.equal(r.body.removedSubCategories, 2); assert.equal(r.body.categoryRemoved, true); assert.equal(r.body.kept.category, null); assert.ok(!(await exists('product_categories', 'zz-cr-cat'))); assert.equal(await n("SELECT count(*) AS n FROM category_parts WHERE category_id = 'zz-cr-cat'"), 0);
  assert.equal((await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE })).status, 404); assert.equal((await call('GET', '/admin/categories/zz-cr-cat/in-use')).status, 404);
});
test('a category with no products at all is removed too (and its empty sub-categories)', async () => {
  await q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ('zz-cr-empty', 'Zz CR Empty', 'ع', '/uploads/placeholder-category.png', 9002)"); await q("INSERT INTO category_parts (id, category_id, name_en, name_ar, photo_url, sort_order) VALUES ('zz-cr-ep', 'zz-cr-empty', 'Zz CR Empty Part', 'ع', '/uploads/placeholder-part.png', 1)");
  const r = await call('POST', '/admin/categories/zz-cr-empty/remove', { confirm: PHRASE }); assert.equal(r.status, 200); assert.deepEqual([r.body.removedProducts, r.body.removedSubCategories, r.body.categoryRemoved], [0, 1, true]);
});
test('a table the removal could not recognise (an unusual name) cannot make it fail: that product stays, the others go, the category stays and says why', async () => {
  await releaseHolds(); await q('CREATE TABLE "Zz Cr Odd" (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q('INSERT INTO "Zz Cr Odd" (product_id) VALUES (\'zz-cr-live\')');
  const r = await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250)); assert.ok(await exists('products', 'zz-cr-live')); assert.ok(!(await exists('products', 'zz-cr-hidden')));
  assert.equal(r.body.removedProducts, 5); assert.match(r.body.kept.products[0].reason, /still used by something else/); assert.equal(r.body.categoryRemoved, false); assert.ok(await exists('product_categories', 'zz-cr-cat')); assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-cr-live'"), 1, 'its cart line was not lost'); assert.ok(onDisk(PIC), 'its picture file stays');
});
test('a sub-category that another table points at stays, and so does the category, without an error', async () => {
  await releaseHolds(); await q('CREATE TABLE zz_cr_partrefs (id serial PRIMARY KEY, part_id text REFERENCES category_parts(id))'); await q("INSERT INTO zz_cr_partrefs (part_id) VALUES ('zz-cr-p1')");
  const r = await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE }); assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250)); assert.ok(await exists('category_parts', 'zz-cr-p1')); assert.ok(!(await exists('category_parts', 'zz-cr-p2'))); assert.match(r.body.kept.subCategories[0].reason, /zz_cr_partrefs/); assert.equal(r.body.categoryRemoved, false); assert.match(r.body.kept.category, /1 sub-category has to stay/);
});
test('it is in the audit log, and only an admin who may open Categories can use it (no sign-in is refused, and so is a supplier)', async () => {
  await releaseHolds(); await call('POST', '/admin/categories/zz-cr-cat/remove', { confirm: PHRASE }); assert.equal(await n("SELECT count(*) AS n FROM admin_audit_log WHERE action = 'category_removed_with_products' AND target_id = 'zz-cr-cat'"), 1);
  for (const [method, url, body] of [['GET', '/admin/categories/zz-cr-other/in-use'], ['POST', '/admin/categories/zz-cr-other/remove', { confirm: PHRASE }]]) { assert.equal((await call(method, url, body, null)).status, 401); assert.equal((await call(method, url, body, supplier)).status, 403); }
  assert.ok(await exists('product_categories', 'zz-cr-other'));
});
