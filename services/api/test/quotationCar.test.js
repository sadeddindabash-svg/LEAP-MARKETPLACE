// "Get a quotation" with a car from the catalogue: the make, model and version are read from the catalogue (never typed), a car typed by hand is refused,
// and a renewal keeps its car. Against the real test database (its name must end in "_test"; everything it creates is removed):
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/quotationCar.test.js
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { readVehicle, fittingProductIds } = require('../src/modules/quotations/service');

const wipe = async () => {
  await db.query("DELETE FROM products WHERE id LIKE 'zz-qc-%'");          // its fitment rows go with it
  await db.query("DELETE FROM vehicle_versions WHERE id LIKE 'zz-qc-%'");
  await db.query("DELETE FROM vehicle_generations WHERE id LIKE 'zz-qc-%'");
  await db.query("DELETE FROM vehicle_models WHERE id LIKE 'zz-qc-%'");
  await db.query("DELETE FROM vehicle_brands WHERE id LIKE 'zz-qc-%'");
};
before(async () => {
  await wipe();
  await db.query("INSERT INTO vehicle_brands (id, name, name_ar) VALUES ('zz-qc-b', 'ZZ GAC', 'جي إيه سي')");
  await db.query("INSERT INTO vehicle_models (id, brand_id, name, name_ar) VALUES ('zz-qc-m', 'zz-qc-b', 'GS8', 'جي إس 8')");
  await db.query("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ('zz-qc-g', 'zz-qc-m', 'Gen 2', 2022, 2025), ('zz-qc-g2', 'zz-qc-m', 'Gen 1', 2017, 2021)");
  await db.query("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats) VALUES ('zz-qc-v', 'zz-qc-g', '320T Luxury', '320T فاخرة', '320T', '2.0T', '2.0T', '2.0T', 7), ('zz-qc-v2', 'zz-qc-g', '390T', '390T', '390T', '2.0T', '2.0T', '2.0T', 7)");
  // parts: one for every version of the 2024 car, one only for the 390T, one for 2023 only, one with no fitment at all
  for (const id of ['zz-qc-all', 'zz-qc-390', 'zz-qc-2023', 'zz-qc-none']) await db.query("INSERT INTO products (id, name, price, currency_code, status) VALUES ($1, $1, 10, 'CNY', 'active')", [id]);
  await db.query("INSERT INTO product_fitment_entries (product_id, generation_id, year) VALUES ('zz-qc-all', 'zz-qc-g', 2024), ('zz-qc-390', 'zz-qc-g', 2024), ('zz-qc-2023', 'zz-qc-g', 2023)");
  await db.query("INSERT INTO product_fitment_entry_versions (entry_id, version_id) SELECT id, 'zz-qc-v2' FROM product_fitment_entries WHERE product_id = 'zz-qc-390'");
});
after(async () => { await wipe(); await db.getPool().end(); });

const code = async (v, renewal) => { try { await readVehicle(db, v, renewal); return 'taken'; } catch (e) { return e.apiCode || e.message; } };

test('a catalogue car: make, model and version come from the catalogue, not from what was sent', async () => {
  const v = await readVehicle(db, { generationId: 'zz-qc-g', year: 2024, versionId: 'zz-qc-v', make: 'Random', model: 'Anything', vin: ' lmgab1s5xr1000123 ' });
  assert.deepEqual(v, { make: 'ZZ GAC', model: 'GS8', year: 2024, vin: 'LMGAB1S5XR1000123', plate: null, makeAr: 'جي إيه سي', modelAr: 'جي إس 8', generationId: 'zz-qc-g', versionId: 'zz-qc-v', version: '320T Luxury', versionAr: '320T فاخرة' });
  const old = await readVehicle(db, { generationId: 'zz-qc-g2', year: 2019 });             // a year without versions (or an older garage car): no version
  assert.equal(old.version, null); assert.equal(old.make, 'ZZ GAC');
});

test('refused: a typed car, a year outside the generation, an unknown car, and a version of another year', async () => {
  assert.equal(await code({ make: 'VW', model: 'Golf', year: 2020 }), 'quote_vehicle');
  assert.equal(await code(null), 'quote_vehicle');
  assert.equal(await code({ generationId: 'zz-qc-g', year: 2019 }), 'quote_vehicle');
  assert.equal(await code({ generationId: 'zz-qc-nope', year: 2024 }), 'quote_vehicle');
  assert.equal(await code({ generationId: 'zz-qc-g2', year: 2019, versionId: 'zz-qc-v' }), 'quote_vehicle');
});

test('a renewal keeps its car, even one typed before the catalogue or since removed from it', async () => {
  assert.deepEqual(await readVehicle(db, { make: 'Volkswagen', model: 'Golf', year: 2020, vin: 'WVWZZZAUZLW003307', plate: null }, true), { make: 'Volkswagen', model: 'Golf', year: 2020, vin: 'WVWZZZAUZLW003307', plate: null });
  const gone = await readVehicle(db, { generationId: 'zz-qc-gone', year: 2024, make: 'ZZ GAC', model: 'GS8', version: '320T Luxury' }, true);
  assert.equal(gone.make, 'ZZ GAC'); assert.equal(gone.version, '320T Luxury');
  const again = await readVehicle(db, { generationId: 'zz-qc-g', year: 2024, versionId: 'zz-qc-v', make: 'old name' }, true);
  assert.equal(again.make, 'ZZ GAC'); assert.equal(again.version, '320T Luxury');
});

test('the fit check: a part fits the car by the sellers\' fitment, year and version', async () => {
  const all = ['zz-qc-all', 'zz-qc-390', 'zz-qc-2023', 'zz-qc-none'];
  const fits = async (vehicle) => [...(await fittingProductIds(db, vehicle, all))].sort();
  assert.deepEqual(await fits({ generationId: 'zz-qc-g', year: 2024, versionId: 'zz-qc-v' }), ['zz-qc-all']);                 // the 390T part does not fit the 320T
  assert.deepEqual(await fits({ generationId: 'zz-qc-g', year: 2024, versionId: 'zz-qc-v2' }), ['zz-qc-390', 'zz-qc-all']);
  assert.deepEqual(await fits({ generationId: 'zz-qc-g', year: 2024 }), ['zz-qc-390', 'zz-qc-all']);                         // a car with no version: any version
  assert.deepEqual(await fits({ generationId: 'zz-qc-g', year: 2023 }), ['zz-qc-2023']);
  assert.deepEqual(await fits({ generationId: 'zz-qc-g2', year: 2019 }), []);
  assert.deepEqual(await fits(null), []);
});
