// Real photos for the catalog (Categories > Photos), through the REAL routes with real admin and supplier logins, real multipart uploads, the real database and uploads folder, and the real public lists. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/catalogPhotos.test.js
// (it refuses to run on a database whose name does not end in "_test", and removes what it creates: ids starting "zz-cp", codes ZQA / ZQB.)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const ExcelJS = require('exceljs');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { ensurePlaceholders } = require('../src/modules/catalogImport/placeholders');
const { clearFallbackCache } = require('../src/modules/catalogPhotos/fallback');

const UPLOADS = path.join(__dirname, '../uploads'); const JPEG = fs.readFileSync(path.join(__dirname, 'fixtures/catalog-photo-512.jpg'));
let server, base, admin, supplier, PH; const made = new Set();
const q = (sql, params) => db.query(sql, params);
const makePng = (w, h) => { const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x7f)]); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const auth = (t) => (t ? { Authorization: `Bearer ${t}` } : {});
const A = (p) => `${base}/catalog/admin/photos${p}`;
const get = (p, t = admin) => fetch(A(p), { headers: auth(t) });
const put = (p, body, t = admin) => fetch(A(p), { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth(t) }, body: JSON.stringify(body) });
const importFiles = (files, { batchId = 'batch-test-0001', replace, token = admin } = {}) => { const f = new FormData(); f.append('batchId', batchId); if (replace) f.append('replace', '1'); for (const [name, bytes, type = 'image/png'] of files) f.append('images', new Blob([bytes], { type }), name); return fetch(A('/import'), { method: 'POST', headers: auth(token), body: f }); };
const run = async (files, opts) => { const r = await importFiles(files, opts); assert.equal(r.status, 200, JSON.stringify(await r.clone().json())); return (await r.json()).results; };
const photoOf = async (table, id) => (await q(`SELECT photo_url FROM ${table} WHERE id = $1`, [id])).rows[0].photo_url;
const onDisk = (url) => fs.existsSync(path.join(UPLOADS, path.basename(url)));
const track = (results) => { for (const r of results) if (r.url) made.add(r.url); return results; };

const wipe = async () => {
  await q("DELETE FROM product_images WHERE product_id LIKE 'zz-cp-%'"); await q("DELETE FROM products WHERE id LIKE 'zz-cp-%'");
  await q("DELETE FROM category_parts WHERE id LIKE 'zz-cp-%'"); await q("DELETE FROM product_categories WHERE id LIKE 'zz-cp-%'");
  await q("DELETE FROM platform_settings WHERE key IN ('catalog_photo_batches', 'catalog_photo_fallback')"); clearFallbackCache();
};
const setup = async () => {
  await wipe();
  await q("INSERT INTO product_categories (id, code, name_en, name_ar, name_zh, photo_url, sort_order) VALUES ('zz-cp-a', 'ZQA', 'Test Brakes', 'فرامل', '刹车', $1, 9001), ('zz-cp-b', 'ZQB', 'Test Lights', 'إضاءة', '灯', $1, 9002)", [PH.category]);
  const part = (id, cat, code, name, sub, order) => q("INSERT INTO category_parts (id, category_id, code, name_en, name_ar, name_zh, subcategory_en, photo_url, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, $4, 'ع', '中', $5, $6, $7, 1, 1, 1, 1)", [id, cat, code, name, sub, PH.part, order]);
  await part('zz-cp-p1', 'zz-cp-a', 'ZQA-001', 'Test Oil 1 L', 'Test Oil', 1); await part('zz-cp-p2', 'zz-cp-a', 'ZQA-002', 'Test Oil 4 L', 'Test Oil', 2); await part('zz-cp-p3', 'zz-cp-a', 'ZQA-003', 'Test Pad Set', 'Test Pad Set', 3); await part('zz-cp-p4', 'zz-cp-b', 'ZQB-001', 'Test Bulb', 'Test Bulb', 1);
};
before(async () => { PH = ensurePlaceholders(); server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier); });
beforeEach(setup);
after(async () => { await wipe(); for (const url of made) try { fs.unlinkSync(path.join(UPLOADS, path.basename(url))); } catch { /* removed */ } server.close(); await db.getPool().end(); });

test('only an admin may use any of it: no sign-in is refused, and so is a supplier', async () => {
  for (const [m, p] of [['GET', '/coverage'], ['GET', '/shot-list.xlsx'], ['POST', '/import'], ['GET', '/batches'], ['POST', '/batches/x/undo'], ['GET', '/settings'], ['PUT', '/settings']]) {
    for (const [who, token, status] of [['no sign-in', null, 401], ['a supplier', supplier, 403]]) { const r = await fetch(A(p), { method: m, headers: auth(token) }); assert.equal(r.status, status, `${m} ${p} for ${who}`); }
  }
});

// ---- coverage
test('coverage: each section and part, whether its picture is real or the placeholder, and the totals; sizes of one part count as one picture', async () => {
  const cov = await (await get('/coverage')).json(); const sec = cov.sections.filter((s) => s.code.startsWith('ZQ')); const parts = cov.parts.filter((p) => p.code.startsWith('ZQ'));
  assert.deepEqual(sec.map((s) => [s.code, s.hasPhoto, s.parts, s.partsWithPhoto]), [['ZQA', false, 3, 0], ['ZQB', false, 1, 0]]); assert.equal(parts.length, 4); assert.ok(parts.every((p) => p.hasPhoto === false));
  assert.equal(parts[0].group, parts[1].group); assert.notEqual(parts[0].group, parts[2].group); assert.equal(cov.fallback, false);
  assert.equal(cov.totals.pictures, cov.totals.sections + new Set(cov.parts.map((p) => p.group)).size);
  await q("UPDATE category_parts SET photo_url = '/uploads/real.jpg' WHERE id = 'zz-cp-p3'"); await q("UPDATE product_categories SET photo_url = NULL WHERE id = 'zz-cp-b'");
  const again = await (await get('/coverage')).json(); assert.equal(again.parts.find((p) => p.code === 'ZQA-003').hasPhoto, true); assert.equal(again.sections.find((s) => s.code === 'ZQB').hasPhoto, false, 'a missing picture counts as none');
});
test('coverage counts the live products of each part (the shot list uses it to say what to do first)', async () => {
  await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, category, part) VALUES ('zz-cp-x1', 'x', 1, 'USD', 's1', 1, 'active', 'zz-cp-a', 'Test Pad Set'), ('zz-cp-x2', 'x', 1, 'USD', 's1', 1, 'active', 'zz-cp-a', ' test pad set '), ('zz-cp-x3', 'x', 1, 'USD', 's1', 1, 'translating', 'zz-cp-a', 'Test Pad Set')");
  assert.equal((await (await get('/coverage')).json()).parts.find((p) => p.code === 'ZQA-003').products, 2);
});

// ---- shot list
const shotList = async (query = '') => { const res = await get(`/shot-list.xlsx${query}`); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /spreadsheetml/); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await res.arrayBuffer())); return wb; };
const rowsOf = (wb) => { const ws = wb.getWorksheet('Shot list'); const head = ws.getRow(1).values.slice(1); const out = []; ws.eachRow((row, n) => { if (n > 1) out.push(Object.fromEntries(head.map((h, i) => [h, row.values[i + 1]]))); }); return out; };
test('the shot list is a real spreadsheet: sections first, then parts; the file name is the code; sizes of one part share ONE row; names in three languages; a ready prompt', async () => {
  const rows = rowsOf(await shotList()).filter((r) => String(r['File name']).startsWith('ZQ'));
  assert.deepEqual(rows.map((r) => r['File name']), ['ZQA.jpg', 'ZQB.jpg', 'ZQA-001.jpg', 'ZQA-003.jpg', 'ZQB-001.jpg']);
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.Type, r.Priority]), [['Section', 1], ['Section', 1]]); const oil = rows.find((r) => r['File name'] === 'ZQA-001.jpg'); assert.equal(oil['Applies to codes'], 'ZQA-001, ZQA-002'); assert.equal(rows.some((r) => r['File name'] === 'ZQA-002.jpg'), false, 'no second row for the other size');
  assert.equal(oil['Name (English)'], 'Test Oil'); assert.equal(oil['Name (Arabic)'], 'ع'); assert.equal(oil['Name (Chinese)'], '中'); assert.match(oil['What to show'], /Test Oil 1 L, Test Oil 4 L share this picture/); assert.match(oil['Prompt for an image tool'], /single Test Oil.*Test Brakes system.*EEF2F6.*no brand logos, no text/);
  assert.equal(oil['Has a picture'], 'no'); assert.match(rows[0]['Prompt for an image tool'], /Test Brakes component/);
});
test('priority: the sections are 1; a part that already has live products is 2; the rest are 3', async () => {
  await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, category, part) VALUES ('zz-cp-x1', 'x', 1, 'USD', 's1', 1, 'active', 'zz-cp-a', 'Test Pad Set')");
  const rows = rowsOf(await shotList()).filter((r) => String(r['File name']).startsWith('ZQ')); const tier = Object.fromEntries(rows.map((r) => [r['File name'], r.Priority])); assert.equal(tier['ZQA.jpg'], 1); assert.equal(tier['ZQA-003.jpg'], 2); assert.equal(tier['ZQA-001.jpg'], 3); assert.equal(tier['ZQB-001.jpg'], 3);
  assert.equal(rows.filter((r) => r.Type === 'Part')[0]['File name'], 'ZQA-003.jpg', 'the part with products comes before the others');
});
test('"missing only" leaves out what already has a real picture; a shared picture counts as done only when ALL its sizes have one; the second sheet explains how to use it', async () => {
  await q("UPDATE product_categories SET photo_url = '/uploads/real.jpg' WHERE id = 'zz-cp-a'"); await q("UPDATE category_parts SET photo_url = '/uploads/real.jpg' WHERE id IN ('zz-cp-p1', 'zz-cp-p3')");
  const wb = await shotList('?missingOnly=1'); const names = rowsOf(wb).map((r) => r['File name']).filter((n) => n.startsWith('ZQ'));
  assert.ok(!names.includes('ZQA.jpg') && !names.includes('ZQA-003.jpg')); assert.ok(names.includes('ZQB.jpg') && names.includes('ZQB-001.jpg') && names.includes('ZQA-001.jpg'), 'the oil row stays: ZQA-002 still has none');
  const how = wb.getWorksheet('How to use'); assert.ok(how.rowCount >= 6); assert.match(String(how.getRow(2).values[2]), /512/);
});

// ---- import
test('a part\'s picture (named by its code, any capitals) is kept, put on that part, and reported; the file is on disk', async () => {
  const [r] = track(await run([['zqa-003.png', makePng(512, 512)]])); assert.equal(r.status, 'saved'); assert.deepEqual(r.applied, ['ZQA-003']); assert.match(r.url, /^\/uploads\/[0-9a-f]{32}\.png$/);
  assert.equal(await photoOf('category_parts', 'zz-cp-p3'), r.url); assert.ok(onDisk(r.url)); assert.equal(await photoOf('category_parts', 'zz-cp-p4'), PH.part, 'other parts are untouched');
});
test('a section\'s picture, a JPEG, and "_" for "-" in the name all work', async () => {
  const results = track(await run([['ZQB.jpg', JPEG, 'image/jpeg'], ['zqb_001.png', makePng(512, 512)]])); assert.deepEqual(results.map((r) => r.status), ['saved', 'saved']);
  assert.match(await photoOf('product_categories', 'zz-cp-b'), /\.jpg$/); assert.equal(await photoOf('category_parts', 'zz-cp-p4'), results[1].url);
});
test('a picture for one size of a part is given to all its sizes (Engine Oil 1 L / 4 L / 5 L share one)', async () => {
  const [r] = track(await run([['ZQA-002.png', makePng(512, 512)]])); assert.deepEqual(r.applied, ['ZQA-001', 'ZQA-002']); assert.equal(await photoOf('category_parts', 'zz-cp-p1'), r.url); assert.equal(await photoOf('category_parts', 'zz-cp-p2'), r.url);
});
test('a part that already has a REAL picture is left alone (reported as kept); "replace" changes it; among shared sizes only the ones without a picture change', async () => {
  await q("UPDATE category_parts SET photo_url = '/uploads/real-old.jpg' WHERE id = 'zz-cp-p3'"); const [kept] = await run([['ZQA-003.png', makePng(512, 512)]]); assert.equal(kept.status, 'kept'); assert.equal(await photoOf('category_parts', 'zz-cp-p3'), '/uploads/real-old.jpg');
  const [replaced] = track(await run([['ZQA-003.png', makePng(512, 512)]], { replace: true, batchId: 'batch-test-0002' })); assert.equal(replaced.status, 'saved'); assert.equal(await photoOf('category_parts', 'zz-cp-p3'), replaced.url);
  await q("UPDATE category_parts SET photo_url = '/uploads/real-old.jpg' WHERE id = 'zz-cp-p1'"); const [mixed] = track(await run([['ZQA-002.png', makePng(512, 512)]], { batchId: 'batch-test-0003' }));
  assert.deepEqual(mixed.applied, ['ZQA-002']); assert.deepEqual(mixed.skipped, ['ZQA-001']); assert.equal(await photoOf('category_parts', 'zz-cp-p1'), '/uploads/real-old.jpg');
});
test('every kind of problem is reported for its own file, and the good files in the same request are still saved', async () => {
  const results = track(await run([['ZQA-003.png', makePng(512, 512)], ['ZZZ-999.png', makePng(512, 512)], ['holiday photo (1).jpg', makePng(512, 512)], ['ZQB.png', makePng(300, 300)], ['ZQB-001.png', Buffer.from('not a picture')], ['zqa-003.jpg', makePng(512, 512)], ['ZQA.png', makePng(513, 512)]]));
  assert.deepEqual(results.map((r) => r.status), ['saved', 'unknown_code', 'bad_name', 'wrong_size', 'not_image', 'duplicate', 'wrong_size']); assert.deepEqual([results[3].width, results[3].height], [300, 300]);
  assert.notEqual(await photoOf('category_parts', 'zz-cp-p3'), PH.part); assert.equal(await photoOf('product_categories', 'zz-cp-b'), PH.category);
});
test('refused outright: no pictures, no or odd batch id, more than 40 at a time', async () => {
  assert.equal((await importFiles([])).status, 400); assert.equal((await importFiles([['ZQA.png', makePng(512, 512)]], { batchId: 'x' })).status, 400); assert.equal((await importFiles([['ZQA.png', makePng(512, 512)]], { batchId: 'bad batch id!!' })).status, 400);
  const many = Array.from({ length: 41 }, (_, i) => [`ZQA-${String(i + 1).padStart(3, '0')}.png`, makePng(512, 512)]); const r = await importFiles(many); assert.equal(r.status, 400); assert.match((await r.json()).error, /At most 40/);
  assert.equal(await photoOf('category_parts', 'zz-cp-p3'), PH.part);
});

// ---- undo
const batches = async () => (await (await get('/batches')).json()).batches;
test('Undo puts everything of that import back as it was (the placeholders) and removes the pictures; a second Undo says it was already done', async () => {
  const results = track(await run([['ZQA.png', makePng(512, 512)], ['ZQA-002.png', makePng(512, 512)]], { batchId: 'undo-batch-0001' })); const urls = results.map((r) => r.url);
  assert.deepEqual((await batches()).map((b) => [b.id, b.count, b.undone]), [['undo-batch-0001', 3, false]]);
  const res = await fetch(A('/batches/undo-batch-0001/undo'), { method: 'POST', headers: auth(admin) }); assert.equal(res.status, 200); const out = await res.json(); assert.deepEqual([out.status, out.restored, out.changedSince], ['undone', 3, 0]);
  assert.equal(await photoOf('product_categories', 'zz-cp-a'), PH.category); assert.equal(await photoOf('category_parts', 'zz-cp-p1'), PH.part); assert.equal(await photoOf('category_parts', 'zz-cp-p2'), PH.part); assert.ok(urls.every((u) => !onDisk(u)), 'the pictures are gone from disk');
  assert.equal((await fetch(A('/batches/undo-batch-0001/undo'), { method: 'POST', headers: auth(admin) })).status, 409); assert.equal((await fetch(A('/batches/nope-nope-nope/undo'), { method: 'POST', headers: auth(admin) })).status, 404); assert.equal((await batches())[0].undone, true);
});
test('Undo restores a REPLACED picture to the one it replaced, and leaves alone anything changed since', async () => {
  await q("UPDATE category_parts SET photo_url = '/uploads/real-old.jpg' WHERE id = 'zz-cp-p3'"); const [r] = track(await run([['ZQA-003.png', makePng(512, 512)]], { replace: true, batchId: 'undo-batch-0002' }));
  await q("UPDATE category_parts SET photo_url = '/uploads/someone-else.jpg' WHERE id = 'zz-cp-p3'"); const out = await (await fetch(A('/batches/undo-batch-0002/undo'), { method: 'POST', headers: auth(admin) })).json();
  assert.deepEqual([out.restored, out.changedSince], [0, 1]); assert.equal(await photoOf('category_parts', 'zz-cp-p3'), '/uploads/someone-else.jpg');
  await q("UPDATE category_parts SET photo_url = '/uploads/real-old.jpg' WHERE id = 'zz-cp-p3'"); const [r2] = track(await run([['ZQA-003.png', makePng(512, 512)]], { replace: true, batchId: 'undo-batch-0003' })); await fetch(A('/batches/undo-batch-0003/undo'), { method: 'POST', headers: auth(admin) });
  assert.equal(await photoOf('category_parts', 'zz-cp-p3'), '/uploads/real-old.jpg'); assert.ok(!onDisk(r2.url));
});
test('Undo never deletes a picture that something else still uses', async () => {
  const [r] = track(await run([['ZQA-003.png', makePng(512, 512)]], { batchId: 'undo-batch-0004' })); await q("UPDATE category_parts SET photo_url = $1 WHERE id = 'zz-cp-p4'", [r.url]);
  const out = await (await fetch(A('/batches/undo-batch-0004/undo'), { method: 'POST', headers: auth(admin) })).json(); assert.equal(out.restored, 1); assert.equal(await photoOf('category_parts', 'zz-cp-p3'), PH.part); assert.ok(onDisk(r.url), 'the file stays: another part uses it'); assert.equal(await photoOf('category_parts', 'zz-cp-p4'), r.url);
});
test('an import sent in several requests with the same batch id is ONE import (one Undo), and only the last 5 imports are kept', async () => {
  track(await run([['ZQA.png', makePng(512, 512)]], { batchId: 'same-batch-0001' })); track(await run([['ZQB.png', makePng(512, 512)]], { batchId: 'same-batch-0001' })); assert.deepEqual((await batches()).map((b) => b.count), [2]);
  for (let i = 2; i <= 7; i++) track(await run([[`ZQA-00${i % 3 + 1}.png`, makePng(512, 512)]], { replace: true, batchId: `more-batch-000${i}` }));
  const list = await batches(); assert.equal(list.length, 5); assert.ok(!list.some((b) => b.id === 'same-batch-0001'), 'the oldest was dropped'); assert.equal(list[0].id, 'more-batch-0007');
});

// ---- the switch and the fallback
test('the switch is off at first, is changed only by an admin with true or false, and shows in the coverage', async () => {
  assert.equal((await (await get('/settings')).json()).fallback, false); assert.equal((await put('/settings', { fallback: 'yes' })).status, 400); assert.equal((await put('/settings', {})).status, 400);
  assert.equal((await (await put('/settings', { fallback: true })).json()).fallback, true); assert.equal((await (await get('/coverage')).json()).fallback, true); assert.equal((await (await put('/settings', { fallback: false })).json()).fallback, false);
});
const publicSections = async () => (await (await fetch(`${base}/catalog/categories`)).json()).filter((c) => c.id.startsWith('zz-cp-'));
const publicParts = async (id) => (await (await fetch(`${base}/catalog/categories/${id}/parts`)).json());
const addProduct = async (id, over = {}) => { await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status, rating, category, part) VALUES ($1, 'p', 1, 'USD', 's1', 1, $2, $3, $4, $5)", [id, over.status || 'active', over.rating ?? null, over.category || 'zz-cp-a', over.part === undefined ? 'Test Pad Set' : over.part]); for (const [i, url] of (over.images ?? [`/uploads/${id}-first.jpg`, `/uploads/${id}-second.jpg`]).entries()) await q('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [id, url, i === 0 ? 0 : 5]); };
test('fallback OFF: the website\'s lists show the placeholders exactly as before, even when products have photos', async () => {
  await addProduct('zz-cp-x1'); const sec = await publicSections(); assert.ok(sec.every((s) => s.photoUrl === PH.category)); assert.ok((await publicParts('zz-cp-a')).every((p) => p.photoUrl === PH.part));
});
test('fallback ON: a section or part with no real picture shows the first photo of its best-rated LIVE product; a real picture, a part with no product, and an inactive product change nothing', async () => {
  await addProduct('zz-cp-x1', { rating: 3 }); await addProduct('zz-cp-x2', { rating: 5 }); await addProduct('zz-cp-x3', { rating: 9, status: 'translating' }); await addProduct('zz-cp-x4', { part: 'Test Oil 1 L', rating: 1 });
  await addProduct('zz-cp-x5', { category: 'zz-cp-b', part: 'Other' }); await addProduct('zz-cp-x6', { part: 'Test Oil 4 L' }); await addProduct('zz-cp-x7', { category: 'zz-cp-b', part: 'Test Bulb', images: [] });
  await q("UPDATE product_categories SET photo_url = '/uploads/real-section.jpg' WHERE id = 'zz-cp-b'"); await q("UPDATE category_parts SET photo_url = '/uploads/real-part.jpg' WHERE id = 'zz-cp-p2'"); await put('/settings', { fallback: true });
  const sec = Object.fromEntries((await publicSections()).map((s) => [s.id, s.photoUrl])); assert.equal(sec['zz-cp-a'], '/uploads/zz-cp-x2-first.jpg', 'best LIVE rating wins (the 9 is not live), first photo by order'); assert.equal(sec['zz-cp-b'], '/uploads/real-section.jpg', 'a real section picture is kept even though a product has a photo');
  const parts = Object.fromEntries((await publicParts('zz-cp-a')).map((p) => [p.nameEn, p.photoUrl])); assert.equal(parts['Test Pad Set'], '/uploads/zz-cp-x2-first.jpg'); assert.equal(parts['Test Oil 1 L'], '/uploads/zz-cp-x4-first.jpg'); assert.equal(parts['Test Oil 4 L'], '/uploads/real-part.jpg', 'a real part picture is kept even though a product has a photo');
  assert.equal((await publicParts('zz-cp-b'))[0].photoUrl, PH.part, 'a product with no photo of its own gives nothing');
  await q("UPDATE category_parts SET photo_url = $1 WHERE id = 'zz-cp-p2'", [PH.part]); assert.equal((await publicParts('zz-cp-a')).find((p) => p.nameEn === 'Test Oil 4 L').photoUrl, '/uploads/zz-cp-x6-first.jpg');
});
test('fallback ON never touches the admin\'s own view (the coverage stays true) and turning it off puts everything back at once', async () => {
  await addProduct('zz-cp-x1'); await put('/settings', { fallback: true }); assert.equal((await publicSections()).find((s) => s.id === 'zz-cp-a').photoUrl, '/uploads/zz-cp-x1-first.jpg');
  const cov = await (await get('/coverage')).json(); assert.equal(cov.sections.find((s) => s.code === 'ZQA').hasPhoto, false); assert.equal(cov.parts.find((p) => p.code === 'ZQA-003').hasPhoto, false);
  await put('/settings', { fallback: false }); assert.equal((await publicSections()).find((s) => s.id === 'zz-cp-a').photoUrl, PH.category);
});
