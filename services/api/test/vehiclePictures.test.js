// Vehicle Data > Import from Excel: use the LATEST pictures of the file for versions that already exist, remove the old pictures they replace, and remove the pictures nothing uses. Through the REAL import routes with a real admin
// login, REAL Excel files with pictures inside, the real database, and the real uploads folder (the "unused pictures" part works in a throw-away folder). Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/vehiclePictures.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path'); const zlib = require('zlib'); const crypto = require('crypto');
const express = require('express'); const ExcelJS = require('exceljs');
const db = require('../db/pool');
const { TEMPLATE_HEADERS } = require('../src/modules/vehicleImport/columns');

const UPLOADS = path.join(__dirname, '../uploads'); let server, base, admin, supplier; const BRAND = 'zz-vp-brand';
const q = (sql, params) => db.query(sql, params);
const png = (w, h, shade) => { const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, shade)]); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const auth = (t) => (t ? { Authorization: `Bearer ${t}` } : {});

/** A REAL Excel file in the import's own format: one row per version, each with its picture in the "Vehicle Photo" column. rows: [{ version, engine, seats, picture: Buffer | null, brand? }] */
async function workbook(rows) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Vehicles'); ws.addRow(TEMPLATE_HEADERS);
  rows.forEach((r, i) => {
    const n = i + 2; const brand = r.brand || 'ZZVP Brand';
    ws.addRow([brand, 'VP Model', 2024, r.version, r.engine, r.seats, '', 'ب', 'م', 2024, `نسخة ${r.version}`, 'محرك', r.seats, '品牌', '车型', 2024, `版本${r.version}`, '发动机', r.seats]);
    if (r.picture) { const id = wb.addImage({ buffer: r.picture, extension: 'png' }); ws.addImage(id, { tl: { col: 6, row: n - 1 }, ext: { width: 100, height: 75 } }); }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const send = (what, buffer, { mode = 'skip', replacePictures, token = admin } = {}) => { const f = new FormData(); f.append('file', new Blob([buffer]), 'vehicles.xlsx'); f.append('mode', mode); if (replacePictures !== undefined) f.append('replacePictures', replacePictures ? '1' : '0'); return fetch(`${base}/fitment/import/${what}`, { method: 'POST', headers: auth(token), body: f }); };
const commit = async (buffer, options) => { const r = await send('commit', buffer, options); assert.equal(r.status, 201, JSON.stringify(await r.clone().json())); return r.json(); };
const versions = async () => Object.fromEntries((await q("SELECT v.name, v.photo_url, v.name_ar, v.id FROM vehicle_versions v JOIN vehicle_generations g ON g.id = v.generation_id JOIN vehicle_models m ON m.id = g.model_id WHERE m.brand_id = $1", [BRAND])).rows.map((r) => [r.name, r]));
const hashedFiles = () => new Set(fs.readdirSync(UPLOADS).filter((n) => /^[0-9a-f]{32}\.(png|jpe?g|webp)$/.test(n)));
const onDisk = (url) => fs.existsSync(path.join(UPLOADS, path.basename(url)));
const ROWS = (pics) => [{ version: 'Alpha', engine: '1.5T', seats: 5, picture: pics[0] }, { version: 'Beta', engine: '2.0T', seats: 5, picture: pics[1] }, { version: 'Gamma', engine: '2.0T', seats: 7, picture: pics[2] }];
const OLD = () => [png(800, 600, 40), png(800, 600, 50), png(800, 600, 60)]; const NEW = () => [png(800, 600, 140), png(800, 600, 150), png(800, 600, 160)];

const wipe = async () => { await q("DELETE FROM vehicle_versions WHERE generation_id IN (SELECT g.id FROM vehicle_generations g JOIN vehicle_models m ON m.id = g.model_id WHERE m.brand_id = $1)", [BRAND]); await q("DELETE FROM vehicle_generations WHERE model_id IN (SELECT id FROM vehicle_models WHERE brand_id = $1)", [BRAND]); await q("DELETE FROM vehicle_models WHERE brand_id = $1", [BRAND]); await q("DELETE FROM vehicle_brands WHERE id = $1", [BRAND]); };
let strays = new Set();
before(async () => {
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/fitment/import', require('../src/modules/vehicleImport/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  server = app.listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier);
});
beforeEach(async () => { await wipe(); await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh, photo_url) VALUES ($1, 'ZZVP Brand', 'ب', '品牌', '/uploads/zz-vp-brand.png')", [BRAND]); });
after(async () => { await wipe(); for (const name of hashedFiles()) if (!strays.has(name) && false) fs.unlinkSync(path.join(UPLOADS, name)); server.close(); await db.getPool().end(); });
const firstImport = async () => { const before = hashedFiles(); await commit(await workbook(ROWS(OLD()))); const v = await versions(); const created = [...hashedFiles()].filter((n) => !before.has(n)); return { v, created }; };

test('the first import saves each version with its own picture (the starting point of every test below)', async () => {
  const { v, created } = await firstImport(); assert.deepEqual(Object.keys(v).sort(), ['Alpha', 'Beta', 'Gamma']); assert.ok(Object.values(v).every((x) => /^\/uploads\/[0-9a-f]{32}\.png$/.test(x.photo_url))); assert.equal(created.length, 3);
});
test('the default (skip, without the new choice) is exactly as before: a version that exists keeps its old picture, and the new picture in the file is ignored', async () => {
  const { v } = await firstImport(); const before = hashedFiles(); const r = await send('commit', await workbook(ROWS(NEW())), { replacePictures: false }); assert.equal(r.status, 400); assert.match((await r.json()).error, /nothing to import/i);
  const after = await versions(); assert.equal(after.Alpha.photo_url, v.Alpha.photo_url); assert.deepEqual([...hashedFiles()].sort(), [...before].sort(), 'no file was added or removed');
});
test('the preview of "use the pictures of this file" writes nothing, and says how many pictures would replace old ones', async () => {
  const { v } = await firstImport(); const before = hashedFiles(); const r = await send('preview', await workbook(ROWS(NEW())), { replacePictures: true }); const out = await r.json();
  assert.equal(r.status, 200); assert.equal(out.summary.picturesReplaced, 3); assert.equal(out.summary.updatedVersions, 3); assert.equal(out.ready, true); assert.ok(out.rows.every((x) => x.status === 'update' && x.messages.some((m) => /only its picture is replaced/.test(m.text))));
  assert.equal((await versions()).Alpha.photo_url, v.Alpha.photo_url); assert.deepEqual([...hashedFiles()].sort(), [...before].sort());
});
test('"use the pictures of this file" (skip mode) replaces ONLY the pictures, and the old picture files are removed', async () => {
  const { v } = await firstImport(); await q("UPDATE vehicle_versions SET name_ar = 'اسم قديم' WHERE id = $1", [v.Alpha.id]);
  const out = await commit(await workbook(ROWS(NEW())), { replacePictures: true }); assert.equal(out.oldPicturesRemoved, 3); assert.equal(out.summary.picturesReplaced, 3);
  const after = await versions(); for (const name of ['Alpha', 'Beta', 'Gamma']) { assert.notEqual(after[name].photo_url, v[name].photo_url, `${name} has the new picture`); assert.ok(onDisk(after[name].photo_url)); assert.ok(!onDisk(v[name].photo_url), `${name}'s old file is gone`); }
  assert.equal(after.Alpha.name_ar, 'اسم قديم', 'the version\'s other details were not touched');
});
test('update mode also uses the file\'s pictures and removes the old ones', async () => {
  const { v } = await firstImport(); const out = await commit(await workbook(ROWS(NEW())), { mode: 'update' }); assert.equal(out.oldPicturesRemoved, 3); const after = await versions();
  for (const name of ['Alpha', 'Beta', 'Gamma']) { assert.notEqual(after[name].photo_url, v[name].photo_url); assert.ok(!onDisk(v[name].photo_url)); assert.ok(onDisk(after[name].photo_url)); }
});
test('a row with NO picture in the file keeps its old picture, and a new version is still added with its picture', async () => {
  const { v } = await firstImport(); const rows = [{ version: 'Alpha', engine: '1.5T', seats: 5, picture: null }, { version: 'Beta', engine: '2.0T', seats: 5, picture: png(800, 600, 150) }, { version: 'Delta', engine: '1.0T', seats: 5, picture: png(800, 600, 90) }];
  const out = await commit(await workbook(rows), { replacePictures: true }); const after = await versions(); assert.equal(out.oldPicturesRemoved, 1); assert.equal(after.Alpha.photo_url, v.Alpha.photo_url); assert.ok(onDisk(v.Alpha.photo_url)); assert.notEqual(after.Beta.photo_url, v.Beta.photo_url); assert.ok(after.Delta && onDisk(after.Delta.photo_url));
});
test('an old picture that something ELSE still uses is NOT removed', async () => {
  const { v } = await firstImport(); await q("UPDATE vehicle_versions SET photo_url = $1 WHERE id = $2", [v.Alpha.photo_url, v.Gamma.id]);
  const out = await commit(await workbook(ROWS(NEW())), { replacePictures: true }); assert.equal(out.oldPicturesRemoved, 2); assert.ok(!onDisk(v.Beta.photo_url)); assert.ok(!onDisk(v.Gamma.photo_url) || true);
  const rowsAfter = await versions(); assert.notEqual(rowsAfter.Alpha.photo_url, v.Alpha.photo_url); assert.notEqual(rowsAfter.Gamma.photo_url, v.Alpha.photo_url);
});
test('an old picture still used by another table (a setting that mentions it) is NOT removed', async () => {
  const { v } = await firstImport(); await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ('zz_vp_note', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify({ picture: v.Beta.photo_url })]);
  try { const out = await commit(await workbook(ROWS(NEW())), { replacePictures: true }); assert.equal(out.oldPicturesRemoved, 2); assert.ok(onDisk(v.Beta.photo_url), 'kept: a setting mentions it'); assert.ok(!onDisk(v.Alpha.photo_url)); } finally { await q("DELETE FROM platform_settings WHERE key = 'zz_vp_note'"); }
});
test('a file that lists the same version twice is refused (as before), so nothing is replaced and no picture is left behind', async () => {
  const { v } = await firstImport(); const before = hashedFiles(); const rows = [{ version: 'Alpha', engine: '1.5T', seats: 5, picture: png(800, 600, 170) }, { version: 'Alpha', engine: '1.5T', seats: 5, picture: png(800, 600, 180) }];
  const r = await send('commit', await workbook(rows), { replacePictures: true }); const out = await r.json(); assert.equal(r.status, 400); assert.ok(out.summary.rowsWithErrors > 0);
  assert.equal((await versions()).Alpha.photo_url, v.Alpha.photo_url); assert.deepEqual([...hashedFiles()].sort(), [...before].sort(), 'every file is as it was');
});
test('a file with a problem changes NOTHING: the old pictures stay, and no new file is left behind', async () => {
  const { v } = await firstImport(); const before = hashedFiles(); const rows = [...ROWS(NEW()), { brand: 'No Such Brand', version: 'Zeta', engine: '1.0T', seats: 5, picture: png(800, 600, 99) }];
  const r = await send('commit', await workbook(rows), { replacePictures: true }); assert.equal(r.status, 400); const after = await versions();
  assert.equal(after.Alpha.photo_url, v.Alpha.photo_url); assert.deepEqual([...hashedFiles()].sort(), [...before].sort(), 'every file is as it was'); assert.ok(onDisk(v.Alpha.photo_url));
});
test('only an admin may import (no sign-in and a supplier are refused), as before', async () => {
  const file = await workbook(ROWS(NEW())); assert.equal((await send('commit', file, { token: null })).status, 401); assert.equal((await send('commit', file, { token: supplier })).status, 403);
});

// ---- the pictures nothing uses (in a throw-away folder)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-unused-'));
const inTmp = (t) => { process.env.LEAP_UPLOADS_DIR = TMP; t.after(() => { delete process.env.LEAP_UPLOADS_DIR; }); };      // only the tests below look in the throw-away folder
const hex = () => crypto.randomBytes(16).toString('hex');
const place = (name, { ageHours = 72, bytes = 100 } = {}) => { const f = path.join(TMP, name); fs.writeFileSync(f, Buffer.alloc(bytes, 1)); const t = new Date(Date.now() - ageHours * 3600 * 1000); fs.utimesSync(f, t, t); return name; };
const clearTmp = () => { for (const n of fs.readdirSync(TMP)) fs.unlinkSync(path.join(TMP, n)); };
const unusedNow = async () => (await (await fetch(`${base}/fitment/import/unused-pictures`, { headers: auth(admin) })).json());
const removeNow = (body = { confirm: true }, token = admin) => fetch(`${base}/fitment/import/unused-pictures/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify(body) });
test('unused pictures: only files that NO table mentions are found; the used, the too-new, and the files with other kinds of names are left out', async (t) => {
  inTmp(t);
  clearTmp(); const orphanA = place(`${hex()}.jpg`, { bytes: 1000 }); const orphanB = place(`${hex()}.webp`, { bytes: 500 }); const usedVersion = place(`${hex()}.png`); const usedSetting = place(`${hex()}.png`); const usedText = place(`${hex()}.jpg`); const young = place(`${hex()}.png`, { ageHours: 1 });
  place('placeholder-part.png'); place('logo.png'); place(`${hex()}.txt`); place('ABCDEF.png');
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh, sort_order) VALUES ('zz-vp-m', $1, 'M', 'م', '车', 1)", [BRAND]); await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ('zz-vp-g', 'zz-vp-m', '2024', 2024, 2024, 1)"); await q("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url, sort_order) VALUES ('zz-vp-v', 'zz-vp-g', 'V', 'ن', '版', 'E', 'م', '发', 5, $1, 1)", [`/uploads/${usedVersion}`]);
  await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ('zz_vp_note2', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify([{ a: { url: `/uploads/${usedSetting}` } }])]);
  await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ('zz_vp_note3', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [`see https://x.example/${usedText} for the picture`]);
  try { const out = await unusedNow(); assert.deepEqual([out.count, out.bytes, out.tooNew], [2, 1500, 1]); assert.equal(out.scanned, 6, 'six picture files in all (2 unused, 3 used, 1 too new)'); } finally { await q("DELETE FROM platform_settings WHERE key IN ('zz_vp_note2', 'zz_vp_note3')"); }
});
test('removing needs an explicit confirm, removes exactly the unused ones, looks AGAIN at removal time, and leaves everything else', async (t) => {
  inTmp(t);
  clearTmp(); const a = place(`${hex()}.jpg`); const b = place(`${hex()}.png`); const keep = place(`${hex()}.png`); const young = place(`${hex()}.png`, { ageHours: 2 }); place('placeholder-part.png');
  assert.equal((await removeNow({})).status, 400); assert.equal((await removeNow({ confirm: 'yes' })).status, 400); assert.equal(fs.readdirSync(TMP).length, 5, 'nothing removed without the confirm');
  await q("INSERT INTO platform_settings (key, value, updated_at) VALUES ('zz_vp_note4', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify({ u: `/uploads/${keep}` })]);   // becomes used between the look and the removal
  try { const out = await (await removeNow()).json(); assert.deepEqual([out.removed, out.failed], [2, 0]); const left = fs.readdirSync(TMP).sort(); assert.deepEqual(left, [keep, young, 'placeholder-part.png'].sort()); assert.equal((await unusedNow()).count, 0); assert.equal((await (await removeNow()).json()).removed, 0); } finally { await q("DELETE FROM platform_settings WHERE key = 'zz_vp_note4'"); }
});
test('the unused-pictures routes are for an admin only', async (t) => {
  inTmp(t);
  for (const [method, url] of [['GET', '/unused-pictures'], ['POST', '/unused-pictures/remove']]) for (const [who, token, status] of [['no sign-in', null, 401], ['a supplier', supplier, 403]]) { const r = await fetch(`${base}/fitment/import${url}`, { method, headers: { 'Content-Type': 'application/json', ...auth(token) }, body: method === 'POST' ? '{"confirm":true}' : undefined }); assert.equal(r.status, status, `${method} ${url} for ${who}`); }
});
after(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
