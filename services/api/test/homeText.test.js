// The editable home page texts, through the REAL routes (/platform-settings/home-text) with real admin and supplier logins and the real database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/homeText.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const KEY = 'storefront_home_text';
let server, base, admin, supplier;
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const put = (body, token = admin) => fetch(`${base}/platform-settings/home-text`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const get = async () => (await (await fetch(`${base}/platform-settings/home-text`)).json());
const DEFAULTS = { topBar: { en: null, ar: null }, headline: { en: null, ar: null, font: 'default', size: 'large' }, subheadline: { en: null, ar: null, font: 'default', size: 'medium' } };
before(async () => { server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; admin = await login('admin@leap.dev', 'admin_dev_password_123'); supplier = await login('supplier@leap.dev', 'supplier_dev_password_123'); assert.ok(admin && supplier); });
beforeEach(async () => { await db.query('DELETE FROM platform_settings WHERE key = $1', [KEY]); });
after(async () => { await db.query('DELETE FROM platform_settings WHERE key = $1', [KEY]); server.close(); await db.getPool().end(); });

test('before anything is saved everything is the default (the website then uses its own wording), and anyone may read it', async () => {
  const res = await fetch(`${base}/platform-settings/home-text`); assert.equal(res.status, 200); const body = await res.json();
  assert.deepEqual(body.text, DEFAULTS); assert.deepEqual(body.fonts, ['default', 'inter', 'poppins', 'montserrat', 'cairo', 'tajawal']); assert.deepEqual(body.sizes, ['small', 'medium', 'large', 'xlarge']); assert.match(res.headers.get('cache-control') || '', /max-age=30/);
});
test('only an admin may change it: no sign-in is refused, and so is a supplier', async () => {
  assert.equal((await put(DEFAULTS, null)).status, 401); assert.equal((await put(DEFAULTS, supplier)).status, 403); assert.deepEqual((await get()).text, DEFAULTS);
});
test('an admin saves all three texts, with their fonts and sizes; everyone then reads them', async () => {
  const text = { topBar: { en: 'Free shipping this week', ar: 'شحن مجاني هذا الأسبوع' }, headline: { en: 'Parts for your car', ar: 'قطع لسيارتك', font: 'poppins', size: 'xlarge' }, subheadline: { en: 'Verified suppliers.', ar: 'موردون موثوقون.', font: 'cairo', size: 'small' } };
  const res = await put(text); assert.equal(res.status, 200); assert.deepEqual((await res.json()).text, text); assert.deepEqual((await get()).text, text);
});
test('texts are trimmed, and an empty text means "use the website\'s own wording" (null)', async () => {
  await put({ topBar: { en: '  Hello  ', ar: '   ' }, headline: { en: '', ar: null, font: 'inter', size: 'small' }, subheadline: {} });
  const { text } = await get(); assert.equal(text.topBar.en, 'Hello'); assert.equal(text.topBar.ar, null); assert.equal(text.headline.en, null); assert.equal(text.headline.font, 'inter'); assert.deepEqual(text.subheadline, DEFAULTS.subheadline);
});
test('what an admin types is kept as plain text (it is shown as text, never as HTML)', async () => {
  await put({ topBar: { en: '<b>Sale</b> & "more"', ar: '' } }); assert.equal((await get()).text.topBar.en, '<b>Sale</b> & "more"');
});
test('Reset to default: sending empty blocks brings every default back, including font and size', async () => {
  await put({ headline: { en: 'X', font: 'poppins', size: 'xlarge' }, subheadline: { en: 'Y', font: 'cairo', size: 'small' } }); await put({ topBar: {}, headline: {}, subheadline: {} });
  assert.deepEqual((await get()).text, DEFAULTS);
});
test('saving only one block resets the others (the screen always sends all three)', async () => {
  await put({ topBar: { en: 'Top' }, headline: { en: 'Head' } }); await put({ headline: { en: 'Only head' } }); const { text } = await get();
  assert.equal(text.headline.en, 'Only head'); assert.equal(text.topBar.en, null);
});
test('a font or size that is not offered is REFUSED (never silently changed), and so is a text that is too long or not text', async () => {
  for (const [body, why] of [[{ headline: { font: 'comic-sans' } }, 'font'], [{ subheadline: { size: 'huge' } }, 'size'], [{ topBar: { en: 'x'.repeat(161) } }, 'too long top bar'], [{ headline: { en: 'x'.repeat(121) } }, 'too long headline'], [{ subheadline: { ar: 'x'.repeat(241) } }, 'too long sub'], [{ headline: { en: 5 } }, 'not text'], [{ headline: 'text' }, 'not an object']]) {
    const res = await put(body); assert.equal(res.status, 400, why); assert.ok((await res.json()).error, why);
  }
  assert.equal((await put([1, 2])).status, 400); assert.deepEqual((await get()).text, DEFAULTS);
});
test('the longest allowed texts are accepted', async () => {
  const res = await put({ topBar: { en: 'x'.repeat(160) }, headline: { en: 'x'.repeat(120) }, subheadline: { ar: 'x'.repeat(240) } }); assert.equal(res.status, 200);
});
test('a damaged stored value never breaks the website: it reads as all defaults, and a new save repairs it', async () => {
  await db.query("INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, 'not json', now())", [KEY]); assert.deepEqual((await get()).text, DEFAULTS);
  await put({ topBar: { en: 'Fixed' } }); assert.equal((await get()).text.topBar.en, 'Fixed');
});
