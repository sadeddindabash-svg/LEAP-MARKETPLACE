// The vehicle import with SEATS part of what makes a version "the same", against the real importer and database. Run:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/vehicleVersionSeats.test.js
// (it needs migration 109 applied to that database; it refuses to run on a database whose name does not end in "_test".)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
const { parseWorkbook } = require('../src/modules/vehicleImport/parser');
const { validateRows } = require('../src/modules/vehicleImport/rules');
const { runImport } = require('../src/modules/vehicleImport/plan');

let sheets;                                                   // the same sheet builder the admin tests use (ES module, so imported)
const BRAND = 'ZZ Seats Test';
const fakeSave = async () => ({ url: '/uploads/test-seats.png' });
const wipe = async () => {
  const gens = "SELECT g.id FROM vehicle_generations g JOIN vehicle_models m ON m.id = g.model_id JOIN vehicle_brands b ON b.id = m.brand_id WHERE b.name = $1";
  await db.query(`DELETE FROM vehicle_versions WHERE generation_id IN (${gens})`, [BRAND]);
  await db.query("DELETE FROM vehicle_generations WHERE model_id IN (SELECT m.id FROM vehicle_models m JOIN vehicle_brands b ON b.id = m.brand_id WHERE b.name = $1)", [BRAND]);
  await db.query('DELETE FROM vehicle_models WHERE brand_id IN (SELECT id FROM vehicle_brands WHERE name = $1)', [BRAND]);
  await db.query('DELETE FROM vehicle_brands WHERE name = $1', [BRAND]);
};
before(async () => { sheets = await import('../../../apps/admin-dashboard/src/testSheets.js'); await wipe(); });
after(async () => { await wipe(); await db.getPool().end(); });
beforeEach(async () => { await wipe(); await db.query("INSERT INTO vehicle_brands (id, name) VALUES ('zz-seats-brand', $1)", [BRAND]); });          // the importer needs the brand to exist (brands are added first in Vehicle Data)

const may = (over) => sheets.row({ brand: BRAND, model: 'BJ60', year: 2022, version: 'May Day', engine: '2.0T (190 kW)', seats: 5, ...over });
async function importRows(rows, mode = 'skip') {
  const items = validateRows((await parseWorkbook(await sheets.makeSheet(rows))).rows);
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const out = await runImport(client, items, mode, { apply: true, saveImage: fakeSave }); await client.query('COMMIT'); return { items, out }; }
  catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}
const versions = async () => (await db.query(`SELECT v.name, v.engine, v.seats, v.photo_url FROM vehicle_versions v JOIN vehicle_generations g ON g.id = v.generation_id JOIN vehicle_models m ON m.id = g.model_id
  JOIN vehicle_brands b ON b.id = m.brand_id WHERE b.name = $1 ORDER BY v.seats NULLS FIRST`, [BRAND])).rows;

test('a 5-seat and a 7-seat version of the same model, year, name and engine are both imported, as two versions', async () => {
  const { items, out } = await importRows([may({ seats: 5 }), may({ seats: 7 })]);
  assert.deepEqual(items.map((i) => i.ok), [true, true]);
  assert.equal(out.counts.newVersions, 2);
  assert.deepEqual((await versions()).map((v) => v.seats), [5, 7]);
});

test('importing the same file again creates nothing: each row finds ITS OWN version', async () => {
  await importRows([may({ seats: 5 }), may({ seats: 7 })]);
  const again = await importRows([may({ seats: 5 }), may({ seats: 7 })]);
  assert.equal(again.out.counts.newVersions, 0); assert.equal(again.out.counts.existingVersions, 2);
  assert.equal((await versions()).length, 2);
});

test('update mode refreshes each version separately: the 7-seat row never overwrites the 5-seat version', async () => {
  await importRows([may({ seats: 5 }), may({ seats: 7 })]);
  const { out } = await importRows([may({ seats: 5, picture: [400, 400] }), may({ seats: 7, picture: [400, 400] })], 'update');
  assert.equal(out.counts.newVersions, 0); assert.equal(out.counts.updatedVersions, 2);
  assert.deepEqual((await versions()).map((v) => v.seats), [5, 7], 'both versions keep their own seats');
});

test('the database rule: the same name, engine AND seats cannot be stored twice, but a different seat count can', async () => {
  await importRows([may({ seats: 5 })]);
  const gen = (await db.query("SELECT v.generation_id AS id FROM vehicle_versions v JOIN vehicle_generations g ON g.id = v.generation_id JOIN vehicle_models m ON m.id = g.model_id JOIN vehicle_brands b ON b.id = m.brand_id WHERE b.name = $1", [BRAND])).rows[0].id;
  const add = (id, seats, name = 'May Day') => db.query("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, sort_order) VALUES ($1, $2, $4, 'a', 'b', '2.0T (190 kW)', 'c', 'd', $3, 99)", [id, gen, seats, name]);
  await assert.rejects(add('zz-dup', 5), (err) => err.code === '23505', 'the same seats is a duplicate');
  await assert.rejects(add('zz-dup2', 5, '  MAY day '), (err) => err.code === '23505', 'capitals and extra spaces do not make it different');
  await add('zz-seven', 7); await add('zz-six', 6);
  assert.deepEqual((await versions()).map((v) => v.seats), [5, 6, 7]);
  await assert.rejects(add('zz-seven-again', 7), (err) => err.code === '23505', 'and a second 7-seat one is a duplicate');
});
