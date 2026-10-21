// The four home page pictures, through the REAL routes (/platform-settings/home-pictures) with real admin and supplier logins, real multipart uploads and the real database and uploads folder. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/homePictures.test.js
// (it refuses to run on a database whose name does not end in "_test", and removes what it creates.)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');

const KEY = 'storefront_home_pictures';
const UPLOADS = path.join(__dirname, '../uploads');
let server, base, admin, supplier;
const made = new Set();

/** A real, valid PNG of one colour (written with zlib, so no image library is needed). */
function makePng(w, h) {
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x7f)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
const JPEG = fs.readFileSync(path.join(__dirname, 'fixtures/home-picture-600.jpg'));
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const put = (slot, bytes, type, token = admin) => { const f = new FormData(); if (bytes) f.append('image', new Blob([bytes], { type }), 'x'); return fetch(`${base}/platform-settings/home-pictures/${slot}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: f }); };
const del = (slot, token = admin) => fetch(`${base}/platform-settings/home-pictures/${slot}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
const get = async () => (await (await fetch(`${base}/platform-settings/home-pictures`)).json());
const onDisk = (url) => fs.existsSync(path.join(UPLOADS, path.basename(url)));
const upload = async (slot, bytes = makePng(600, 600), type = 'image/png') => { const res = await put(slot, bytes, type); assert.equal(res.status, 200, JSON.stringify(await res.clone().json())); const body = await res.json(); made.add(body.url); return body; };

before(async () => { server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier); });
beforeEach(async () => { await db.query('DELETE FROM platform_settings WHERE key = $1', [KEY]); });
after(async () => { await db.query('DELETE FROM platform_settings WHERE key = $1', [KEY]); for (const url of made) try { fs.unlinkSync(path.join(UPLOADS, path.basename(url))); } catch { /* already removed */ } server.close(); await db.getPool().end(); });

test('before anything is uploaded all four are empty (the website then shows its icons), and anyone may read them', async () => {
  const res = await fetch(`${base}/platform-settings/home-pictures`); assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).pictures, { parts: null, brands: null, models: null, countries: null }); assert.match(res.headers.get('cache-control') || '', /max-age=30/);
});

test('only an admin may change them: no sign-in is refused, and so is a supplier', async () => {
  assert.equal((await put('parts', makePng(600, 600), 'image/png', null)).status, 401); assert.equal((await put('parts', makePng(600, 600), 'image/png', supplier)).status, 403);
  assert.equal((await del('parts', null)).status, 401); assert.equal((await del('parts', supplier)).status, 403);
  assert.deepEqual((await get()).pictures.parts, null);
});

test('an admin uploads a 600 x 600 PNG: it is kept, shown to everyone, and on disk', async () => {
  const body = await upload('parts');
  assert.equal(body.slot, 'parts'); assert.match(body.url, /^\/uploads\/[0-9a-f]{32}\.png$/); assert.ok(onDisk(body.url));
  assert.equal((await get()).pictures.parts, body.url);
});

test('a 600 x 600 JPEG (what the admin screen makes) is accepted too', async () => {
  const body = await upload('models', JPEG, 'image/jpeg'); assert.match(body.url, /\.jpg$/); assert.ok(onDisk(body.url));
});

test('each picture is separate: setting one leaves the others, and replacing one removes its old file', async () => {
  const parts = await upload('parts'); const brands = await upload('brands'); const parts2 = await upload('parts');
  const pictures = (await get()).pictures;
  assert.equal(pictures.parts, parts2.url); assert.equal(pictures.brands, brands.url); assert.equal(pictures.models, null); assert.equal(pictures.countries, null);
  assert.ok(!onDisk(parts.url), 'the replaced picture is gone from disk'); assert.ok(onDisk(parts2.url)); assert.ok(onDisk(brands.url));
});

test('two admins changing different pictures at the same moment do not overwrite each other', async () => {
  const [a, b] = await Promise.all([put('models', makePng(600, 600), 'image/png'), put('countries', makePng(600, 600), 'image/png')]);
  const [x, y] = [await a.json(), await b.json()]; made.add(x.url); made.add(y.url);
  const pictures = (await get()).pictures; assert.equal(pictures.models, x.url); assert.equal(pictures.countries, y.url);
});

test('a picture that is not exactly 600 x 600 is refused, with the real size in the message', async () => {
  for (const [w, h] of [[599, 600], [600, 599], [800, 800], [400, 400], [1200, 600]]) {
    const res = await put('parts', makePng(w, h), 'image/png'); assert.equal(res.status, 400, `${w}x${h}`);
    assert.match((await res.json()).error, /600|resolution/i, `${w}x${h}`);
  }
  assert.equal((await get()).pictures.parts, null);
});

test('things that are not a picture are refused: text, a missing file, a file over 10 MB, a damaged picture, and an unknown picture name', async () => {
  assert.equal((await put('parts', Buffer.from('hello'), 'image/png')).status, 400, 'text pretending to be a PNG');
  assert.equal((await put('parts', Buffer.from('hello'), 'text/plain')).status, 400, 'a text file');
  assert.equal((await put('parts', null)).status, 400, 'no file at all');
  const big = await put('parts', Buffer.concat([makePng(600, 600), Buffer.alloc(11 * 1024 * 1024)]), 'image/png'); assert.equal(big.status, 400); assert.match((await big.json()).error, /10 MB/);
  const png = makePng(600, 600); assert.equal((await put('parts', png.subarray(0, png.length - 20), 'image/png')).status, 400, 'a cut-off PNG');
  assert.equal((await put('wheels', makePng(600, 600), 'image/png')).status, 404); assert.equal((await del('wheels')).status, 404);
  assert.deepEqual((await get()).pictures, { parts: null, brands: null, models: null, countries: null });
});

test('removing a picture brings the icon back: the slot is emptied, its file is deleted, the others stay', async () => {
  const parts = await upload('parts'); const brands = await upload('brands');
  const res = await del('parts'); assert.equal(res.status, 200); assert.equal((await res.json()).url, null);
  const pictures = (await get()).pictures; assert.equal(pictures.parts, null); assert.equal(pictures.brands, brands.url);
  assert.ok(!onDisk(parts.url)); assert.ok(onDisk(brands.url));
  assert.equal((await del('parts')).status, 200, 'removing an empty slot is harmless');
});

test('a damaged stored value never breaks the website: it simply reads as no pictures', async () => {
  await db.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, 'not json at all', now())", [KEY]);
  assert.deepEqual((await get()).pictures, { parts: null, brands: null, models: null, countries: null });
  const body = await upload('brands'); assert.equal((await get()).pictures.brands, body.url);
});
