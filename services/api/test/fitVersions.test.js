// A part's fitment narrowed to some VERSIONS of a car: the rules (pure), the choice's checks, the supplier's create call, what the supplier's list and the buyer's answer carry, and the admin's re-save, through the REAL routes and database:
//   DATABASE_URL=postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test node --test test/fitVersions.test.js
// (it needs migration 114; it refuses to run on a database whose name does not end in "_test", and removes everything it creates)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test';
if (!/_test$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw new Error('Refusing to run: the database name must end in _test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db/pool');
require('./helpers/realRouters');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { resolveVersionChoice, buyerVersionRules, readVersionsByEntry, insertFitmentEntry, replaceProductFitment } = require('../src/modules/orderVehicles/fitmentVersions');
const { loadProductCars, loadBuyerFit } = require('../src/modules/orderVehicles/productCars');

let server, base, supplierToken, adminToken, routeWorks = false;      // routeWorks: the supplier's create route can run in this environment (a trimmed test database or a copy that lacks files cannot run it)
const q = (sql, params) => db.query(sql, params);
const login = async (email, password) => (await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const call = (method, path, token, body) => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
const wipe = async () => {
  await q("DELETE FROM product_fitment_entries WHERE product_id IN (SELECT id FROM products WHERE oem_number LIKE 'ZZ-FV-%')"); await q("DELETE FROM products WHERE oem_number LIKE 'ZZ-FV-%'");
  await q("DELETE FROM vehicle_versions WHERE generation_id LIKE 'zz-fv-%'"); await q("DELETE FROM vehicle_generations WHERE id LIKE 'zz-fv-%'"); await q("DELETE FROM vehicle_models WHERE id LIKE 'zz-fv-%'"); await q("DELETE FROM vehicle_brands WHERE id LIKE 'zz-fv-%'");
};
let requirement = { min_photos: 0, photos_required: false, video_required: false };      // the product requirements (photos and video): read from the database, so the test works with whatever is required there
const create = async (fitment, extra = {}) => call('POST', '/supplier/me/products', supplierToken, {
  nameZh: '测试刹车盘', category: 'brake', part: 'part_brake_front_disc', oemNumber: `ZZ-FV-${Math.random().toString(36).slice(2, 8)}`, price: 100, currencyCode: 'CNY', weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, stockQuantity: 5, fitment,
  images: requirement.photos_required ? Array.from({ length: requirement.min_photos }, (_, i) => `/uploads/zz-fv-${i}.jpg`) : [], videoUrl: requirement.video_required ? '/uploads/zz-fv.mp4' : undefined, ...extra });
const entryOf = async (productId) => (await q('SELECT id FROM product_fitment_entries WHERE product_id = $1 ORDER BY id', [productId])).rows.map((r) => r.id);
const versionsOf = async (productId) => (await q('SELECT v.version_id FROM product_fitment_entry_versions v JOIN product_fitment_entries e ON e.id = v.entry_id WHERE e.product_id = $1 ORDER BY v.version_id', [productId])).rows.map((r) => r.version_id);

before(async () => {
  await q('CREATE TABLE IF NOT EXISTS product_requirements (id INTEGER PRIMARY KEY, min_photos INTEGER NOT NULL DEFAULT 0, photos_required BOOLEAN NOT NULL DEFAULT false, video_required BOOLEAN NOT NULL DEFAULT false)');      // (it exists in a full database; only a trimmed test database lacks it)
  await q('INSERT INTO product_requirements (id, min_photos, photos_required, video_required) VALUES (1, 0, false, false) ON CONFLICT (id) DO NOTHING');
  requirement = (await q('SELECT * FROM product_requirements WHERE id = 1')).rows[0];
  await wipe(); await q("INSERT INTO vehicle_brands (id, name) VALUES ('zz-fv-b', 'ZZ Brand')"); await q("INSERT INTO vehicle_models (id, brand_id, name) VALUES ('zz-fv-m', 'zz-fv-b', 'ZZ Model')");
  for (const g of ['zz-fv-g', 'zz-fv-g2']) await q("INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ($1, 'zz-fv-m', 'ZZ Gen', 2020, 2026)", [g]);
  for (const [id, g, name, engine, seats] of [['zz-fv-v1', 'zz-fv-g', 'Premium RWD', '1 motor', 5], ['zz-fv-v2', 'zz-fv-g', 'Performance AWD', '2 motors', 5], ['zz-fv-v3', 'zz-fv-g', 'Excellence AWD', '2 motors', 5], ['zz-fv-w1', 'zz-fv-g2', 'Other gen version', '1 motor', 5]]) await q("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, sort_order) VALUES ($1, $2, $3, $3, $3, $4, $4, $4, $5, 1)", [id, g, name, engine, seats]);
  const app = express(); app.use(express.json()); app.use('/auth', require('../src/modules/auth/routes')); app.use('/supplier', require('../src/modules/supplier/routes')); app.use('/catalog', require('../src/modules/catalog/routes')); app.use((err, req, res, next) => res.status(500).json({ error: err.message })); server = app.listen(0); base = `http://localhost:${server.address().port}`;
  supplierToken = await login('supplier@leap.dev', 'supplier_dev_password_123'); adminToken = await login('admin@leap.dev', 'admin_dev_password_123');
});
after(async () => { await wipe(); server.close(); await db.getPool().end(); });

// ---------------------------------------------------------------- the buyer's rules (pure)
const e = (gen, year, versions) => ({ generation_id: gen, year, versions });
const v = (id, name) => ({ id, name, nameAr: null, nameZh: null });
test('no entry is narrowed: no rules at all (every part works exactly as before versions existed)', () => { assert.deepEqual(buyerVersionRules([]), { fitVersions: {}, fitVersionNames: {} }); assert.deepEqual(buyerVersionRules([e('g', 2023, null), e('g', 2024, [])]), { fitVersions: {}, fitVersionNames: {} }); assert.deepEqual(buyerVersionRules(undefined), { fitVersions: {}, fitVersionNames: {} }); });
test('a narrowed car is listed with its versions and their names; the other cars are not', () => {
  const r = buyerVersionRules([e('g', 2023, [v('a', 'AWD'), v('b', 'RWD')]), e('g', 2024, null)]); assert.deepEqual(r.fitVersions, { 'g|2023': ['a', 'b'] }); assert.deepEqual(Object.keys(r.fitVersionNames).sort(), ['a', 'b']); assert.equal(r.fitVersionNames.a.name, 'AWD');
});
test('two entries for the SAME car: if one fits every version the car fits every version; otherwise their versions are joined', () => {
  assert.deepEqual(buyerVersionRules([e('g', 2023, [v('a', 'A')]), e('g', 2023, null)]).fitVersions, {}); assert.deepEqual(buyerVersionRules([e('g', 2023, null), e('g', 2023, [v('a', 'A')])]).fitVersions, {});
  assert.deepEqual(buyerVersionRules([e('g', 2023, [v('a', 'A')]), e('g', 2023, [v('b', 'B'), v('a', 'A')])]).fitVersions, { 'g|2023': ['a', 'b'] });
});
test('different cars are independent', () => { assert.deepEqual(buyerVersionRules([e('g', 2023, [v('a', 'A')]), e('g2', 2023, [v('x', 'X')])]).fitVersions, { 'g|2023': ['a'], 'g2|2023': ['x'] }); });

// ---------------------------------------------------------------- the choice's checks
test('resolveVersionChoice: none means every version; a real subset is kept; choosing EVERY version is stored as every version; duplicates and blanks are dealt with', async () => {
  assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', undefined), { ids: [] }); assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', null), { ids: [] }); assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', []), { ids: [] });
  assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', ['zz-fv-v2', 'zz-fv-v3']), { ids: ['zz-fv-v2', 'zz-fv-v3'] }); assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', ['zz-fv-v1', 'zz-fv-v2', 'zz-fv-v3']), { ids: [] }, 'all three = every version');
  assert.deepEqual(await resolveVersionChoice(db, 'zz-fv-g', ['zz-fv-v2', 'zz-fv-v2']), { ids: ['zz-fv-v2'] });
});
test('resolveVersionChoice: a bad choice is an error: not a list, a blank or non-text entry, an unknown version, another generation\'s version, too many', async () => {
  for (const bad of ['zz-fv-v1', 5, {}, [''], [5], ['nope'], ['zz-fv-w1'], ['zz-fv-v1', 'zz-fv-w1'], Array.from({ length: 61 }, (_, i) => `x${i}`)]) assert.ok((await resolveVersionChoice(db, 'zz-fv-g', bad)).error, JSON.stringify(bad).slice(0, 40));
});

// ---------------------------------------------------------------- the writing and reading of a part's fitment (the same functions the routes call)
let pn = 0;
const makeProduct = async () => { const id = `zz-fv-p${++pn}-${Math.random().toString(36).slice(2, 6)}`; await q("INSERT INTO products (id, name, price, currency_code, supplier_id, stock_quantity, category, status, oem_number) VALUES ($1, 'ZZ part', 100, 'CNY', 's1', 5, 'brake', 'active', $2)", [id, `ZZ-FV-${id}`]); return id; };
const inTx = async (fn) => { const c = await db.getPool().connect(); try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); } };
test('CRITICAL: a part\'s car narrowed to some versions: the rows are stored, the supplier\'s list shows the versions, the buyer\'s answer carries the rule and the names', async () => {
  const id = await makeProduct(); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v2', 'zz-fv-v3']));
  assert.deepEqual(await versionsOf(id), ['zz-fv-v2', 'zz-fv-v3']);
  const cars = (await loadProductCars(db, [id])).get(id).cars; assert.equal(cars.length, 1); assert.deepEqual(cars[0].versions.map((x) => x.id).sort(), ['zz-fv-v2', 'zz-fv-v3']); assert.equal(cars[0].versions.find((x) => x.id === 'zz-fv-v2').name.en, 'Performance AWD'); assert.equal(cars[0].versions[0].seats, 5);
  for (const key of ['year', 'brand', 'model', 'engine', 'transmission', 'photoUrl', 'versions']) assert.ok(key in cars[0], `the supplier's car still carries ${key}`);
  const fit = await loadBuyerFit(db, id); assert.deepEqual(fit.fitKeys, ['zz-fv-g|2023']); assert.deepEqual(Object.keys(fit.fitVersions), ['zz-fv-g|2023']); assert.deepEqual([...fit.fitVersions['zz-fv-g|2023']].sort(), ['zz-fv-v2', 'zz-fv-v3']); assert.equal(fit.fitVersionNames['zz-fv-v3'].name, 'Excellence AWD');
});
test('CRITICAL: no versions (the default) behaves exactly as before: nothing stored, no rule, the car carries no versions', async () => {
  const id = await makeProduct(); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, [])); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2024 }, undefined));
  assert.deepEqual(await versionsOf(id), []); assert.deepEqual((await loadBuyerFit(db, id)).fitVersions, {}); assert.deepEqual((await loadBuyerFit(db, id)).fitVersionNames, {}); for (const c of (await loadProductCars(db, [id])).get(id).cars) assert.equal(c.versions, null);
  assert.deepEqual((await loadBuyerFit(db, id)).fitKeys, ['zz-fv-g|2023', 'zz-fv-g|2024'], 'the existing fit keys are unchanged');
});
test('one part, several cars: only the narrowed one carries a rule', async () => {
  const id = await makeProduct(); await inTx(async (c) => { await insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2022 }, []); await insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v1']); });
  assert.deepEqual((await loadBuyerFit(db, id)).fitVersions, { 'zz-fv-g|2023': ['zz-fv-v1'] });
});
test('the version rows go away with the part\'s fitment (no orphans)', async () => {
  const id = await makeProduct(); const entry = await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2024 }, ['zz-fv-v1'])); await q('DELETE FROM product_fitment_entries WHERE id = $1', [entry]); assert.equal(Number((await q('SELECT COUNT(*) AS n FROM product_fitment_entry_versions WHERE entry_id = $1', [entry])).rows[0].n), 0);
});
test('a version deleted from the catalogue leaves the part narrowed to the others', async () => {
  await q("INSERT INTO vehicle_versions (id, generation_id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, sort_order) VALUES ('zz-fv-v4', 'zz-fv-g', 'Temp', 'Temp', 'Temp', 'x', 'x', 'x', 5, 9)"); const id = await makeProduct(); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v1', 'zz-fv-v4']));
  assert.deepEqual(await versionsOf(id), ['zz-fv-v1', 'zz-fv-v4']); await q("DELETE FROM vehicle_versions WHERE id = 'zz-fv-v4'"); assert.deepEqual(await versionsOf(id), ['zz-fv-v1']);
});

// ---------------------------------------------------------------- the admin's re-save of the whole list
test('CRITICAL: an admin re-saving the fitment list (without versionIds) does NOT lose the narrowing; versionIds replaces it; an empty list clears it; a bad choice reports an error', async () => {
  const id = await makeProduct(); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v2']));
  const save = (fitment) => inTx(async (c) => { const r = await replaceProductFitment(c, id, fitment); if (r.error) throw Object.assign(new Error(r.error), { fit: true }); return r; });
  await save([{ generationId: 'zz-fv-g', year: 2023 }, { generationId: 'zz-fv-g', year: 2024 }]); assert.deepEqual(await versionsOf(id), ['zz-fv-v2'], 'the 2023 narrowing is kept, the new 2024 car fits every version'); assert.equal((await entryOf(id)).length, 2); assert.deepEqual((await loadBuyerFit(db, id)).fitVersions, { 'zz-fv-g|2023': ['zz-fv-v2'] });
  await save([{ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-v1', 'zz-fv-v3'] }]); assert.deepEqual(await versionsOf(id), ['zz-fv-v1', 'zz-fv-v3'], 'versionIds replaces the narrowing');
  await save([{ generationId: 'zz-fv-g', year: 2023, versionIds: [] }]); assert.deepEqual(await versionsOf(id), [], 'an empty list means every version');
  await save([{ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-v2'] }]); await assert.rejects(save([{ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-w1'] }]), (err) => err.fit && /does not belong/.test(err.message)); assert.deepEqual(await versionsOf(id), ['zz-fv-v2'], 'the failed save rolled everything back'); assert.equal((await entryOf(id)).length, 1);
});
test('the narrowing is per car: re-saving with a DIFFERENT year, engine or transmission does not carry it to the new car', async () => {
  const id = await makeProduct(); await inTx((c) => insertFitmentEntry(c, id, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v2'])); await inTx((c) => replaceProductFitment(c, id, [{ generationId: 'zz-fv-g', year: 2025 }])); assert.deepEqual(await versionsOf(id), []);
});
test('readVersionsByEntry: nothing for no entries', async () => { assert.equal((await readVersionsByEntry(db, [])).size, 0); assert.equal((await readVersionsByEntry(db, undefined)).size, 0); });

// ---------------------------------------------------------------- the routes use them (read from the code, so it holds even where a route cannot run)
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', f), 'utf8');
test('the supplier\'s create call checks the choice BEFORE creating the product (400 and a rollback on a bad one) and saves it with the entry', () => {
  const s = src('supplier/routes.js'); const check = s.indexOf('resolveVersionChoice(client, generationId, fitment.versionIds)'); const create = s.indexOf("`INSERT INTO products\n         (id, supplier_id, name, name_zh"); const save = s.indexOf('insertFitmentEntry(client, id, { generationId, year, engineId, transmissionId }, versionChoice.ids)');
  assert.ok(check > 0 && create > check && save > create, 'check, then create the product, then save the entry with its versions'); assert.match(s.slice(check, check + 250), /versionChoice\.error[\s\S]{0,60}ROLLBACK[\s\S]{0,60}status\(400\)/);
});
test('the admin\'s fitment edit goes through replaceProductFitment (which keeps the narrowing), with a rollback and 400 on a bad choice', () => {
  const c = src('catalog/routes.js'); assert.ok(c.includes('replaceProductFitment(client, req.params.id, fitment)')); assert.match(c, /replaced\.error[\s\S]{0,60}ROLLBACK[\s\S]{0,60}status\(400\)/); assert.ok(!c.includes("DELETE FROM product_fitment_entries WHERE product_id = $1', [req.params.id]"), 'the old delete-and-insert (which lost the narrowing) is gone from the route');
});
test('the supplier list and the buyer\'s product answer carry the versions', () => {
  const p = src('orderVehicles/productCars.js'); assert.ok(p.includes('...buyerVersionRules(entries.slice(0, MAX_KEYS))')); assert.ok(p.includes('versions: r.versions ? r.versions.map')); assert.ok(p.includes('pfe.id AS entry_id'));
});

// ---------------------------------------------------------------- end to end through the real create route (only where that route can run)
test('END TO END: a supplier creates a part narrowed to some versions through the real route (skipped where the route cannot run: it needs the full database and files of your project)', async (t) => {
  const r = await create({ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-v2', 'zz-fv-v3'] }); const j = await r.json().catch(() => ({}));
  routeWorks = r.status === 201; if (!routeWorks) return t.skip(`the create route answered ${r.status} here: ${typeof j.error === 'string' ? j.error.slice(0, 80) : 'an environment limit'}`);
  const id = j.id || j.productId; assert.deepEqual(await versionsOf(id), ['zz-fv-v2', 'zz-fv-v3']); assert.deepEqual((await loadBuyerFit(db, id)).fitVersions, { 'zz-fv-g|2023': ['zz-fv-v2', 'zz-fv-v3'] });
  for (const bad of [['zz-fv-w1'], ['nope'], 'zz-fv-v1']) { const b = await create({ generationId: 'zz-fv-g', year: 2023, versionIds: bad }); assert.equal(b.status, 400, JSON.stringify(bad)); assert.match((await b.json()).error, /versionIds/); }
  const none = await (await create({ generationId: 'zz-fv-g', year: 2023 })).json(); assert.deepEqual(await versionsOf(none.id || none.productId), []);
});
test('END TO END: the admin\'s product edit keeps the narrowing (skipped where the route cannot run)', async (t) => {
  if (!routeWorks) return t.skip('the create route cannot run here');
  const j = await (await create({ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-v2'] })).json(); const id = j.id || j.productId; const r = await call('PATCH', `/catalog/admin/products/${id}`, adminToken, { fitment: [{ generationId: 'zz-fv-g', year: 2023 }, { generationId: 'zz-fv-g', year: 2024 }] });
  assert.equal(r.status, 200); assert.deepEqual(await versionsOf(id), ['zz-fv-v2']); assert.equal((await call('PATCH', `/catalog/admin/products/${id}`, adminToken, { fitment: [{ generationId: 'zz-fv-g', year: 2023, versionIds: ['zz-fv-w1'] }] })).status, 400); assert.deepEqual(await versionsOf(id), ['zz-fv-v2']);
});

// ---------------------------------------------------------------- the search filter "Parts fit with my car" uses the buyer's version
const { buildProductMatchQuery } = require('../src/modules/catalog/routes');
const found = async (args) => { const { sql, params } = buildProductMatchQuery(args); const { rows } = await q(sql, params); return new Set(rows.map((r) => r.id)); };
test('CRITICAL: the filter with the buyer\'s version: a part narrowed to OTHER versions is not listed; a part for the buyer\'s version, and a part that is not narrowed, are', async () => {
  const all = await makeProduct(); const forV2 = await makeProduct(); const forV1 = await makeProduct(); const other = await makeProduct();
  await inTx(async (c) => { await insertFitmentEntry(c, all, { generationId: 'zz-fv-g', year: 2023 }, []); await insertFitmentEntry(c, forV2, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v2']); await insertFitmentEntry(c, forV1, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v1']); await insertFitmentEntry(c, other, { generationId: 'zz-fv-g', year: 2022 }, []); });
  const mine = [all, forV2, forV1, other]; const pick = (s) => mine.filter((id) => s.has(id));
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v2' })), [all, forV2], 'version 2: the open part and the part for version 2');
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v1' })), [all, forV1]);
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v3' })), [all], 'a version no narrowed part is for: only the open part');
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', year: 2023 })), [all, forV2, forV1], 'no version (a saved car without one, or the old behaviour): every part of that year, narrowed or not');
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', versionId: 'zz-fv-v2' })), [all, forV2, other], 'without a year the version still applies');
  assert.deepEqual(pick(await found({ generationId: 'zz-fv-g', year: 2022, versionId: 'zz-fv-v2' })), [other], 'another year is another car');
});
test('a stale version (one that belongs to another generation) is ignored, so it can never hide parts', async () => {
  const forV1 = await makeProduct(); await inTx((c) => insertFitmentEntry(c, forV1, { generationId: 'zz-fv-g', year: 2023 }, ['zz-fv-v1']));
  assert.ok((await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-w1' })).has(forV1), 'the other generation\'s version is ignored'); assert.ok((await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'no-such-version' })).has(forV1));
});
test('the filter still works with the other filters and with a part that has two entries for the same car (one open, one narrowed)', async () => {
  const both = await makeProduct(); await inTx(async (c) => { await insertFitmentEntry(c, both, { generationId: 'zz-fv-g', year: 2023, engineId: null }, ['zz-fv-v1']); await insertFitmentEntry(c, both, { generationId: 'zz-fv-g', year: 2023, transmissionId: null }, []); });
  assert.ok((await found({ generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v3' })).has(both), 'one open entry makes the car fit every version');
  assert.ok((await found({ category: 'brake', generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v3' })).has(both));
  const { sql, params } = buildProductMatchQuery({ category: 'brake', part: 'part_brake_front_disc', generationId: 'zz-fv-g', year: 2023, versionId: 'zz-fv-v2' }); await q(sql, params); assert.equal((sql.match(/\$\d+/g) || []).every((p) => Number(p.slice(1)) <= params.length), true, 'every placeholder has a value');
});
test('the list route reads the version, passes it to the query, and keeps lists of different versions apart in its cache', () => {
  const c = src('catalog/routes.js'); assert.ok(c.includes('versionId, minPrice, maxPrice, maxDeliveryDays, page, limit, more } = req.query;')); assert.ok(c.includes('buildProductMatchQuery({ category, part, vehicleId, search, generationId, year, versionId });')); assert.ok(c.includes('generationId, year, versionId, minPrice, maxPrice, maxDeliveryDays, destinationIsoCode }), computeList)'), 'versionId is in the cache key');
});
