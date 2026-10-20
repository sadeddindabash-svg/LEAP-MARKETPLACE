// Tests of the catalog import, over real HTTP with the real login, permission check, audit log and database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/catalogImport.test.js
// It refuses to run against any database whose name does not end in "_test" (it deletes catalog rows).
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/pool');

const FIXTURE = path.join(__dirname, 'fixtures', 'Leap_Parts_Catalog.xlsx');
let server, base, token;

const cleanCatalog = async () => {
  await db.query("DELETE FROM cart_items WHERE product_id LIKE 'TEST-%'"); await db.query("DELETE FROM carts WHERE id LIKE 'TEST-CART%'");
  await db.query("DELETE FROM order_line_items WHERE product_id LIKE 'TEST-%'"); await db.query("DELETE FROM supplier_sub_orders WHERE order_id LIKE 'TEST-ORD-%'"); await db.query("DELETE FROM orders WHERE id LIKE 'TEST-ORD-%'");
  await db.query("DELETE FROM products WHERE id LIKE 'TEST-%'");
  await db.query('DELETE FROM category_parts WHERE import_batch_id IS NOT NULL OR id LIKE $1', ['t_%']);
  await db.query('DELETE FROM product_categories WHERE import_batch_id IS NOT NULL OR id LIKE $1', ['t_%']);
  await db.query('DELETE FROM catalog_import_batches');
  // the older catalog is put back from the snapshot taken before the first test (the cleanup tests delete it)
  await db.query('DELETE FROM category_parts WHERE import_batch_id IS NULL AND id NOT IN (SELECT id FROM zz_snap_parts)');            // anything a test left behind that was not in the snapshot
  await db.query('DELETE FROM product_categories WHERE import_batch_id IS NULL AND id NOT IN (SELECT id FROM zz_snap_cats)');
  await db.query('INSERT INTO product_categories SELECT * FROM zz_snap_cats ON CONFLICT (id) DO NOTHING');
  await db.query('INSERT INTO category_parts SELECT * FROM zz_snap_parts ON CONFLICT (id) DO NOTHING');
  await db.query('INSERT INTO products SELECT * FROM zz_snap_products ON CONFLICT (id) DO NOTHING');
  // the older rows an import only FILLS: put them back as they were (the sizes only where the import filled them: they are marked as estimates)
  await db.query("UPDATE category_parts SET weight_kg = NULL, length_cm = NULL, width_cm = NULL, height_cm = NULL WHERE import_batch_id IS NULL AND size_basis = 'estimate'");
  await db.query(`UPDATE category_parts SET code = NULL, name_zh = NULL, subcategory_en = NULL, subcategory_ar = NULL, subcategory_zh = NULL, placement_en = NULL, placement_ar = NULL, placement_zh = NULL, allowed_positions = NULL,
                  applies_to = NULL, special_shipping = NULL, keywords_en = NULL, keywords_ar = NULL, keywords_zh = NULL, size_basis = NULL WHERE import_batch_id IS NULL AND id NOT LIKE 't_%'`);
  await db.query("UPDATE product_categories SET code = NULL, name_zh = NULL WHERE import_batch_id IS NULL AND id NOT LIKE 't_%'");
};
before(async () => {
  const app = express(); app.use(express.json());
  app.use('/auth', require('../src/modules/auth/routes'));
  app.use('/catalog/admin', require('../src/modules/catalogImport/routes'));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) })).json();
  token = login.token; assert.ok(token, 'the seed admin can log in');
  for (const [name, source] of [['zz_snap_cats', 'product_categories WHERE import_batch_id IS NULL'], ['zz_snap_parts', 'category_parts WHERE import_batch_id IS NULL'], ['zz_snap_products', "products WHERE id NOT LIKE 'TEST-%'"]]) {
    await db.query(`CREATE TABLE IF NOT EXISTS ${name} AS SELECT * FROM ${source}`);
  }
  await cleanCatalog();
});
after(async () => { await cleanCatalog(); for (const n of ['zz_snap_cats', 'zz_snap_parts', 'zz_snap_products']) await db.query(`DROP TABLE IF EXISTS ${n}`); server.close(); await db.getPool().end(); });
beforeEach(cleanCatalog);

const api = async (method, url, body, tok = token) => {
  const res = await fetch(`${base}/catalog/admin${url}`, { method, headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const upload = async (url, buffer, mode = 'skip', tok = token) => {
  const fd = new FormData(); fd.append('file', new Blob([buffer]), 'catalog.xlsx'); fd.append('mode', mode);
  const res = await fetch(`${base}/catalog/admin${url}`, { method: 'POST', headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: fd });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const fixture = () => fs.readFileSync(FIXTURE);
/** The real workbook, changed by fn(sheet, col(headerName), rowOf(partCode)). */
async function variant(fn) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(FIXTURE);
  const ws = wb.getWorksheet('Part types'); const cols = {}; ws.getRow(1).eachCell((c, n) => { cols[c.value] = n; });
  fn(ws, (h) => cols[h], (code) => { for (let r = 2; r <= ws.rowCount; r++) if (ws.getRow(r).getCell(cols['Part Code']).value === code) return ws.getRow(r); throw new Error(`no ${code}`); });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const count = async (sql, params) => Number((await db.query(sql, params)).rows[0].n);
const counts = async () => ({ cats: await count('SELECT count(*) AS n FROM product_categories'), parts: await count('SELECT count(*) AS n FROM category_parts'), products: await count('SELECT count(*) AS n FROM products') });
const addProduct = (id, category, part, dims) => db.query('INSERT INTO products (id, name, price, currency_code, category, part, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, 10, $3, $4, $5, $6, $7, $8, $9)',
  [`TEST-${id}`, `Test ${id}`, 'USD', category, part, ...(dims || [null, null, null, null])]);

const addOrderedProduct = async (id, category, part) => {
  await addProduct(id, category, part);
  await db.query("INSERT INTO orders (id, buyer_id, currency_code, total) VALUES ($1, 'admin_dev_seed', 'USD', 10)", [`TEST-ORD-${id}`]);
  const sub = (await db.query("INSERT INTO supplier_sub_orders (order_id, supplier_id) VALUES ($1, 's1') RETURNING id", [`TEST-ORD-${id}`])).rows[0].id;
  await db.query('INSERT INTO order_line_items (sub_order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 10)', [sub, `TEST-${id}`]);
};
const addToCart = async (id) => { await db.query("INSERT INTO carts (id) VALUES ('TEST-CART-1') ON CONFLICT (id) DO NOTHING"); await db.query("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ('TEST-CART-1', $1, 1)", [`TEST-${id}`]); };
const oldCatalog = async () => ({ cats: await count("SELECT count(*) AS n FROM product_categories WHERE import_batch_id IS NULL AND code IS NULL"), parts: await count("SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NULL AND code IS NULL"), products: await count("SELECT count(*) AS n FROM products WHERE id NOT LIKE 'TEST-%'") });

test('only an admin may use it: no token, or a non-admin, is refused', async () => {
  assert.equal((await api('GET', '/health', null, null)).status, 401);
  assert.equal((await upload('/import/preview', fixture(), 'skip', null)).status, 401);
  assert.equal((await api('PATCH', '/categories/brake', { nameEn: 'X' }, null)).status, 401);
});

test('the template downloads, and a file made from it passes the rules', async () => {
  const res = await fetch(`${base}/catalog/admin/import/template`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200); assert.match(res.headers.get('content-disposition'), /Template\.xlsx/);
  const out = await upload('/import/preview', Buffer.from(await res.arrayBuffer()));
  assert.equal(out.status, 200); assert.equal(out.body.summary.rowsWithErrors, 0, JSON.stringify(out.body.rows.map((r) => r.messages)));
  assert.equal(out.body.summary.newParts + out.body.summary.existingParts, 2);
});

test('the preview of the real 736-part workbook writes NOTHING, and adds up', async () => {
  const before = await counts();
  const out = await upload('/import/preview', fixture());
  assert.equal(out.status, 200); const s = out.body.summary;
  assert.equal(s.rows, 736); assert.equal(s.rowsWithErrors, 0); assert.equal(out.body.blocking, false);
  assert.equal(s.newParts + s.existingParts + s.updatedParts, 736);
  assert.equal(s.newCategories + s.existingCategories + s.updatedCategories, 62);
  assert.deepEqual(await counts(), before, 'a preview must not change the database');
});

test('the commit creates 62 categories and 736 parts, complete, with placeholders, and leaves the old data alone', async () => {
  const legacy = (await db.query("SELECT id, name_en, name_ar FROM product_categories WHERE import_batch_id IS NULL ORDER BY id")).rows;
  const legacyParts = await count('SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NULL');
  const out = await upload('/import/commit', fixture());
  assert.equal(out.status, 201, JSON.stringify(out.body).slice(0, 300)); assert.ok(out.body.batchId);
  assert.equal(await count('SELECT count(*) AS n FROM product_categories WHERE code IS NOT NULL'), 62, 'every one of the 62 categories now has its code');
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE code IS NOT NULL'), 736);
  assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NOT NULL AND (name_zh IS NULL OR name_ar IS NULL OR subcategory_en IS NULL OR allowed_positions IS NULL OR size_basis IS NULL OR weight_kg IS NULL OR length_cm IS NULL OR width_cm IS NULL OR height_cm IS NULL)"), 0, 'no catalog part lacks a field');
  assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NOT NULL AND photo_url NOT LIKE '%placeholder-part.png'"), 0);
  assert.ok(fs.existsSync(path.join(__dirname, '../uploads/placeholder-part.png')) && fs.existsSync(path.join(__dirname, '../uploads/placeholder-category.png')), 'the two placeholder pictures exist where /uploads serves them');
  const now = (await db.query("SELECT id, name_en, name_ar FROM product_categories WHERE id = ANY($1) ORDER BY id", [legacy.map((l) => l.id)])).rows;
  assert.deepEqual(now, legacy, 'the categories that already existed are exactly as they were');
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NULL'), legacyParts, 'existing parts untouched');
  assert.equal(await count('SELECT count(*) AS n FROM products'), 3, 'products untouched');
  // rows that already existed and match by name: their blanks are filled (code, Chinese name, ...), nothing that had a value changes
  const matched = (await db.query("SELECT id, code, name_zh, name_ar FROM product_categories WHERE import_batch_id IS NULL AND id = ANY('{engine,filters,suspension,lighting}')")).rows;
  assert.equal(matched.length, 4); for (const m of matched) { assert.ok(m.code && m.name_zh, `${m.id} received its code and Chinese name`); assert.equal(m.name_ar, legacy.find((l) => l.id === m.id).name_ar, 'its Arabic name was not touched'); }
  assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NULL AND code IS NOT NULL"), 8, 'the 8 older parts that match by name received their codes');
  const p = (await db.query("SELECT * FROM category_parts WHERE code = 'FLD-002'")).rows[0];
  assert.equal(p.name_en, 'Engine Oil 4 L'); assert.equal(p.subcategory_en, 'Engine Oil'); assert.equal(p.allowed_positions, 'Universal'); assert.equal(p.size_basis, 'estimate');
});

test('importing the same file again changes nothing ("nothing to import")', async () => {
  await upload('/import/commit', fixture());
  const before = await counts();
  const again = await upload('/import/commit', fixture());
  assert.equal(again.status, 400); assert.match(again.body.error, /nothing to import/i);
  assert.deepEqual(await counts(), before);
});

test('a file with problems is refused as a whole: nothing is saved, and each problem names its row', async () => {
  const bad = await variant((ws, col, rowOf) => {
    rowOf('BRK-001').getCell(col('Main Category (English)')).value = 'Brake System';          // two words
    rowOf('ENG-002').getCell(col('Sub Category (English)')).value = 'Very Long Sub Category Name';  // 5 words
    rowOf('ENG-003').getCell(col('Allowed Positions')).value = 'Front; Middle';
    rowOf('ENG-004').getCell(col('Length (cm)')).value = -5;
    rowOf('ENG-005').getCell(col('Part Code')).value = 'ENG-004';                               // duplicate code
  });
  const before = await counts();
  const preview = await upload('/import/preview', bad);
  assert.equal(preview.status, 200); assert.equal(preview.body.blocking, true);
  const text = preview.body.rows.filter((r) => r.status === 'error').flatMap((r) => r.messages.filter((m) => m.level === 'error').map((m) => `${r.rowNumber}: ${m.text}`)).join('\n');
  for (const needle of [/must be exactly one word/, /must be 1 to 3 words/, /"Middle" is not accepted/, /must be more than zero/, /already used in row/]) assert.match(text, needle);
  const commit = await upload('/import/commit', bad);
  assert.equal(commit.status, 400); assert.deepEqual(await counts(), before, 'all or nothing');
});

test('a missing column, and a file that is not Excel, give a plain message', async () => {
  const noCol = await variant((ws, col) => { ws.getRow(1).getCell(col('Part Code')).value = 'Code'; });
  const a = await upload('/import/preview', noCol); assert.equal(a.status, 400); assert.match(a.body.error, /Part Code/);
  const b = await upload('/import/preview', Buffer.from('not a spreadsheet')); assert.equal(b.status, 400); assert.match(b.body.error, /could not be read/);
});

test('a sheet category whose name is the ID of an existing category (under another name) uses it, says so, and never renames or duplicates it', async () => {
  await db.query("UPDATE product_categories SET name_en = 'Lighting & Lamps' WHERE id = 'lighting'");           // the situation of a real database: the id is "lighting", the name is not
  try {
    const out = await upload('/import/preview', fixture());
    assert.equal(out.status, 200); assert.equal(out.body.summary.rowsWithErrors, 0, JSON.stringify(out.body.rows.filter((r) => r.status === 'error').slice(0, 2)));
    assert.ok(out.body.notes.some((n) => /matched the existing category "Lighting & Lamps" by its id "lighting"/.test(n)), 'the preview says which category was used');
    assert.equal((await upload('/import/commit', fixture())).status, 201);
    assert.equal(await count("SELECT count(*) AS n FROM product_categories WHERE lower(name_en) = 'lighting' OR lower(id) = 'lighting'"), 1, 'no second Lighting category was created');
    assert.equal((await db.query("SELECT name_en, code FROM product_categories WHERE id = 'lighting'")).rows[0].name_en, 'Lighting & Lamps', 'its own name was not touched');
    assert.equal((await db.query("SELECT code FROM product_categories WHERE id = 'lighting'")).rows[0].code, 'LGT', 'its blanks were filled');
    assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE category_id = 'lighting' AND code LIKE 'LGT-%'"), 29, 'the 29 lighting parts went into it');
  } finally { await db.query("UPDATE product_categories SET name_en = 'Lighting' WHERE id = 'lighting'"); }
});

test('a name that is the ID of one category and the NAME of another is refused as ambiguous', async () => {
  await db.query("INSERT INTO product_categories (id, name_en, name_ar, sort_order) VALUES ('fuel', 'Petrol Things', 'بنزين', 990), ('t_other', 'Fuel', 'وقود', 991)");
  const out = await upload('/import/preview', fixture());
  const bad = out.body.rows.filter((r) => r.status === 'error' && r.category === 'Fuel');
  assert.ok(bad.length > 0, 'the Fuel rows are refused'); assert.match(bad[0].messages.map((m) => m.text).join(' '), /id of the category "Petrol Things" and the name of another category/);
  assert.equal((await upload('/import/commit', fixture())).status, 400);
});

test('a look-alike of an existing category is reported, never merged', async () => {
  const out = await upload('/import/preview', fixture());
  const pair = out.body.nearDuplicates.find((d) => d.existingName === 'Brake System');
  assert.ok(pair, 'Brake System ~ a new category is reported'); assert.equal(pair.newName, 'Brakes');
});

test('update mode: refreshes what a sheet owns, but never a size a person set, and says what shipping it touches', async () => {
  await upload('/import/commit', fixture());
  await db.query("UPDATE category_parts SET size_basis = 'measured', weight_kg = 7, length_cm = 7, width_cm = 7, height_cm = 7 WHERE code = 'BRK-001'");     // a person measured it
  const part = (await db.query("SELECT category_id, name_en FROM category_parts WHERE code = 'BRK-002'")).rows[0];
  await addProduct('rely', part.category_id, part.name_en);                                                                                               // a product that relies on the part's size
  const changed = await variant((ws, col, rowOf) => {
    rowOf('BRK-001').getCell(col('Weight (kg)')).value = 99;
    rowOf('BRK-002').getCell(col('Weight (kg)')).value = 55; rowOf('BRK-002').getCell(col('Sub Category (Arabic)')).value = 'قرص فرامل جديد';
  });
  const skip = await upload('/import/commit', changed, 'skip'); assert.equal(skip.status, 400, 'skip mode changes nothing');
  const preview = await upload('/import/preview', changed, 'update');
  assert.equal(preview.body.summary.updatedParts, 1, 'BRK-001 only differs by a size a person set, which is kept: nothing to update'); assert.equal(preview.body.summary.productsAffected, 1); assert.ok(preview.body.summary.keptMeasuredSizes >= 1);
  const out = await upload('/import/commit', changed, 'update'); assert.equal(out.status, 201);
  const a = (await db.query("SELECT weight_kg, size_basis FROM category_parts WHERE code = 'BRK-001'")).rows[0];
  assert.equal(Number(a.weight_kg), 7, 'the measured weight was kept'); assert.equal(a.size_basis, 'measured');
  const b = (await db.query("SELECT weight_kg, subcategory_ar, name_en FROM category_parts WHERE code = 'BRK-002'")).rows[0];
  assert.equal(Number(b.weight_kg), 55, 'an estimate is refreshed'); assert.equal(b.subcategory_ar, 'قرص فرامل جديد'); assert.equal(b.name_en, part.name_en, 'the English name never changes');
});

test('two imports at the same moment: one wins, nothing is doubled, no database error', async () => {
  const [a, b] = await Promise.all([upload('/import/commit', fixture()), upload('/import/commit', fixture())]);
  assert.deepEqual([a.status, b.status].sort(), [201, 400], JSON.stringify([a.body.error, b.body.error]));
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE code IS NOT NULL'), 736);
  assert.equal(await count("SELECT count(*) AS n FROM (SELECT code FROM category_parts WHERE code IS NOT NULL GROUP BY code HAVING count(*) > 1) d"), 0);
});

test('undo removes what the import created and nothing uses, and keeps what a product uses', async () => {
  const out = await upload('/import/commit', fixture());
  const used = (await db.query("SELECT category_id, name_en FROM category_parts WHERE code = 'FLD-002'")).rows[0];
  await addProduct('keeps', used.category_id, used.name_en);
  const undo = await api('POST', `/import/batches/${out.body.batchId}/undo`);
  assert.equal(undo.status, 200); assert.equal(undo.body.partsKeptBecauseInUse, 1); assert.equal(undo.body.partsRemoved, 727); assert.equal(undo.body.olderPartsFilledAndKept, 8);
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NOT NULL'), 1, 'only the part a product uses remains');
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NULL'), 36, 'the older parts were never involved');
  assert.equal((await api('POST', `/import/batches/${out.body.batchId}/undo`)).status, 409, 'a second undo is refused');
  assert.equal((await api('POST', '/import/batches/nope/undo')).status, 404);
});

test('editing a part: Chinese name, positions and size; a person-typed size becomes "measured"', async () => {
  await upload('/import/commit', fixture());
  const part = (await db.query("SELECT id FROM category_parts WHERE code = 'BRK-001'")).rows[0];
  const ok = await api('PATCH', `/parts/${part.id}`, { nameZh: '刹车片组', allowedPositions: ['Front', 'Rear', 'Left'], weightKg: 1.2, lengthCm: 26, widthCm: 16, heightCm: 11, keywordsEn: 'pads; shoes' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.nameZh, '刹车片组'); assert.deepEqual(ok.body.allowedPositions, ['Front', 'Rear', 'Left']); assert.equal(ok.body.sizeBasis, 'measured'); assert.equal(ok.body.weightKg, 1.2);
  for (const [body, needle] of [[{ weightKg: 2 }, /together/], [{ allowedPositions: ['Middle'] }, /not accepted/], [{ lengthCm: 9999, widthCm: 1, heightCm: 1, weightKg: 1 }, /typing mistake/],
    [{ subcategoryEn: 'One Two Three Four' }, /1 to 3 words/], [{ nameEn: 'Something Else' }, /must start with its sub-category/], [{ sizeBasis: 'maybe' }, /estimate/]]) {
    const bad = await api('PATCH', `/parts/${part.id}`, body); assert.equal(bad.status, 400, JSON.stringify(body)); assert.match(bad.body.error, needle);
  }
});

test('renaming a part carries its products along; a name that is taken is refused', async () => {
  await upload('/import/commit', fixture());
  const part = (await db.query("SELECT id, category_id, name_en FROM category_parts WHERE code = 'FLD-002'")).rows[0];
  await addProduct('follows', part.category_id, part.name_en);
  const out = await api('PATCH', `/parts/${part.id}`, { nameEn: 'Engine Oil 1 Liter' });
  assert.equal(out.status, 200); assert.equal(out.body.productsRenamed, 1);
  assert.equal((await db.query("SELECT part FROM products WHERE id = 'TEST-follows'")).rows[0].part, 'Engine Oil 1 Liter', 'the product still points at its part');
  const other = (await db.query("SELECT name_en FROM category_parts WHERE code = 'FLD-003'")).rows[0];
  const clash = await api('PATCH', `/parts/${part.id}`, { nameEn: other.name_en.toUpperCase() });
  assert.equal(clash.status, 409);
});

test('editing a category: names, code, the one-word rule, and no clash with another name or id', async () => {
  await upload('/import/commit', fixture());
  const cat = (await db.query("SELECT id FROM product_categories WHERE code = 'BRK'")).rows[0];
  const ok = await api('PATCH', `/categories/${cat.id}`, { nameZh: '刹车系统', nameAr: 'نظام الفرامل' }); assert.equal(ok.status, 200); assert.equal(ok.body.nameZh, '刹车系统');
  assert.match((await api('PATCH', `/categories/${cat.id}`, { nameEn: 'Brake System' })).body.error, /exactly one word/);
  assert.equal((await api('PATCH', `/categories/${cat.id}`, { nameEn: 'Engine' })).status, 409);
  assert.equal((await api('PATCH', `/categories/${cat.id}`, { nameEn: 'brake' })).status, 409, 'equal to the id of the older Brake System category');
  assert.equal((await api('PATCH', '/categories/missing', { nameEn: 'X' })).status, 404);
  const legacy = await api('PATCH', '/categories/lighting', { nameZh: '照明' });
  assert.equal(legacy.status, 200, 'an older category without a code can still be edited');
});

test('health counts the placeholders and the estimates, and the products priced on them', async () => {
  await upload('/import/commit', fixture());
  const part = (await db.query("SELECT category_id, name_en FROM category_parts WHERE code = 'BRK-001'")).rows[0];
  await addProduct('est', part.category_id, part.name_en);
  const h = (await api('GET', '/health')).body;
  assert.equal(h.categories.inCatalog, 62); assert.equal(h.parts.inCatalog, 736); assert.equal(h.parts.onEstimatedSize, await count("SELECT count(*) AS n FROM category_parts WHERE size_basis = 'estimate'")); assert.ok(h.parts.onEstimatedSize >= 700 && h.categories.withoutRealPhoto >= 58);
  assert.equal(h.productsPricedOnEstimates, 1);
  const ids = (await db.query("SELECT id FROM category_parts WHERE code = 'BRK-001'")).rows.map((r) => r.id);
  assert.equal((await api('POST', '/parts/review', { ids })).body.marked, 1);
  assert.equal((await api('GET', '/health')).body.productsPricedOnEstimates, 0, 'a reviewed size no longer counts as an estimate');
  assert.equal((await api('POST', '/parts/review', { ids: [] })).status, 400);
});

test('a product without its own size takes the imported part\'s size for shipping (flagged as an estimate)', async () => {
  await upload('/import/commit', fixture());
  const part = (await db.query("SELECT category_id, name_en, weight_kg, length_cm FROM category_parts WHERE code = 'BRK-001'")).rows[0];
  await addProduct('ship', part.category_id, part.name_en);
  await addProduct('own', part.category_id, part.name_en, [5, 50, 40, 30]);
  const { withEffectiveShippingRows } = require('../src/modules/shared/partShipping');
  const rows = (await db.query("SELECT * FROM products WHERE id IN ('TEST-ship', 'TEST-own')")).rows;
  const out = await withEffectiveShippingRows(rows, db);
  const ship = out.find((r) => r.id === 'TEST-ship'), own = out.find((r) => r.id === 'TEST-own');
  assert.equal(ship.shipping_source, 'part'); assert.equal(Number(ship.weight_kg), Number(part.weight_kg)); assert.equal(Number(ship.length_cm), Number(part.length_cm));
  assert.equal(own.shipping_source, 'product'); assert.equal(Number(own.weight_kg), 5, 'a product with its own complete size is never overridden');
});

test('supplier import: codes and Chinese names are recognised, exact names still win, ambiguity is never guessed', async () => {
  await upload('/import/commit', fixture());
  const { tryMatchCategoryAndPart } = require('../src/modules/supplier/productValidation');
  const brk = (await db.query("SELECT id FROM product_categories WHERE code = 'BRK'")).rows[0].id;
  const pad = (await db.query("SELECT name_en, name_zh FROM category_parts WHERE code = 'BRK-001'")).rows[0];
  assert.deepEqual(await tryMatchCategoryAndPart('BRK', pad.name_en, db), { category: brk, part: pad.name_en }, 'by category code');
  assert.deepEqual(await tryMatchCategoryAndPart('brk', 'BRK-001', db), { category: brk, part: pad.name_en }, 'by part code');
  assert.deepEqual(await tryMatchCategoryAndPart('制动', pad.name_zh, db), { category: brk, part: pad.name_en }, 'by Chinese names');
  assert.deepEqual(await tryMatchCategoryAndPart('', 'BRK-001', db), { category: brk, part: pad.name_en }, 'a part code alone is enough');
  assert.deepEqual(await tryMatchCategoryAndPart('brake', 'Front Brake Disc', db).then((r) => r.category), 'brake', 'the older exact id still works');
  assert.deepEqual(await tryMatchCategoryAndPart('', 'no such part', db), { category: null, part: null });
  await db.query("INSERT INTO product_categories (id, name_en, name_ar, name_zh, sort_order) VALUES ('t_a', 'T A', 'تي', '共同名', 991), ('t_b', 'T B', 'تيب', '共同名', 992)");
  assert.deepEqual(await tryMatchCategoryAndPart('共同名', null, db), { category: null, part: null }, 'a Chinese name shared by two categories is not guessed');
});

test('skip mode fills blanks but never overwrites a value that exists; the second import then has nothing to do', async () => {
  const cat = (await db.query("SELECT id FROM product_categories WHERE id = 'engine'")).rows[0];
  await db.query("UPDATE product_categories SET name_zh = '我的发动机' WHERE id = 'engine'");                            // a value a person already set
  await db.query("UPDATE category_parts SET weight_kg = 3, length_cm = 3, width_cm = 3, height_cm = 3 WHERE category_id = 'filters'");   // sizes a person already set
  const sizes = (await db.query("SELECT id, weight_kg FROM category_parts WHERE category_id = 'filters' ORDER BY id")).rows;
  assert.equal((await upload('/import/commit', fixture())).status, 201);
  assert.equal((await db.query("SELECT name_zh, code FROM product_categories WHERE id = $1", [cat.id])).rows[0].name_zh, '我的发动机', 'a Chinese name that existed was kept');
  assert.deepEqual((await db.query("SELECT id, weight_kg FROM category_parts WHERE category_id = 'filters' ORDER BY id")).rows.filter((r) => sizes.some((s) => s.id === r.id)), sizes, 'sizes that existed were kept');
  const again = await upload('/import/commit', fixture()); assert.equal(again.status, 400); assert.match(again.body.error, /nothing to import/i);
});

test('the editing lists carry every field, and need an admin', async () => {
  await upload('/import/commit', fixture());
  assert.equal((await api('GET', '/categories', null, null)).status, 401);
  const cats = (await api('GET', '/categories')).body;
  const brk = cats.find((c) => c.code === 'BRK');
  assert.equal(cats.length, 64, "6 older + 58 new: four of the 62 match older ones"); assert.equal(brk.nameZh, '制动'); assert.equal(brk.partCount, 17); assert.equal(brk.hasPlaceholderPhoto, true);
  const parts = (await api('GET', `/categories/${brk.id}/parts`)).body;
  const pad = parts.find((p) => p.code === 'BRK-001');
  assert.equal(parts.length, 17); assert.equal(pad.nameEn, 'Brake Pad Set'); assert.deepEqual(pad.allowedPositions, ['Front', 'Rear']); assert.equal(pad.sizeBasis, 'estimate');
  assert.ok(pad.nameZh && pad.subcategoryAr && pad.placementEn && pad.weightKg > 0 && pad.hasPlaceholderPhoto);
});

test('start clean: the preview lists what would go, and removes NOTHING', async () => {
  const before = await oldCatalog();
  const out = (await api('GET', '/cleanup/preview')).body;
  assert.deepEqual(before, { cats: 6, parts: 36, products: 3 });
  assert.equal(out.counts.parts, 36); assert.equal(out.counts.categories, 4); assert.equal(out.counts.categoriesKept, 2, 'Brake System and Filters stay: a product uses each');
  assert.deepEqual(out.kept.categories.map((c) => c.id).sort(), ['brake', 'filters']); assert.match(out.kept.categories[0].reason, /product\(s\) still use it/);
  assert.deepEqual(await oldCatalog(), before, 'a preview changes nothing');
  const withProducts = (await api('GET', '/cleanup/preview?alsoProducts=1')).body;
  assert.equal(withProducts.counts.categories, 6); assert.equal(withProducts.counts.products, 2); assert.deepEqual(await oldCatalog(), before);
  assert.equal((await api('GET', '/cleanup/preview', null, null)).status, 401);
});

test('start clean: it needs the exact confirmation, or nothing is removed', async () => {
  const before = await oldCatalog();
  for (const body of [{}, { confirm: 'yes' }, { confirm: 'remove old' }]) { const r = await api('POST', '/cleanup/commit', body); assert.equal(r.status, 400, JSON.stringify(body)); assert.match(r.body.error, /REMOVE OLD/); }
  assert.deepEqual(await oldCatalog(), before);
  assert.equal((await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD' }, null)).status, 401);
});

test('start clean: removes the old parts and categories nothing uses, and keeps the categories products use', async () => {
  const out = await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD' });
  assert.equal(out.status, 200); assert.equal(out.body.counts.parts, 36); assert.equal(out.body.counts.categories, 4);
  assert.deepEqual(out.body.removed.categories.map((c) => c.id).sort(), ['electrical', 'engine', 'lighting', 'suspension']);
  assert.deepEqual(await oldCatalog(), { cats: 2, parts: 0, products: 3 }, 'products untouched; Brake System and Filters stay with their products');
});

test('start clean: a part that a product uses stays, with its category, and only its own category', async () => {
  const used = (await db.query("SELECT name_en FROM category_parts WHERE category_id = 'suspension' ORDER BY id LIMIT 1")).rows[0].name_en;
  await addProduct('usespart', 'suspension', used);
  const out = await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD' }); assert.equal(out.status, 200);
  assert.deepEqual((await db.query("SELECT name_en FROM category_parts WHERE category_id = 'suspension'")).rows.map((r) => r.name_en), [used], 'only the part the product uses remains');
  assert.equal(await count("SELECT count(*) AS n FROM product_categories WHERE id = 'suspension'"), 1, 'and its category');
  assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE category_id = 'engine'"), 0, 'the other categories lose all their unused parts');
  assert.equal(await count("SELECT count(*) AS n FROM products WHERE id = 'TEST-usespart'"), 1);
});

test('start clean with the products: the test products go, a product that was ever ordered never does', async () => {
  await addOrderedProduct('ordered', 'engine', null); await addProduct('plain', 'electrical', null); await addToCart('plain');
  const preview = (await api('GET', '/cleanup/preview?alsoProducts=1')).body;
  assert.equal(preview.counts.productsKept, 1); assert.match(preview.kept.products[0].reason, /been in an order/);
  assert.equal(await count("SELECT count(*) AS n FROM products WHERE id = 'TEST-plain'"), 1, 'the preview deleted nothing');
  const out = await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD', alsoProducts: true }); assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(await count("SELECT count(*) AS n FROM products WHERE id IN ('p1', 'p4', 'TEST-plain')"), 0, 'the unordered products on the old catalog are gone');
  assert.equal(await count("SELECT count(*) AS n FROM cart_items WHERE product_id = 'TEST-plain'"), 0, 'and so are their cart lines');
  assert.equal(await count("SELECT count(*) AS n FROM products WHERE id = 'TEST-ordered'"), 1, 'the ordered product stays');
  assert.equal(await count("SELECT count(*) AS n FROM products WHERE id = 'p9'"), 1, 'a product that does not use the old catalog is not touched');
  assert.deepEqual(out.body.kept.categories.map((c) => c.id), ['engine'], 'only the category of the ordered product stays');
  assert.equal(await count("SELECT count(*) AS n FROM order_line_items WHERE product_id = 'TEST-ordered'"), 1, 'order history is intact');
});

test('start clean never touches what the import created or filled with a catalog code', async () => {
  await upload('/import/commit', fixture());
  const cats = await count('SELECT count(*) AS n FROM product_categories WHERE code IS NOT NULL'), parts = await count('SELECT count(*) AS n FROM category_parts WHERE code IS NOT NULL');
  const preview = (await api('GET', '/cleanup/preview?alsoProducts=1')).body; assert.equal(preview.hasImports, true);
  const out = await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD', alsoProducts: true }); assert.equal(out.status, 200);
  assert.equal(await count('SELECT count(*) AS n FROM product_categories WHERE code IS NOT NULL'), cats, 'every catalog category is still there');
  assert.equal(await count('SELECT count(*) AS n FROM category_parts WHERE code IS NOT NULL'), parts, 'every catalog part is still there');
  assert.equal(await count("SELECT count(*) AS n FROM category_parts WHERE import_batch_id IS NOT NULL"), 728);
});

test('start clean, then import: the catalog stands alone, with no merge into old categories', async () => {
  assert.equal((await api('POST', '/cleanup/commit', { confirm: 'REMOVE OLD', alsoProducts: true })).status, 200);
  assert.deepEqual(await oldCatalog(), { cats: 0, parts: 0, products: 1 }, 'only p9, which never used the old catalog, is left');
  const out = await upload('/import/commit', fixture()); assert.equal(out.status, 201);
  assert.equal(out.body.summary.newCategories, 62); assert.equal(out.body.summary.newParts, 736); assert.equal(out.body.summary.existingCategories + out.body.summary.updatedCategories, 0); assert.deepEqual(out.body.nearDuplicates, []);
  assert.equal(await count('SELECT count(*) AS n FROM product_categories'), 62); assert.equal(await count('SELECT count(*) AS n FROM category_parts'), 736);
  assert.equal(await count("SELECT count(*) AS n FROM product_categories WHERE id LIKE 'cat_%'"), 62);
});
