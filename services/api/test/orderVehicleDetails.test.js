// What the supplier sees about the car on an order item: the car the part is LISTED FOR, with its generation and the versions the part is narrowed to (never the buyer's car). Real database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/orderVehicleDetails.test.js   (needs migration 114)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/pool');
const { insertFitmentEntry } = require('../src/modules/orderVehicles/fitmentVersions');
const { loadProductCars } = require('../src/modules/orderVehicles/productCars');

const q = (sql, params) => db.query(sql, params);
const wipe = async () => {
  await q("DELETE FROM product_fitment_entries WHERE product_id IN (SELECT id FROM products WHERE oem_number LIKE 'ZZ-OV-%')"); await q("DELETE FROM products WHERE oem_number LIKE 'ZZ-OV-%'");
  await q("DELETE FROM vehicle_versions WHERE generation_id LIKE 'zz-ov-%'"); await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-ov-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-ov-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-ov-%'");
};
let n = 0;
const makeProduct = async (cars) => { const id = `zz-ov-p${++n}`; await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, category, status, oem_number) VALUES ($1, 'ZZ part', 100, 'CNY', 's1', 5, 'brake', 'active', $2)", [id, `ZZ-OV-${id}`]); const c = await db.getPool().connect(); try { for (const [gen, year, versions] of cars) await insertFitmentEntry(c, id, { generationId: gen, year }, versions); } finally { c.release(); } return id; };
const carsOf = async (id) => (await loadProductCars(db, [id])).get(id).cars;

before(async () => {
  await wipe(); await q("INSERT INTO vehicle_brands (id, name, name_ar, name_zh) VALUES ('zz-ov-b', 'ZZ Brand', 'ب', '品牌')"); await q("INSERT INTO vehicle_models (id, brand_id, name, name_ar, name_zh) VALUES ('zz-ov-m', 'zz-ov-b', 'ZZ Model', 'م', '车型')");
  await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ('zz-ov-g1', 'zz-ov-m', 'Gen One', 2020, 2024), ('zz-ov-g2', 'zz-ov-m', 'Gen Two', 2025, NULL), ('zz-ov-g3', 'zz-ov-m', 'Gen Three', 2018, 2018)");
  for (const [id, g, name] of [['zz-ov-v1', 'zz-ov-g1', 'Premium RWD'], ['zz-ov-v2', 'zz-ov-g1', 'Performance AWD'], ['zz-ov-v3', 'zz-ov-g1', 'Excellence AWD']]) await q("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, sort_order) VALUES ($1, $2, $3, $3, $3, '2 motors', '2 motors', '2 motors', 5, 1)", [id, g, name]);
});
after(async () => { await wipe(); await db.getPool().end(); });

test('CRITICAL: the car carries its generation: name, first and last year, and how many versions the generation has', async () => {
  const id = await makeProduct([['zz-ov-g1', 2023, []]]); const [car] = await carsOf(id);
  assert.deepEqual(car.generation, { name: 'Gen One', yearStart: 2020, yearEnd: 2024, versionCount: 3 });
  for (const key of ['year', 'brand', 'model', 'engine', 'transmission', 'photoUrl', 'versions', 'generation']) assert.ok(key in car, `the car still carries ${key}`);
});
test('a generation still in production has no last year; a generation with no versions says 0', async () => {
  const id = await makeProduct([['zz-ov-g2', 2026, []], ['zz-ov-g3', 2018, []]]); const cars = await carsOf(id);
  assert.deepEqual(cars[0].generation, { name: 'Gen Two', yearStart: 2025, yearEnd: null, versionCount: 0 }); assert.deepEqual(cars[1].generation, { name: 'Gen Three', yearStart: 2018, yearEnd: 2018, versionCount: 0 });
});
test('CRITICAL: the versions the part is narrowed to come with the car, next to the generation (so "2 of 3 versions" can be said); an open car has none', async () => {
  const id = await makeProduct([['zz-ov-g1', 2023, ['zz-ov-v2', 'zz-ov-v3']], ['zz-ov-g1', 2022, []]]); const [narrowed, open] = await carsOf(id);
  assert.deepEqual(narrowed.versions.map((v) => v.id).sort(), ['zz-ov-v2', 'zz-ov-v3']); assert.equal(narrowed.generation.versionCount, 3); assert.equal(narrowed.versions[0].name.en.length > 0, true); assert.equal(open.versions, null); assert.equal(open.generation.versionCount, 3);
});
test('PRIVACY: nothing about the buyer or the buyer\'s own car is added', async () => {
  const id = await makeProduct([['zz-ov-g1', 2023, []]]); const text = JSON.stringify(await carsOf(id)); for (const word of ['buyer', 'user', 'email', 'address', 'garage']) assert.ok(!text.toLowerCase().includes(word), `no "${word}" in the car`);
});
test('the supplier\'s order route sends the cars exactly as loadProductCars builds them (so the generation and versions reach the portal)', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'supplier', 'routes.js'), 'utf8'); assert.ok(s.includes('loadProductCars(db, items.map((i) => i.product_id))'));
  const p = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'orderVehicles', 'productCars.js'), 'utf8'); assert.ok(p.includes('generation: { name: r.generation_name, yearStart: r.generation_start, yearEnd: r.generation_end, versionCount: r.version_count }'));
});
