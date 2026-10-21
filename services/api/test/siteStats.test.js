// The real totals of the storefront's home page, through the REAL route GET /catalog/stats against the real database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/siteStats.test.js
// (it refuses to run on a database whose name does not end in "_test", and removes everything it creates, ids starting "zz-ss".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { LAUNCH_MARKETS, COMPLIANCE_HOLD_COUNTRY_CODES } = require('../src/config/markets');

let server, base;
const q = (sql, params) => db.query(sql, params);
const stats = async () => { const res = await fetch(`${base}/catalog/stats`); assert.equal(res.status, 200); return { body: await res.json(), headers: res.headers }; };
const n = async (sql) => Number((await q(sql)).rows[0].n);
const wipe = async () => {
  await q("DELETE FROM products WHERE id LIKE 'zz-ss-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-ss-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-ss-%'");
};
before(async () => { await wipe(); server = buildApp().listen(0); base = `http://localhost:${server.address().port}`; });
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

test('the four totals are the real counts, not the length of any list', async () => {
  const { body } = await stats();
  assert.deepEqual(body, { parts: await n("SELECT count(*) AS n FROM products WHERE status = 'active'"), brands: await n('SELECT count(*) AS n FROM vehicle_brands'), models: await n('SELECT count(*) AS n FROM vehicle_models'), countries: body.countries });
  for (const k of ['parts', 'brands', 'models', 'countries']) assert.ok(Number.isInteger(body[k]) && body[k] >= 0, k);
});

test('adding a part, a brand and a model raises exactly those totals; a part that is not active is not counted', async () => {
  const before = (await stats()).body;
  await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, status) VALUES ('zz-ss-a', 'SS Active', 1, 'USD', 's1', 1, 'active'), ('zz-ss-b', 'SS Pending', 1, 'USD', 's1', 1, 'translating')");
  await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh) VALUES ('zz-ss-brand', 'SS Brand', 'ب', 'b')");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh) VALUES ('zz-ss-model', 'zz-ss-brand', 'SS Model', 'م', 'm'), ('zz-ss-model2', 'zz-ss-brand', 'SS Model 2', 'م', 'm')");
  const after = (await stats()).body;
  assert.equal(after.parts - before.parts, 1, 'only the active part'); assert.equal(after.brands - before.brands, 1); assert.equal(after.models - before.models, 2); assert.equal(after.countries, before.countries);
});

test('countries are the markets we deliver to: the launch markets without the ones on compliance hold', async () => {
  const expected = LAUNCH_MARKETS.filter((m) => !COMPLIANCE_HOLD_COUNTRY_CODES.has(m.countryCode)).length;
  assert.equal((await stats()).body.countries, expected); assert.ok(expected < LAUNCH_MARKETS.length, 'at least one market is on hold, so the count is below the full list');
});

test('it is public (no sign-in) and may be kept for a minute', async () => {
  const { headers } = await stats(); assert.match(headers.get('cache-control') || '', /max-age=60/);
});
