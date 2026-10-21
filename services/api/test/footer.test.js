// The storefront footer, through the REAL routes (/platform-settings/footer) with real admin and supplier logins, real multipart uploads and the real database and uploads folder. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/footer.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const KEYS = ['storefront_footer_text', 'storefront_social_links', 'storefront_legal_pages'];
const UPLOADS = path.join(__dirname, '../uploads');
let server, base, admin, supplier; const made = new Set();
const makePng = (w, h) => { const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x7f)]); return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const auth = (token) => (token ? { Authorization: `Bearer ${token}` } : {});
const send = (method, url, body, token = admin) => fetch(`${base}/platform-settings/footer${url}`, { method, headers: { 'Content-Type': 'application/json', ...auth(token) }, body: body === undefined ? undefined : JSON.stringify(body) });
const getAll = async () => (await fetch(`${base}/platform-settings/footer`)).json();
const putIcon = (id, bytes, token = admin) => { const f = new FormData(); if (bytes) f.append('image', new Blob([bytes], { type: 'image/png' }), 'x.png'); return fetch(`${base}/platform-settings/footer/social/${id}/icon`, { method: 'PUT', headers: auth(token), body: f }); };
const onDisk = (url) => fs.existsSync(path.join(UPLOADS, path.basename(url)));
const addSocial = async (items) => { const res = await send('PUT', '/social', { items }); assert.equal(res.status, 200, JSON.stringify(await res.clone().json())); return (await res.json()).social; };
before(async () => { server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier); });
beforeEach(async () => { await db.query('DELETE FROM platform_settings WHERE key = ANY($1)', [KEYS]); });
after(async () => { await db.query('DELETE FROM platform_settings WHERE key = ANY($1)', [KEYS]); for (const url of made) try { fs.unlinkSync(path.join(UPLOADS, path.basename(url))); } catch { /* removed */ } server.close(); await db.getPool().end(); });

test('before anything is saved: no text, no icons, no pages (the website uses its own footer), and anyone may read it', async () => {
  const res = await fetch(`${base}/platform-settings/footer`); assert.equal(res.status, 200); const b = await res.json();
  assert.deepEqual(b.text.tagline, { en: null, ar: null }); assert.deepEqual(b.social, []); assert.deepEqual(b.pages, { about: false, terms: false, delivery: false, refund: false, privacy: false, cancellation: false });
  assert.deepEqual(b.slugs, { about: 'about-us', terms: 'terms-conditions', delivery: 'delivery-shipping-policy', refund: 'refund-policy', privacy: 'privacy-policy', cancellation: 'cancellation-replacement-policy' });
  assert.equal(Object.keys(b.text.links).length, 6); assert.ok(Object.values(b.text.links).every((l) => l.shown === true)); assert.match(res.headers.get('cache-control') || '', /max-age=30/);
});
test('only an admin may change anything: no sign-in is refused, and so is a supplier', async () => {
  for (const [m, u, body] of [['PUT', '/text', {}], ['PUT', '/social', { items: [] }], ['PUT', '/pages/about', {}], ['PUT', '/social/x/icon', undefined], ['DELETE', '/social/x/icon', undefined]]) {
    assert.equal((await send(m, u, body, null)).status, 401, `${m} ${u} without sign-in`); assert.equal((await send(m, u, body, supplier)).status, 403, `${m} ${u} as a supplier`);
  }
});

// ---- text
test('the footer text is saved, trimmed, and read back by everyone; an empty text is "use the website\'s own wording"', async () => {
  const body = { tagline: { en: '  Genuine parts  ', ar: 'قطع أصلية' }, copyright: { en: 'Copyright © Leap {year}', ar: '' }, titles: { shop: { en: 'Browse', ar: 'تصفح' } }, links: { about: { en: 'Who we are', ar: 'من نحن', shown: true }, refund: { en: '', ar: '', shown: false } } };
  const res = await send('PUT', '/text', body); assert.equal(res.status, 200);
  const { text } = await getAll(); assert.equal(text.tagline.en, 'Genuine parts'); assert.equal(text.copyright.ar, null); assert.equal(text.titles.shop.ar, 'تصفح'); assert.equal(text.titles.help.en, null);
  assert.equal(text.links.about.en, 'Who we are'); assert.equal(text.links.refund.shown, false); assert.equal(text.links.terms.shown, true);
});
test('wrong text is refused: too long, not text, a link flag that is not true/false, a body that is not an object', async () => {
  for (const [body, why] of [[{ tagline: { en: 'x'.repeat(161) } }, 'tagline'], [{ copyright: { ar: 'x'.repeat(161) } }, 'copyright'], [{ titles: { shop: { en: 'x'.repeat(41) } } }, 'title'], [{ links: { about: { en: 'x'.repeat(41) } } }, 'label'], [{ tagline: { en: 5 } }, 'not text'], [{ links: { about: { shown: 'yes' } } }, 'flag'], [{ tagline: 'text' }, 'not object'], [[1], 'array']]) {
    const res = await send('PUT', '/text', body); assert.equal(res.status, 400, why); assert.ok((await res.json()).error, why);
  }
  assert.equal((await getAll()).text.tagline.en, null);
});
test('a damaged stored text reads as "all defaults" and a new save repairs it', async () => {
  await db.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ('storefront_footer_text', 'not json', now())"); assert.equal((await getAll()).text.tagline.en, null);
  await send('PUT', '/text', { tagline: { en: 'Fixed' } }); assert.equal((await getAll()).text.tagline.en, 'Fixed');
});

// ---- social
test('social media icons: added in order, each with its own id, a name and a link; read back by everyone', async () => {
  const social = await addSocial([{ name: 'Facebook', url: 'https://facebook.com/leap' }, { name: 'Instagram', url: ' https://instagram.com/leap ' }, { name: 'WhatsApp' }]);
  assert.deepEqual(social.map((s) => s.name), ['Facebook', 'Instagram', 'WhatsApp']); assert.equal(new Set(social.map((s) => s.id)).size, 3); assert.equal(social[1].url, 'https://instagram.com/leap'); assert.equal(social[2].url, null); assert.equal(social[0].icon, null);
  assert.deepEqual((await getAll()).social, social);
});
test('wrong social media items are refused: no name, an address that is not a web address (javascript:, mailto, plain text), too many, too long', async () => {
  for (const [items, why] of [[[{ name: '', url: 'https://a.com' }], 'no name'], [[{ name: 'X', url: 'javascript:alert(1)' }], 'javascript'], [[{ name: 'X', url: 'mailto:a@b.com' }], 'mailto'], [[{ name: 'X', url: 'facebook' }], 'plain'], [[{ name: 'X', url: 'ftp://a.com' }], 'ftp'], [Array.from({ length: 9 }, (_, i) => ({ name: `n${i}` })), 'nine'], [[{ name: 'x'.repeat(41) }], 'long name'], [[{ name: 'X', url: `https://a.com/${'x'.repeat(300)}` }], 'long url']]) {
    const res = await send('PUT', '/social', { items }); assert.equal(res.status, 400, why);
  }
  assert.equal((await send('PUT', '/social', {})).status, 400); assert.deepEqual((await getAll()).social, []);
});
test('eight icons are allowed', async () => { assert.equal((await addSocial(Array.from({ length: 8 }, (_, i) => ({ name: `n${i}`, url: `https://a.com/${i}` })))).length, 8); });
test('a picture is exactly 256 x 256, belongs to its icon, shows in the list, and replacing it deletes the old file', async () => {
  const [a, b] = await addSocial([{ name: 'A', url: 'https://a.com' }, { name: 'B', url: 'https://b.com' }]);
  const r1 = await putIcon(a.id, makePng(256, 256)); assert.equal(r1.status, 200); const one = await r1.json(); made.add(one.icon); assert.match(one.icon, /^\/uploads\/[0-9a-f]{32}\.png$/); assert.ok(onDisk(one.icon));
  const r2 = await putIcon(a.id, makePng(256, 256)); const two = await r2.json(); made.add(two.icon); assert.ok(!onDisk(one.icon), 'the replaced picture is gone'); assert.ok(onDisk(two.icon));
  const list = (await getAll()).social; assert.equal(list[0].icon, two.icon); assert.equal(list[1].icon, null); assert.equal(list[1].id, b.id);
});
test('a picture of another size, a non-picture, a missing file or an unknown icon is refused', async () => {
  const [a] = await addSocial([{ name: 'A', url: 'https://a.com' }]);
  for (const [w, h] of [[255, 256], [256, 255], [128, 128], [512, 512]]) { const r = await putIcon(a.id, makePng(w, h)); assert.equal(r.status, 400, `${w}x${h}`); assert.match((await r.json()).error, /256/); }
  assert.equal((await putIcon(a.id, Buffer.from('hello'))).status, 400); assert.equal((await putIcon(a.id, null)).status, 400); assert.equal((await putIcon('nope', makePng(256, 256))).status, 404);
  assert.equal((await getAll()).social[0].icon, null);
});
test('saving the list again keeps each picture with its item, even when they are reordered; renaming does not lose it', async () => {
  const [a, b] = await addSocial([{ name: 'A', url: 'https://a.com' }, { name: 'B', url: 'https://b.com' }]); const up = await (await putIcon(b.id, makePng(256, 256))).json(); made.add(up.icon);
  const again = await addSocial([{ id: b.id, name: 'B renamed', url: 'https://b.com' }, { id: a.id, name: 'A', url: 'https://a.com' }]);
  assert.deepEqual(again.map((s) => s.name), ['B renamed', 'A']); assert.equal(again[0].icon, up.icon); assert.equal(again[0].id, b.id); assert.ok(onDisk(up.icon));
});
test('removing an item (or removing its picture) deletes its picture file', async () => {
  const [a, b] = await addSocial([{ name: 'A', url: 'https://a.com' }, { name: 'B', url: 'https://b.com' }]); const pa = await (await putIcon(a.id, makePng(256, 256))).json(); const pb = await (await putIcon(b.id, makePng(256, 256))).json(); made.add(pa.icon); made.add(pb.icon);
  assert.equal((await send('DELETE', `/social/${a.id}/icon`)).status, 200); assert.ok(!onDisk(pa.icon)); assert.equal((await getAll()).social[0].icon, null);
  await addSocial([{ id: a.id, name: 'A', url: 'https://a.com' }]); assert.ok(!onDisk(pb.icon), 'B was removed, so its picture is gone'); assert.equal((await send('DELETE', '/social/nope/icon')).status, 404);
});
test('an id sent that does not exist is treated as a new item (it cannot claim someone else\'s picture)', async () => {
  const [a] = await addSocial([{ name: 'A', url: 'https://a.com' }]); const up = await (await putIcon(a.id, makePng(256, 256))).json(); made.add(up.icon);
  const out = await addSocial([{ id: 'made-up-id', name: 'New', url: 'https://n.com' }]); assert.notEqual(out[0].id, 'made-up-id'); assert.equal(out[0].icon, null); assert.ok(!onDisk(up.icon), 'the old item was removed with its picture');
});

// ---- pages
test('the six pages: each is empty until written; writing one makes only that one "has content", sets its date, and everyone can read it', async () => {
  const res = await send('PUT', '/pages/terms', { title: { en: 'Terms & Conditions', ar: 'الشروط والأحكام' }, body: { en: '## Terms\nBe kind.', ar: 'كن لطيفا' } }); assert.equal(res.status, 200); const page = await res.json();
  assert.equal(page.slug, 'terms-conditions'); assert.equal(page.hasContent, true); assert.match(page.updatedAt, /^\d{4}-\d\d-\d\dT/);
  const read = await (await fetch(`${base}/platform-settings/footer/pages/terms`)).json(); assert.equal(read.body.en, '## Terms\nBe kind.'); assert.equal(read.title.ar, 'الشروط والأحكام');
  const flags = (await getAll()).pages; assert.equal(flags.terms, true); assert.equal(flags.about, false);
  const empty = await (await fetch(`${base}/platform-settings/footer/pages/about`)).json(); assert.equal(empty.hasContent, false); assert.equal(empty.updatedAt, null);
});
test('a page with text in only one language still has content; clearing both texts makes it empty again', async () => {
  await send('PUT', '/pages/refund', { body: { ar: 'نص' } }); assert.equal((await getAll()).pages.refund, true);
  await send('PUT', '/pages/refund', { body: { en: '  ', ar: '' } }); assert.equal((await getAll()).pages.refund, false);
});
test('saving one page leaves the other pages alone, and two admins saving different pages at the same moment do not overwrite each other', async () => {
  await send('PUT', '/pages/about', { body: { en: 'About text' } });
  await Promise.all([send('PUT', '/pages/terms', { body: { en: 'Terms text' } }), send('PUT', '/pages/privacy', { body: { en: 'Privacy text' } }), send('PUT', '/pages/delivery', { body: { en: 'Delivery text' } })]);
  const flags = (await getAll()).pages; assert.deepEqual([flags.about, flags.terms, flags.privacy, flags.delivery, flags.refund], [true, true, true, true, false]);
});
test('an unknown page is a 404; a text that is too long or not text is refused (and nothing is saved)', async () => {
  assert.equal((await fetch(`${base}/platform-settings/footer/pages/wheels`)).status, 404); assert.equal((await send('PUT', '/pages/wheels', { body: { en: 'x' } })).status, 404);
  for (const [body, why] of [[{ title: { en: 'x'.repeat(121) } }, 'title'], [{ body: { en: 'x'.repeat(60001) } }, 'body'], [{ body: { en: 5 } }, 'not text'], [{ body: 'text' }, 'not object'], [[], 'array']]) { assert.equal((await send('PUT', '/pages/about', body)).status, 400, why); }
  assert.equal((await send('PUT', '/pages/about', { body: { en: 'x'.repeat(60000) } })).status, 200, 'the longest allowed text is accepted');
});
test('text written with HTML or script is kept as plain text (the website shows it as text, never as HTML)', async () => {
  await send('PUT', '/pages/about', { body: { en: '<script>alert(1)</script> **bold**' } }); assert.equal((await (await fetch(`${base}/platform-settings/footer/pages/about`)).json()).body.en, '<script>alert(1)</script> **bold**');
});
test('a damaged stored pages value never breaks the website: it reads as empty pages, and a new save repairs it', async () => {
  await db.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ('storefront_legal_pages', 'not json', now())"); assert.equal((await getAll()).pages.about, false);
  await send('PUT', '/pages/about', { body: { en: 'Fixed' } }); assert.equal((await getAll()).pages.about, true);
});
