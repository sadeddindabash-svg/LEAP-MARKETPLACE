// A part that fits MANY vehicles: the grouping of its fitment into models with year ranges (pure), the real database reader, and the real product endpoint.
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/productFitGroups.test.js
// (it refuses to run on a database whose name does not end in "_test"; everything it creates has an id starting "zz-fg".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { buildApp } = require('./helpers/realRouters');
const { groupFit, loadBuyerFit, MAX_FIT_GROUPS } = require('../src/modules/orderVehicles/productCars');

const e = (brand, model, year, over = {}) => ({ brand, brand_ar: null, model, model_ar: null, year, generation_id: `g-${brand}-${model}`, ...over });
test('groupFit: years that follow each other become one range, the others stay apart, in order', () => {
  const g = groupFit([e('BYD', 'Seal', 2022), e('BYD', 'Seal', 2023), e('BYD', 'Seal', 2024), e('BYD', 'Seal', 2026)]);
  assert.deepEqual(g, [{ brand: 'BYD', brandAr: null, model: 'Seal', modelAr: null, ranges: [[2022, 2024], [2026, 2026]], vehicleCount: 4 }]);
});
test('groupFit: models come in the order the supplier added them (the first is the primary one the page has always shown)', () => {
  const g = groupFit([e('BYD', 'Seal', 2022), e('Toyota', 'Camry', 2020), e('BYD', 'Dolphin', 2023), e('BYD', 'Seal', 2023)]);
  assert.deepEqual(g.map((x) => `${x.brand} ${x.model}`), ['BYD Seal', 'Toyota Camry', 'BYD Dolphin']); assert.deepEqual(g[0].ranges, [[2022, 2023]]);
});
test('groupFit: years added out of order and twice are sorted and counted once; two generations of one model are one group; the same model name under two brands is two groups', () => {
  const g = groupFit([e('BYD', 'Seal', 2024, { generation_id: 'b' }), e('BYD', 'Seal', 2022, { generation_id: 'a' }), e('BYD', 'Seal', 2023, { generation_id: 'a' }), e('BYD', 'Seal', 2023, { generation_id: 'a' }), e('Other', 'Seal', 2022)]);
  assert.equal(g.length, 2); assert.deepEqual(g[0].ranges, [[2022, 2024]]); assert.equal(g[0].vehicleCount, 3); assert.equal(g[1].brand, 'Other');
});
test('groupFit: the Arabic names travel with the group; a year that is not a number is ignored; nothing at all is an empty list', () => {
  const g = groupFit([{ ...e('BYD', 'Seal', 2022), brand_ar: 'بي واي دي', model_ar: 'سيل' }, e('BYD', 'Seal', null), e('BYD', 'Seal', 'abc')]);
  assert.equal(g[0].brandAr, 'بي واي دي'); assert.equal(g[0].modelAr, 'سيل'); assert.deepEqual(g[0].ranges, [[2022, 2022]]); assert.deepEqual(groupFit([]), []);
});

let server, base; const q = (sql, params) => db.query(sql, params);
const wipe = async () => {
  await q("DELETE FROM product_fitment_entries WHERE product_id LIKE 'zz-fg-%'"); await q("DELETE FROM products WHERE id LIKE 'zz-fg-%'"); await q("DELETE FROM suppliers WHERE id LIKE 'zz-fg-%'");
  await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-fg-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-fg-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-fg-%'");
};
before(async () => {
  // columns the product page reads that later migrations add (not in every working copy); harmless where they already exist
  for (const c of ['country TEXT', 'country_ar TEXT', 'verification_status TEXT']) await q(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ${c}`);
  await q('CREATE TABLE IF NOT EXISTS product_attributes (id SERIAL PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, attribute_name TEXT NOT NULL, attribute_value TEXT NOT NULL)');
  await wipe(); await q("INSERT INTO suppliers (id, name) VALUES ('zz-fg-s', 'FG Supplier')");
  await q("INSERT INTO vehicle_brands (id, name, name_ar, sort_order) VALUES ('zz-fg-b1', 'ZZ Fit Brand One', 'ماركة', 1), ('zz-fg-b2', 'ZZ Fit Brand Two', NULL, 2)");
  await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, sort_order) VALUES ('zz-fg-m1', 'zz-fg-b1', 'Alpha', 'ألفا', 1), ('zz-fg-m2', 'zz-fg-b1', 'Beta', NULL, 2), ('zz-fg-m3', 'zz-fg-b2', 'Gamma', NULL, 1)");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ('zz-fg-g1', 'zz-fg-m1', 'Alpha 1', 2020, 2024, 1), ('zz-fg-g2', 'zz-fg-m2', 'Beta 1', 2021, 2024, 1), ('zz-fg-g3', 'zz-fg-m3', 'Gamma 1', 2018, 2024, 1)");
  for (const id of ['many', 'one', 'none']) await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity) VALUES ($1, $2, 10, 'USD', 'zz-fg-s', 5)", [`zz-fg-${id}`, `FG ${id}`]);
  const fit = (p, g, y) => q('INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ($1, $2, $3)', [p, g, y]);
  for (const [g, y] of [['zz-fg-g1', 2022], ['zz-fg-g1', 2023], ['zz-fg-g1', 2024], ['zz-fg-g2', 2023], ['zz-fg-g3', 2020], ['zz-fg-g3', 2021], ['zz-fg-g3', 2022]]) await fit('zz-fg-many', g, y);
  await fit('zz-fg-one', 'zz-fg-g1', 2022);
  await q("INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id) SELECT 'zz-fg-one', 'zz-fg-g1', 2022, id FROM vehicle_engines LIMIT 1").catch(() => {});      // the same car with another engine: not another vehicle
  server = buildApp().listen(0); base = `http://localhost:${server.address().port}`;
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

test('the database reader: a part that fits 7 vehicles of 3 models gives 3 groups with their ranges, the counts, and still the old fields', async () => {
  const f = await loadBuyerFit(db, 'zz-fg-many');
  assert.equal(f.fitCarCount, 7); assert.equal(f.fitVehicleCount, 7); assert.equal(f.fitGroupCount, 3); assert.equal(f.fitGroups.length, 3);
  assert.deepEqual(f.fitGroups.map((g) => [g.brand, g.model, g.ranges]), [['ZZ Fit Brand One', 'Alpha', [[2022, 2024]]], ['ZZ Fit Brand One', 'Beta', [[2023, 2023]]], ['ZZ Fit Brand Two', 'Gamma', [[2020, 2022]]]]);
  assert.equal(f.fitGroups[0].brandAr, 'ماركة'); assert.equal(f.fitGroups[0].modelAr, 'ألفا'); assert.equal(f.fitCars.length, 3); assert.equal(f.fitKeys.length, 7);
});
test('the same car with two engines is one vehicle, not two', async () => { const f = await loadBuyerFit(db, 'zz-fg-one'); assert.equal(f.fitVehicleCount, 1); assert.equal(f.fitGroups.length, 1); assert.deepEqual(f.fitGroups[0].ranges, [[2022, 2022]]); });
test('a part with no fitment at all: an EMPTY list (the page says it is universal)', async () => { const f = await loadBuyerFit(db, 'zz-fg-none'); assert.deepEqual(f.fitGroups, []); assert.equal(f.fitGroupCount, 0); assert.equal(f.fitVehicleCount, 0); assert.equal(f.fitCarCount, 0); });
test('when the fitment cannot be read the groups are LEFT OUT (an error must never look like "fits every vehicle")', async () => {
  const broken = { query: async () => { throw new Error('boom'); } }; const orig = console.error; console.error = () => {};
  try { const f = await loadBuyerFit(broken, 'x'); assert.equal('fitGroups' in f, false); assert.equal('fitGroupCount' in f, false); assert.equal(f.fitCarCount, 0); } finally { console.error = orig; }
});
test('the real product endpoint carries the groups: the page gets every model and its years', async () => {
  const r = await fetch(`${base}/catalog/products/zz-fg-many`); assert.equal(r.status, 200); const p = await r.json();
  assert.equal(p.fitGroupCount, 3); assert.equal(p.fitVehicleCount, 7); assert.equal(p.fitGroups[1].model, 'Beta'); assert.deepEqual(p.fitGroups[2].ranges, [[2020, 2022]]); assert.equal(p.brand, 'ZZ Fit Brand One'); assert.equal(p.model, 'Alpha'); assert.equal(p.year, 2022);
  const none = await (await fetch(`${base}/catalog/products/zz-fg-none`)).json(); assert.deepEqual(none.fitGroups, []);
});
test('a part that fits more models than the cap: only 60 lines are sent, but the REAL number of models and of vehicles is kept (so the page can say how many are not listed)', async () => {
  const rows = []; for (let m = 0; m < MAX_FIT_GROUPS + 15; m++) for (const year of [2022, 2023]) rows.push({ product_id: 'x', generation_id: `g${m}`, year, brand: 'B', brand_ar: null, model: `M${m}`, model_ar: null });
  const fake = { query: async () => ({ rows }) }; const f = await loadBuyerFit(fake, 'x');
  assert.equal(MAX_FIT_GROUPS, 60); assert.equal(f.fitGroups.length, 60); assert.equal(f.fitGroupCount, 75); assert.equal(f.fitVehicleCount, 150); assert.equal(f.fitCarCount, 150); assert.equal(f.fitGroups[0].model, 'M0'); assert.equal(f.fitGroups[59].model, 'M59');
});

test('the admin\'s product detail names the brand and model of each fitment row (for the grouped summary), and keeps the label and ids', async () => {
  const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) })).json();
  const r = await fetch(`${base}/catalog/admin/products/zz-fg-many`, { headers: { Authorization: `Bearer ${login.token}` } }); assert.equal(r.status, 200); const p = await r.json();
  assert.equal(p.fitment.length, 7); const first = p.fitment.find((f) => f.generationId === 'zz-fg-g1' && f.year === 2022);
  assert.equal(first.brandName, 'ZZ Fit Brand One'); assert.equal(first.modelName, 'Alpha'); assert.match(first.label, /ZZ Fit Brand One Alpha \(Alpha 1\) · 2022/); assert.equal(p.fitment.find((f) => f.generationId === 'zz-fg-g3').modelName, 'Gamma');
});
