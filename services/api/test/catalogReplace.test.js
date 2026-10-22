// Categories > Import from Excel: "make the catalog EXACTLY the sheet". Through the REAL import routes (check and import) with a real admin login, REAL Excel files (the fixture catalog cut down to a few categories), the real database
// and the real uploads folder. Everything a test changes is put back exactly as it was. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/catalogReplace.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const express = require('express'); const ExcelJS = require('exceljs');
const db = require('../db/pool');

const FIXTURE = path.join(__dirname, 'fixtures', 'Leap_Parts_Catalog.xlsx'); const UPLOADS = path.join(__dirname, '../uploads'); const PHRASE = 'REPLACE CATALOG';
const SNAP = ['product_categories', 'category_parts', 'products', 'catalog_import_batches']; const DEPENDENTS = ['cart_items', 'product_fitment', 'product_fitment_entries', 'product_images', 'product_reviews', 'recently_viewed_products', 'wishlist_items'];
let server, base, admin, supplier; const q = (sql, params) => db.query(sql, params); const n = async (sql, params) => Number((await q(sql, params)).rows[0].n); const made = [];

const restore = async () => {
  await q('DROP TABLE IF EXISTS zz_rp_quotes, zz_rp_catrefs, "Zz Odd Quotes" CASCADE');      // tables of the real database that my test database does not have: stand-ins made by the tests below
  await q("DELETE FROM order_line_items WHERE product_id LIKE 'zz-rp-%'"); await q("DELETE FROM supplier_sub_orders WHERE order_id = 'zz-rp-ord'"); await q("DELETE FROM orders WHERE id = 'zz-rp-ord'");
  for (const t of DEPENDENTS) await q(`DELETE FROM ${t}`);
  await q('DELETE FROM category_parts'); await q('DELETE FROM product_categories'); await q('DELETE FROM products WHERE id NOT IN (SELECT id FROM zz_rp_products)'); await q('DELETE FROM catalog_import_batches');
  await q('INSERT INTO product_categories SELECT * FROM zz_rp_product_categories'); await q('INSERT INTO category_parts SELECT * FROM zz_rp_category_parts'); await q('INSERT INTO products SELECT * FROM zz_rp_products ON CONFLICT (id) DO NOTHING');
  for (const t of [...DEPENDENTS, 'catalog_import_batches']) await q(`INSERT INTO ${t} SELECT * FROM zz_rp_${t}`);
  for (const f of made.splice(0)) try { fs.unlinkSync(path.join(UPLOADS, f)); } catch { /* gone */ }
};
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/catalog/admin', require('../src/modules/catalogImport/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  await new Promise((r) => { server = app.listen(0, r); }); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier);
  for (const t of [...SNAP, ...DEPENDENTS]) { await q(`DROP TABLE IF EXISTS zz_rp_${t}`); await q(`CREATE TABLE zz_rp_${t} AS SELECT * FROM ${t}`); }
});
beforeEach(async () => { await restore(); await fixtures(); baseOrphans = await orphansNow(); });
after(async () => { await restore(); for (const t of [...SNAP, ...DEPENDENTS]) await q(`DROP TABLE IF EXISTS zz_rp_${t}`); server.close(); await db.getPool().end(); });

/** Old, hand-made catalog on top of the seed one: a section nobody uses, a section with a product, an ordered product, and extra sub-categories inside "Engine" (which the sheet also has, by name). */
async function fixtures() {
  const cat = (id, name) => q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, $2, 'ع', '/uploads/placeholder-category.png', 9000)", [id, name]);
  const part = (id, category, name) => q("INSERT INTO category_parts (id, category_id, name_en, name_ar, photo_url, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, 'ع', '/uploads/placeholder-part.png', 9000, 1, 1, 1, 1)", [id, category, name]);
  const prod = (id, category, partName) => q("INSERT INTO products (id, name, price, currency_code, category, part, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $1, 10, 'USD', $2, $3, 1, 1, 1, 1)", [id, category, partName]);
  await cat('zz-rp-free', 'Zz Free Section'); await part('zz-rp-free-1', 'zz-rp-free', 'Zz Free Part');
  await cat('zz-rp-old', 'Zz Old Section'); await part('zz-rp-old-1', 'zz-rp-old', 'Zz Old Part 1'); await part('zz-rp-old-2', 'zz-rp-old', 'Zz Old Part 2'); await prod('zz-rp-prod-1', 'zz-rp-old', 'Zz Old Part 1'); await prod('zz-rp-ordered', 'zz-rp-old', 'Zz Old Part 2');
  await part('zz-rp-eng-x', 'engine', 'Zz Extra Engine Part'); await part('zz-rp-eng-y', 'engine', 'Zz Used Engine Part'); await prod('zz-rp-prod-2', 'engine', 'Zz Used Engine Part');
  await q('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, 0)', ['zz-rp-prod-1', '/uploads/zz-rp-product-picture.jpg']); await q("INSERT INTO carts (id) VALUES ('zz-rp-cart') ON CONFLICT (id) DO NOTHING"); await q("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('zz-rp-cart', 'zz-rp-prod-1', 1)");
  await q("INSERT INTO orders (id, buyer_id, currency_code, total) VALUES ('zz-rp-ord', 'admin_dev_seed', 'USD', 10)"); const sub = (await q("INSERT INTO supplier_sub_orders (order_id, supplier_id) VALUES ('zz-rp-ord', 's1') RETURNING id")).rows[0].id; await q('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [sub, 'zz-rp-ordered']);
}
/** The fixture catalog cut down to the given categories (the rest of the rows are removed). `edit(ws, col)` may change it further. */
async function sheet(codes = ['ENG', 'LGT'], edit) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(FIXTURE); const ws = wb.getWorksheet('Part types'); const cols = {}; ws.getRow(1).eachCell((c, i) => { cols[c.value] = i; });
  for (let r = ws.rowCount; r >= 2; r--) if (!codes.includes(ws.getRow(r).getCell(cols['Main Category Code']).value)) ws.spliceRows(r, 1);
  if (edit) edit(ws, (h) => cols[h]); return Buffer.from(await wb.xlsx.writeBuffer());
}
const send = async (what, buffer, { mode = 'skip', removeOthers, alsoProducts, confirm, token = admin } = {}) => { const f = new FormData(); f.append('file', new Blob([buffer]), 'catalog.xlsx'); f.append('mode', mode); if (removeOthers !== undefined) f.append('removeOthers', removeOthers ? '1' : '0'); if (alsoProducts !== undefined) f.append('alsoProducts', alsoProducts ? '1' : '0'); if (confirm !== undefined) f.append('confirm', confirm); const r = await fetch(`${base}/catalog/admin/import/${what}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: f }); return { status: r.status, body: await r.json().catch(() => null) }; };
const ids = async (table) => new Set((await q(`SELECT id FROM ${table}`)).rows.map((r) => r.id));
const state = async () => ({ cats: await ids('product_categories'), parts: await ids('category_parts'), products: await ids('products') });
const names = (list) => list.map((x) => x.id);
/** The promise of "exactly the sheet": nothing is left that the sheet does not mention, unless a product needs it. (Products that pointed at a category that does not exist BEFORE the test are not the import's business.) */
let baseOrphans;
const orphansNow = async () => (await q("SELECT pr.id FROM products pr WHERE pr.id NOT LIKE 'TEST-%' AND NOT EXISTS (SELECT 1 FROM product_categories c WHERE c.id = pr.category) ORDER BY pr.id")).rows.map((r) => r.id);
const assertExact = async () => { assert.deepEqual(await leftovers(), { parts: [], categories: [] }, 'nothing old is left over'); assert.deepEqual(await orphansNow(), baseOrphans, 'no product lost its category'); };
const leftovers = async () => ({
  parts: (await q("SELECT p.id FROM category_parts p WHERE p.code IS NULL AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en)))")).rows.map((r) => r.id),
  categories: (await q("SELECT c.id FROM product_categories c WHERE c.code IS NULL AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = c.id) AND NOT EXISTS (SELECT 1 FROM category_parts p WHERE p.category_id = c.id)")).rows.map((r) => r.id),
});

test('without the new choice the import is exactly as before: the check says nothing about removal, and the old catalog stays', async () => {
  const before = await state(); const chk = await send('preview', await sheet()); assert.equal(chk.status, 200); assert.equal(chk.body.removal, null);
  assert.equal((await send('commit', await sheet(), { alsoProducts: true })).status, 201, 'alsoProducts alone does nothing'); const after = await state(); for (const id of before.cats) assert.ok(after.cats.has(id), `${id} is still there`); for (const id of before.parts) assert.ok(after.parts.has(id)); for (const id of before.products) assert.ok(after.products.has(id));
});
test('the CHECK lists what would be removed and what stays and why, and changes nothing', async () => {
  const before = await state(); const chk = await send('preview', await sheet(), { removeOthers: true }); assert.equal(chk.status, 200); const r = chk.body.removal;
  for (const id of ['zz-rp-free', 'electrical', 'suspension']) assert.ok(names(r.categories).includes(id), `${id} would be removed`);
  for (const id of ['zz-rp-free-1', 'zz-rp-eng-x']) assert.ok(names(r.parts).includes(id), `${id} would be removed`);
  for (const [id, reason] of [['brake', /1 product uses it/], ['filters', /1 product uses it/], ['zz-rp-old', /2 products use it \(and order history keeps it\)/]]) { assert.ok(!names(r.categories).includes(id)); assert.match(r.kept.categories.find((c) => c.id === id).reason, reason); }
  assert.match(r.kept.parts.find((p) => p.id === 'zz-rp-eng-y').reason, /1 product uses it/); assert.ok(!names(r.categories).includes('engine') && !names(r.categories).includes('lighting'), 'the sheet matches Engine and Lighting by name: they stay');
  assert.deepEqual(r.counts, { categories: r.categories.length, parts: r.parts.length, products: 0 }); assert.equal(chk.body.ready, true); const after = await state(); assert.deepEqual([after.cats.size, after.parts.size, after.products.size], [before.cats.size, before.parts.size, before.products.size]);
});
test('the import will not remove anything without the typed confirmation (missing or wrong), and then changes nothing at all', async () => {
  const before = await state(); for (const confirm of [undefined, '', 'replace catalog', 'Replace Catalog', 'REPLACE CATALOG NOW', 'REMOVE OLD']) { const r = await send('commit', await sheet(), { removeOthers: true, confirm }); assert.equal(r.status, 400, `confirm=${confirm}`); assert.match(r.body.error, /REPLACE CATALOG/); }
  const after = await state(); assert.deepEqual([after.cats.size, after.parts.size, after.products.size], [before.cats.size, before.parts.size, before.products.size]); assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE code IS NOT NULL"), 0, 'nothing was imported either');
});
test('make the catalog exactly the sheet: the sheet is imported, the old is removed, what products need stays, and nothing is left over', async () => {
  const chk = (await send('preview', await sheet(), { removeOthers: true })).body.removal; const before = await state();
  const r = await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300)); const after = await state();
  assert.deepEqual(r.body.removal.counts, chk.counts, 'the import removed exactly what the check promised');
  const wbRows = new ExcelJS.Workbook(); await wbRows.xlsx.load(await sheet()); const sheetRows = wbRows.getWorksheet('Part types').rowCount - 1; assert.equal(await n('SELECT count(*) AS n FROM category_parts WHERE code IS NOT NULL'), sheetRows, 'the catalog has exactly the sheet\'s parts: the ones that already existed were kept, the others created'); assert.equal(await n("SELECT count(*) AS n FROM category_parts WHERE category_id = 'engine' AND code IS NOT NULL"), (await q("SELECT count(*) AS n FROM category_parts WHERE code LIKE 'ENG-%'")).rows[0].n * 1); assert.equal(before.cats.size - after.cats.size + r.body.summary.newCategories, chk.counts.categories); assert.equal(before.parts.size - after.parts.size + r.body.summary.newParts, chk.counts.parts);
  for (const id of ['zz-rp-free', 'electrical', 'suspension']) assert.ok(!after.cats.has(id), `${id} is gone`); for (const id of ['zz-rp-free-1', 'zz-rp-eng-x']) assert.ok(!after.parts.has(id), `${id} is gone`);
  for (const id of ['brake', 'filters', 'zz-rp-old']) assert.ok(after.cats.has(id), `${id} stays: a product uses it`); assert.ok(after.parts.has('zz-rp-eng-y')); for (const id of before.products) assert.ok(after.products.has(id), 'no product was deleted');
  assert.equal((await q("SELECT code FROM product_categories WHERE id = 'engine'")).rows[0].code, 'ENG', 'the hand-made Engine matched the sheet by name and got its code'); assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE code IN ('ENG', 'LGT')"), 2, 'the sheet has exactly its two categories');
  await assertExact();
});
test('the sub-categories of a sheet category that the sheet does not list are removed too (the sheet decides, not the old category)', async () => {
  const sheetParts = await n("SELECT count(*) AS n FROM category_parts WHERE category_id = 'engine'"); await send('commit', await sheet(['ENG']), { removeOthers: true, confirm: PHRASE });
  const left = (await q("SELECT id, code FROM category_parts WHERE category_id = 'engine' ORDER BY id")).rows; assert.ok(left.every((p) => p.code || p.id === 'zz-rp-eng-y'), 'only sheet parts, plus the one a product uses'); assert.ok(left.length > 0 && sheetParts > 0);
  assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'lighting'"), 0, 'Lighting is not in this sheet, so it is old (it has no product)');
});
test('"also delete the products": products that use the old catalog are deleted (with their pictures and cart lines), never one that was ordered, and then the old categories they held go too', async () => {
  const chk = (await send('preview', await sheet(), { removeOthers: true, alsoProducts: true })).body.removal; assert.ok(names(chk.products).includes('zz-rp-prod-1') && names(chk.products).includes('zz-rp-prod-2') && !names(chk.products).includes('zz-rp-ordered'));
  assert.match(chk.kept.products.find((p) => p.id === 'zz-rp-ordered').reason, /order history/); assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-1'"), 1, 'the check deleted nothing');
  const r = await send('commit', await sheet(), { removeOthers: true, alsoProducts: true, confirm: PHRASE }); assert.equal(r.status, 201); assert.deepEqual(r.body.removal.counts.products, chk.counts.products);
  for (const id of ['zz-rp-prod-1', 'zz-rp-prod-2']) assert.equal(await n('SELECT count(*) AS n FROM products WHERE id = $1', [id]), 0); assert.equal(await n("SELECT count(*) AS n FROM product_images WHERE product_id = 'zz-rp-prod-1'"), 0); assert.equal(await n("SELECT count(*) AS n FROM cart_items WHERE product_id = 'zz-rp-prod-1'"), 0);
  assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-ordered'"), 1, 'the ordered product stays'); assert.equal(await n("SELECT count(*) AS n FROM category_parts WHERE id = 'zz-rp-old-2'"), 1, 'its part stays'); assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'zz-rp-old'"), 1, 'and its category');
  assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'brake'"), 0, 'brake held only a product that could go, so it goes too'); await assertExact();
});
test('a file with a problem removes NOTHING and imports nothing (the removal is part of the same all-or-nothing step)', async () => {
  const before = await state(); const bad = await sheet(['ENG', 'LGT'], (ws, col) => { ws.getRow(3).getCell(col('Part Code')).value = ws.getRow(2).getCell(col('Part Code')).value; });
  const chk = await send('preview', bad, { removeOthers: true }); assert.equal(chk.body.blocking, true); assert.equal(chk.body.ready, false); const r = await send('commit', bad, { removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 400);
  const after = await state(); assert.deepEqual([after.cats.size, after.parts.size, after.products.size], [before.cats.size, before.parts.size, before.products.size]); assert.equal(await n('SELECT count(*) AS n FROM product_categories WHERE code IS NOT NULL'), 0);
});
test('importing the same sheet again changes nothing ("nothing to import"); but with something old added since, the removal alone is enough to go ahead', async () => {
  assert.equal((await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE })).status, 201);
  const again = await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE }); assert.equal(again.status, 400); assert.match(again.body.error, /nothing to import/i); assert.equal(again.body.removal.counts.categories, 0);
  await q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ('zz-rp-late', 'Zz Late', 'ع', '/uploads/placeholder-category.png', 9100)"); const chk = await send('preview', await sheet(), { removeOthers: true }); assert.deepEqual([chk.body.ready, chk.body.nothingToImport], [true, false]); assert.ok(names(chk.body.removal.categories).includes('zz-rp-late'));
  const r = await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 201); assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'zz-rp-late'"), 0);
});
test('the real pictures of what is removed are deleted from the server too, unless something else uses them; the placeholders are never touched', async () => {
  const file = (prefix) => { const name = `${crypto.randomBytes(16).toString('hex')}.png`; fs.writeFileSync(path.join(UPLOADS, name), Buffer.from('x')); made.push(name); return name; };
  const alone = file(); const shared = file(); await q("UPDATE product_categories SET photo_url = $1 WHERE id = 'zz-rp-free'", [`/uploads/${alone}`]); await q("UPDATE category_parts SET photo_url = $1 WHERE id = 'zz-rp-free-1'", [`/uploads/${shared}`]); await q("UPDATE product_categories SET photo_url = $1 WHERE id = 'zz-rp-old'", [`/uploads/${shared}`]);
  const placeholder = path.join(UPLOADS, 'placeholder-category.png'); const had = fs.existsSync(placeholder);
  const r = await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 201); assert.ok(!fs.existsSync(path.join(UPLOADS, alone)), 'its own picture is gone'); assert.ok(fs.existsSync(path.join(UPLOADS, shared)), 'a picture a kept category still uses stays'); assert.equal(fs.existsSync(placeholder), had); assert.ok(r.body.picturesRemoved >= 1);
});
test('update mode works with it too, and the audit log remembers what was removed', async () => {
  const r = await send('commit', await sheet(), { mode: 'update', removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 201); await assertExact();
  const log = (await q("SELECT details FROM admin_audit_log WHERE action = 'catalog_import' AND target_id = $1", [r.body.batchId])).rows; assert.equal(log.length, 1, 'the import is in the audit log'); const d = typeof log[0].details === 'string' ? JSON.parse(log[0].details) : log[0].details;
  assert.deepEqual([d.replaced, d.removedCategories, d.removedParts, d.removedProducts], [true, r.body.removal.counts.categories, r.body.removal.counts.parts, 0]);
});
// ---- tables of YOUR database that the test database lacks (a real server had `quote_request_items`, which points at products and made the removal fail): the removal must find such tables by itself
test('a product that another table points at (a quote request) is never deleted, and the import does not fail: the check lists it as staying, with the table named', async () => {
  await q('CREATE TABLE zz_rp_quotes (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q("INSERT INTO zz_rp_quotes (product_id) VALUES ('zz-rp-prod-1')");
  const chk = (await send('preview', await sheet(), { removeOthers: true, alsoProducts: true })).body.removal; assert.ok(!names(chk.products).includes('zz-rp-prod-1'), 'not offered for deletion'); assert.ok(names(chk.products).includes('zz-rp-prod-2'), 'a product nothing points at still is');
  assert.match(chk.kept.products.find((p) => p.id === 'zz-rp-prod-1').reason, /zz_rp_quotes/); assert.ok(chk.kept.parts.some((p) => p.id === 'zz-rp-old-1') || chk.kept.categories.some((c) => c.id === 'zz-rp-old'), 'its sub-category and category stay too');
  const r = await send('commit', await sheet(), { removeOthers: true, alsoProducts: true, confirm: PHRASE }); assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 200)); assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-1'"), 1); assert.equal(await n("SELECT count(*) AS n FROM zz_rp_quotes"), 1);
  assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-2'"), 0); assert.deepEqual(r.body.removal.counts, chk.counts, 'what the import removed is what the check promised');
});
test('a category or sub-category that another table points at stays, and the import does not fail', async () => {
  await q('CREATE TABLE zz_rp_catrefs (id serial PRIMARY KEY, category_id text REFERENCES product_categories(id), part_id text REFERENCES category_parts(id))'); await q("INSERT INTO zz_rp_catrefs (category_id, part_id) VALUES ('zz-rp-free', 'zz-rp-free-1')");
  const chk = (await send('preview', await sheet(), { removeOthers: true })).body.removal; assert.ok(!names(chk.categories).includes('zz-rp-free') && !names(chk.parts).includes('zz-rp-free-1')); assert.match(chk.kept.categories.find((c) => c.id === 'zz-rp-free').reason, /zz_rp_catrefs/); assert.match(chk.kept.parts.find((p) => p.id === 'zz-rp-free-1').reason, /zz_rp_catrefs/);
  const r = await send('commit', await sheet(), { removeOthers: true, confirm: PHRASE }); assert.equal(r.status, 201); assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'zz-rp-free'"), 1); assert.equal(await n("SELECT count(*) AS n FROM category_parts WHERE id = 'zz-rp-free-1'"), 1); assert.deepEqual(r.body.removal.counts, chk.counts);
});
test('even a table the removal could not recognise (an unusual name) cannot make it fail: the item that is still used stays, and the answer says what was REALLY removed', async () => {
  const productsBefore = await ids('products'); await q('CREATE TABLE "Zz Odd Quotes" (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES products(id))'); await q('INSERT INTO "Zz Odd Quotes" (product_id) VALUES (\'zz-rp-prod-1\')');
  const r = await send('commit', await sheet(), { removeOthers: true, alsoProducts: true, confirm: PHRASE }); assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 200)); assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-1'"), 1, 'the product stays'); assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-2'"), 0);
  assert.equal(await n("SELECT count(*) AS n FROM products WHERE id = 'zz-rp-prod-1'"), r.body.removal.kept.products.some((p) => p.id === 'zz-rp-prod-1') ? 1 : 0, 'and it is reported as staying'); assert.match(r.body.removal.kept.products.find((p) => p.id === 'zz-rp-prod-1').reason, /still used by something else/);
  const nowThere = await ids('products'); assert.equal(r.body.removal.counts.products, [...productsBefore].filter((id) => !nowThere.has(id)).length, 'the count is of products really deleted');
  assert.equal(await n("SELECT count(*) AS n FROM carts c JOIN cart_items i ON i.cart_id = c.id WHERE i.product_id = 'zz-rp-prod-1'"), 1, 'the cart line of the product that stayed was not lost');
});
test('only an admin: no sign-in is refused and so is a supplier (the check and the import)', async () => {
  for (const what of ['preview', 'commit']) { assert.equal((await send(what, await sheet(), { removeOthers: true, confirm: PHRASE, token: null })).status, 401); assert.equal((await send(what, await sheet(), { removeOthers: true, confirm: PHRASE, token: supplier })).status, 403); }
  assert.equal(await n("SELECT count(*) AS n FROM product_categories WHERE id = 'electrical'"), 1);
});
