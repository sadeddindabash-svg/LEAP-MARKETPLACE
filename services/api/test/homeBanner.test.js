// The home page banner, through the REAL routes (/platform-settings/home-banner) with real admin and supplier logins, real multipart uploads and the real database and uploads folder. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/homeBanner.test.js
// (it refuses to run on a database whose name does not end in "_test", and puts back what it changes.)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');

const KEY = 'storefront_home_banner'; const UPLOADS = path.join(__dirname, '../uploads');
let server, base, admin, supplier, saved; const q = (sql, params) => db.query(sql, params);

/** A real, valid PNG of one colour (written with zlib, so no image library is needed). */
function makePng(w, h, grey = 0x7f) {
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, grey)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
const GOOD = (n = 0x7f) => makePng(1250, 500, n);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const call = async (method, url, body, token = admin) => { const r = await fetch(`${base}/platform-settings/home-banner${url}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }); return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) }; };
const photo = async (id, lang, bytes, type = 'image/png', token = admin) => { const f = new FormData(); if (bytes) f.append('image', new Blob([bytes], { type }), 'x'); const r = await fetch(`${base}/platform-settings/home-banner/slides/${id}/image/${lang}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: f }); return { status: r.status, body: await r.json().catch(() => null) }; };
const addSlide = async (body = {}) => (await call('POST', '/slides', body)).body.slide;
const onDisk = (url) => fs.existsSync(path.join(UPLOADS, path.basename(url)));
const uploadsCount = () => fs.readdirSync(UPLOADS).length;
const setRaw = (v) => q("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [KEY, v]);

before(async () => {
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier);
  saved = (await q('SELECT value FROM platform_settings WHERE key = $1', [KEY])).rows[0]; await q("INSERT INTO products (id, name, price, currency_code, category, part, weight_kg, length_cm, width_cm, height_cm) VALUES ('zz-hb-part', 'zz hb', 5, 'USD', 'zz-hb-cat', 'zz', 1, 1, 1, 1) ON CONFLICT (id) DO NOTHING");
  await q("INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ('zz-hb-cat', 'ZZ HB', 'ع', '/uploads/placeholder-category.png', 9000) ON CONFLICT (id) DO NOTHING");
});
beforeEach(async () => { await call('GET', '/admin'); const s = await call('GET', '/admin'); for (const x of s.body.slides) await call('DELETE', `/slides/${x.id}`); await call('PUT', '/mode', { mode: 'headline' }); });
after(async () => {
  const s = await call('GET', '/admin'); for (const x of s.body.slides) await call('DELETE', `/slides/${x.id}`);
  if (saved) await setRaw(saved.value); else await q('DELETE FROM platform_settings WHERE key = $1', [KEY]);
  await q("DELETE FROM products WHERE id = 'zz-hb-part'"); await q("DELETE FROM product_categories WHERE id = 'zz-hb-cat'"); await q("DELETE FROM admin_audit_log WHERE action LIKE 'home_banner_%'");
  server.close(); await db.getPool().end();
});

test('nothing stored yet: the website gets the headline and no slides; the admin sees the limits; reading needs no sign-in and is cached briefly', async () => {
  await q('DELETE FROM platform_settings WHERE key = $1', [KEY]); const pub = await call('GET', '', undefined, null); assert.equal(pub.status, 200); assert.deepEqual(pub.body, { mode: 'headline', slides: [], width: 1250, height: 500 }); assert.match(pub.headers.get('cache-control'), /max-age=30/);
  const adm = await call('GET', '/admin'); assert.equal(adm.body.mode, 'headline'); assert.deepEqual(adm.body.limits, { maxSlides: 10, minSeconds: 2, maxSeconds: 30, defaultSeconds: 5, width: 1250, height: 500, maxAlt: 140 });
});
test('only an admin can change anything or read the admin view: no sign-in is refused, and so is a supplier', async () => {
  const s = await addSlide(); const tries = [['GET', '/admin'], ['PUT', '/mode', { mode: 'banner' }], ['PUT', '/order', { ids: [s.id] }], ['POST', '/slides', {}], ['PUT', `/slides/${s.id}`, { seconds: 5 }], ['DELETE', `/slides/${s.id}`], ['DELETE', `/slides/${s.id}/image/en`]];
  for (const [m, u, b] of tries) { assert.equal((await call(m, u, b, null)).status, 401, `${m} ${u} without sign-in`); assert.equal((await call(m, u, b, supplier)).status, 403, `${m} ${u} as a supplier`); }
  assert.equal((await photo(s.id, 'en', GOOD(), 'image/png', null)).status, 401); assert.equal((await photo(s.id, 'en', GOOD(), 'image/png', supplier)).status, 403);
  assert.equal((await call('GET', '/admin')).body.slides.length, 1, 'nothing changed'); assert.equal((await call('GET', '/admin')).body.mode, 'headline');
});
test('a new slide starts with 5 seconds, no link, no photo: the website does not show it, and "banner" falls back to the headline until it has a photo', async () => {
  const s = await addSlide(); assert.deepEqual([s.seconds, s.link, s.imageEn, s.imageAr, s.altEn, s.altAr], [5, { type: 'none', value: '' }, null, null, '', '']);
  await call('PUT', '/mode', { mode: 'banner' }); const pub = (await call('GET', '', undefined, null)).body; assert.equal(pub.mode, 'headline'); assert.deepEqual(pub.slides, []); assert.equal((await call('GET', '/admin')).body.mode, 'banner', 'the admin still sees what was chosen');
});
test('an English photo makes the slide public and the banner effective; the missing Arabic photo is null (the website falls back to the English one); the public view has exactly the fields it needs', async () => {
  const s = await addSlide({ seconds: 7, altEn: ' Summer sale ', altAr: 'تخفيضات' }); const up = await photo(s.id, 'en', GOOD()); assert.equal(up.status, 200, JSON.stringify(up.body)); assert.match(up.body.slide.imageEn, /^\/uploads\/[0-9a-f]{32}\.png$/); assert.ok(onDisk(up.body.slide.imageEn));
  await call('PUT', '/mode', { mode: 'banner' }); const pub = (await call('GET', '', undefined, null)).body; assert.equal(pub.mode, 'banner'); assert.equal(pub.slides.length, 1);
  assert.deepEqual(Object.keys(pub.slides[0]).sort(), ['altAr', 'altEn', 'id', 'imageAr', 'imageEn', 'link', 'seconds']); assert.equal(pub.slides[0].imageAr, null); assert.equal(pub.slides[0].altEn, 'Summer sale'); assert.equal(pub.slides[0].seconds, 7);
  const ar = await photo(s.id, 'ar', GOOD(0x30)); assert.equal(ar.status, 200); assert.notEqual(ar.body.slide.imageAr, ar.body.slide.imageEn); assert.ok(onDisk(ar.body.slide.imageAr));
});
test('only an Arabic photo is enough too', async () => { const s = await addSlide(); await photo(s.id, 'ar', GOOD()); await call('PUT', '/mode', { mode: 'banner' }); const pub = (await call('GET', '', undefined, null)).body; assert.equal(pub.mode, 'banner'); assert.equal(pub.slides[0].imageEn, null); assert.ok(pub.slides[0].imageAr); });
test('a photo that is not exactly 1250 x 500, not a picture, damaged, missing or for an unknown slide or language is refused, and no file is left behind', async () => {
  const s = await addSlide(); const before = uploadsCount();
  const small = await photo(s.id, 'en', makePng(600, 600)); assert.equal(small.status, 400); assert.match(small.body.error, /Image resolution too low|exactly 1250 x 500/);
  const wrong = await photo(s.id, 'en', makePng(1250, 600)); assert.equal(wrong.status, 400); assert.match(wrong.body.error, /exactly 1250 x 500 px \(it is 1250 x 600\)/); assert.equal((await photo(s.id, 'en', makePng(1500, 500))).status, 400);
  assert.equal((await photo(s.id, 'en', Buffer.from('not a picture'), 'image/png')).status, 400); assert.equal((await photo(s.id, 'en', Buffer.from('hello'), 'text/plain')).status, 400); assert.equal((await photo(s.id, 'en', GOOD().subarray(0, 300))).status, 400);
  assert.equal((await photo(s.id, 'en', null)).status, 400); assert.equal((await photo('no-such-slide', 'en', GOOD())).status, 404); assert.equal((await photo(s.id, 'fr', GOOD())).status, 404);
  assert.equal(uploadsCount(), before, 'no stray file'); assert.equal((await call('GET', '/admin')).body.slides[0].imageEn, null);
});
test('replacing a photo deletes the old file; removing a photo deletes its file; removing a slide deletes both of its files', async () => {
  const s = await addSlide(); const a = (await photo(s.id, 'en', GOOD(10))).body.slide.imageEn; const b = (await photo(s.id, 'en', GOOD(20))).body.slide.imageEn; assert.notEqual(a, b); assert.ok(!onDisk(a), 'the replaced file is gone'); assert.ok(onDisk(b));
  const ar = (await photo(s.id, 'ar', GOOD(30))).body.slide.imageAr; const rm = await call('DELETE', `/slides/${s.id}/image/en`); assert.equal(rm.status, 200); assert.equal(rm.body.slide.imageEn, null); assert.ok(!onDisk(b)); assert.ok(onDisk(ar), 'the Arabic photo stays');
  const en2 = (await photo(s.id, 'en', GOOD(40))).body.slide.imageEn; assert.equal((await call('DELETE', `/slides/${s.id}`)).status, 200); assert.ok(!onDisk(ar) && !onDisk(en2)); assert.equal((await call('GET', '/admin')).body.slides.length, 0); assert.equal((await call('DELETE', `/slides/${s.id}`)).status, 404);
});
test('seconds: a whole number from 2 to 30 only', async () => {
  const s = await addSlide(); for (const v of [2, 30, 5, '12']) assert.equal((await call('PUT', `/slides/${s.id}`, { seconds: v })).status, 200, String(v)); assert.equal((await call('GET', '/admin')).body.slides[0].seconds, 12);
  for (const v of [1, 31, 0, -3, 2.5, 'abc', null, '', NaN]) assert.equal((await call('PUT', `/slides/${s.id}`, { seconds: v })).status, 400, String(v)); assert.equal((await call('POST', '/slides', { seconds: 1 })).status, 400); assert.equal((await call('GET', '/admin')).body.slides[0].seconds, 12);
});
test('a link to a part or a category must exist; a web page must be a full http(s) address; anything else is refused and nothing is stored', async () => {
  const s = await addSlide(); const set = (link) => call('PUT', `/slides/${s.id}`, { link });
  assert.equal((await set({ type: 'part', value: 'zz-hb-part' })).status, 200); assert.equal((await set({ type: 'category', value: 'zz-hb-cat' })).status, 200); assert.equal((await set({ type: 'url', value: 'https://example.com/sale?x=1' })).status, 200); assert.equal((await set({ type: 'url', value: 'http://example.com' })).status, 200);
  for (const bad of [{ type: 'part', value: 'no-such-part' }, { type: 'category', value: 'no-such' }, { type: 'part', value: '' }, { type: 'url', value: 'javascript:alert(1)' }, { type: 'url', value: 'ftp://example.com' }, { type: 'url', value: '/relative' }, { type: 'url', value: 'example.com' }, { type: 'url', value: 'data:text/html,x' }, { type: 'url', value: 'https://example.com/' + 'a'.repeat(500) }, { type: 'teleport', value: 'x' }, 'text', 5]) assert.equal((await set(bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  assert.deepEqual((await call('GET', '/admin')).body.slides[0].link, { type: 'url', value: 'http://example.com' }, 'the last good link is still there'); assert.deepEqual((await set({ type: 'none' })).body.slide.link, { type: 'none', value: '' }); assert.deepEqual((await set(null)).body.slide.link, { type: 'none', value: '' });
});
test('descriptions are trimmed and at most 140 characters', async () => { const s = await addSlide(); assert.equal((await call('PUT', `/slides/${s.id}`, { altEn: '  Sale  ' })).body.slide.altEn, 'Sale'); assert.equal((await call('PUT', `/slides/${s.id}`, { altAr: 'x'.repeat(141) })).status, 400); assert.equal((await call('PUT', `/slides/${s.id}`, { altEn: 5 })).status, 400); assert.equal((await call('PUT', `/slides/${s.id}`, { altAr: 'x'.repeat(140) })).status, 200); });
test('only what is sent changes: changing the seconds leaves the link and the photos alone', async () => {
  const s = await addSlide({ link: { type: 'part', value: 'zz-hb-part' }, altEn: 'A' }); await photo(s.id, 'en', GOOD()); const r = await call('PUT', `/slides/${s.id}`, { seconds: 9 }); assert.equal(r.body.slide.seconds, 9); assert.deepEqual(r.body.slide.link, { type: 'part', value: 'zz-hb-part' }); assert.equal(r.body.slide.altEn, 'A'); assert.ok(r.body.slide.imageEn); assert.equal((await call('PUT', '/slides/nope', { seconds: 5 })).status, 404);
});
test('at most 10 slides: the 11th is refused, and a place is free again after deleting one', async () => {
  const made = []; for (let i = 0; i < 10; i++) { const r = await call('POST', '/slides', {}); assert.equal(r.status, 201); made.push(r.body.slide.id); } const eleven = await call('POST', '/slides', {}); assert.equal(eleven.status, 409); assert.match(eleven.body.error, /at most 10/); assert.equal((await call('GET', '/admin')).body.slides.length, 10);
  await call('DELETE', `/slides/${made[3]}`); assert.equal((await call('POST', '/slides', {})).status, 201);
});
test('the order: a full re-listing is accepted and shown to the website in that order; anything else is refused', async () => {
  const [a, b, c] = [await addSlide(), await addSlide(), await addSlide()]; for (const s of [a, b, c]) await photo(s.id, 'en', GOOD()); await call('PUT', '/mode', { mode: 'banner' });
  assert.equal((await call('PUT', '/order', { ids: [c.id, a.id, b.id] })).status, 200); assert.deepEqual((await call('GET', '', undefined, null)).body.slides.map((s) => s.id), [c.id, a.id, b.id]);
  for (const bad of [{ ids: [a.id, b.id] }, { ids: [a.id, a.id, b.id] }, { ids: [a.id, b.id, 'x'] }, { ids: [a.id, b.id, c.id, c.id] }, { ids: 'abc' }, {}]) assert.equal((await call('PUT', '/order', bad)).status, 400, JSON.stringify(bad)); assert.deepEqual((await call('GET', '', undefined, null)).body.slides.map((s) => s.id), [c.id, a.id, b.id], 'unchanged');
});
test('the switch: headline or banner only', async () => {
  for (const mode of ['banner', 'headline']) assert.equal((await call('PUT', '/mode', { mode })).body.mode, mode); for (const bad of ['both', '', null, 5, undefined]) assert.equal((await call('PUT', '/mode', { mode: bad })).status, 400); assert.equal((await call('GET', '/admin')).body.mode, 'headline');
});
test('a damaged or hostile stored value never breaks the website: garbage is "headline, no slides", an unsafe link is dropped, and more than 10 slides are cut to 10', async () => {
  await setRaw('not json at all'); assert.deepEqual((await call('GET', '', undefined, null)).body, { mode: 'headline', slides: [], width: 1250, height: 500 }); assert.equal((await call('GET', '/admin')).status, 200); await setRaw('[1,2]'); assert.equal((await call('GET', '', undefined, null)).body.mode, 'headline');
  await setRaw(JSON.stringify({ mode: 'banner', slides: [{ id: 'x1', imageEn: '/uploads/a.png', link: { type: 'url', value: 'javascript:alert(1)' }, seconds: 999 }, { id: 'x2', imageEn: '/uploads/b.png', link: { type: 'url', value: '//evil.example' }, seconds: 'zzz' }, { nope: true }, null, 'x'] })); const pub = (await call('GET', '', undefined, null)).body;
  assert.equal(pub.mode, 'banner'); assert.equal(pub.slides.length, 2); assert.deepEqual(pub.slides.map((s) => s.link), [{ type: 'none', value: '' }, { type: 'none', value: '' }]); assert.deepEqual(pub.slides.map((s) => s.seconds), [30, 5]);
  await setRaw(JSON.stringify({ mode: 'banner', slides: Array.from({ length: 14 }, (_, i) => ({ id: `s${i}`, imageEn: '/uploads/a.png' })) })); assert.equal((await call('GET', '', undefined, null)).body.slides.length, 10);
});
test('two admins adding slides at the same moment do not overwrite each other', async () => { const rs = await Promise.all([call('POST', '/slides', {}), call('POST', '/slides', {}), call('POST', '/slides', {})]); assert.deepEqual(rs.map((r) => r.status), [201, 201, 201]); assert.equal((await call('GET', '/admin')).body.slides.length, 3); });
test('every change is in the audit log', async () => {
  const s = await addSlide(); await call('PUT', '/mode', { mode: 'banner' }); await photo(s.id, 'en', GOOD()); await call('PUT', `/slides/${s.id}`, { seconds: 8 }); await call('DELETE', `/slides/${s.id}/image/en`); await call('DELETE', `/slides/${s.id}`);
  const actions = (await q("SELECT DISTINCT action FROM admin_audit_log WHERE action LIKE 'home_banner_%'")).rows.map((r) => r.action); for (const a of ['home_banner_slide_added', 'home_banner_mode_changed', 'home_banner_photo_changed', 'home_banner_slide_changed', 'home_banner_photo_removed', 'home_banner_slide_removed']) assert.ok(actions.includes(a), a);
});
