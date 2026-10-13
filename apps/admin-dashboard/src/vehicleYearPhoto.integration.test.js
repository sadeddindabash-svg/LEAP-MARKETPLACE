// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

// A vehicle is added in three steps, and each asks for only this (real backend, real database):
//   Brand : English name + Arabic name + photo, all required
//   Model : English name + Arabic name, nothing else (no photo)
//   Year  : the year in English digits + photo, both required (stored as a one-year entry named by the year)
const BACKEND_URL = 'http://localhost:4000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const pool = new Pool({ connectionString: DB_URL });
afterAll(async () => { await pool.end(); });
async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();
const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const post = (path, token, body) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
const patch = (path, token, body) => fetch(`${BACKEND_URL}${path}`, { method: 'PATCH', headers: token ? auth(token) : json, body: JSON.stringify(body) });
const nextYear = new Date().getFullYear() + 1;

async function newModel(token) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const brand = await post('/fitment/brands', token, { name: `Three Step Brand ${suffix}`, nameAr: 'علامة', photoUrl: '/uploads/brand.png' }).then((r) => r.json());
  const model = await post(`/fitment/brands/${brand.id}/models`, token, { name: `Three Step Model ${suffix}`, nameAr: 'موديل' }).then((r) => r.json());
  return { brand, model };
}
const yearsOf = (modelId) => fetch(`${BACKEND_URL}/fitment/models/${modelId}/generations`).then((r) => r.json());
const addYear = (token, modelId, body) => post(`/fitment/models/${modelId}/generations`, token, body);

describe.runIf(backendUp)('adding a vehicle in three steps (real backend)', () => {
  it('CRITICAL: a BRAND needs all three: English name, Arabic name AND a photo (each missing one is refused, nothing is created)', async () => {
    const token = await adminToken();
    const suffix = Date.now();
    const cases = [['no English name', { nameAr: 'ع', photoUrl: '/uploads/b.png' }, 'name is required'], ['no Arabic name', { name: `B ${suffix}`, photoUrl: '/uploads/b.png' }, 'nameAr is required'],
      ['no photo', { name: `B ${suffix}`, nameAr: 'ع' }, 'photoUrl is required'], ['blank photo', { name: `B ${suffix}`, nameAr: 'ع', photoUrl: '   ' }, 'photoUrl is required'],
      ['photo not text', { name: `B ${suffix}`, nameAr: 'ع', photoUrl: 5 }, 'photoUrl is required']];
    for (const [label, body, error] of cases) {
      const res = await post('/fitment/brands', token, body);
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe(error);
    }
    const brands = await fetch(`${BACKEND_URL}/fitment/brands`).then((r) => r.json());
    expect(brands.some((b) => b.name === `B ${suffix}`)).toBe(false);                                  // none of the refusals created a brand
    const ok = await post('/fitment/brands', token, { name: `Full Brand ${suffix}`, nameAr: 'علامة كاملة', photoUrl: ' /uploads/brand.png ' });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({ name: `Full Brand ${suffix}`, nameAr: 'علامة كاملة', photoUrl: '/uploads/brand.png' });
  }, 60000);

  it('CRITICAL: a MODEL needs only its English and Arabic names; it has no photo (one sent along is ignored)', async () => {
    const token = await adminToken();
    const { brand } = await newModel(token);
    expect((await post(`/fitment/brands/${brand.id}/models`, token, { nameAr: 'موديل' })).status).toBe(400);
    expect((await post(`/fitment/brands/${brand.id}/models`, token, { name: 'Only English' })).status).toBe(400);
    const ok = await post(`/fitment/brands/${brand.id}/models`, token, { name: 'Names Only', nameAr: 'أسماء فقط' });
    expect(ok.status).toBe(201);
    expect((await ok.json()).photoUrl).toBeNull();
    const sneaky = await post(`/fitment/brands/${brand.id}/models`, token, { name: 'Sneaky', nameAr: 'خفي', photoUrl: '/uploads/should-not-be-kept.jpg' });
    expect(sneaky.status).toBe(201);
    expect((await sneaky.json()).photoUrl).toBeNull();                                                  // models have no photo
    const models = await fetch(`${BACKEND_URL}/fitment/brands/${brand.id}/models`).then((r) => r.json());
    expect(models.every((m) => m.photoUrl === null)).toBe(true);
  }, 60000);

  it('CRITICAL: a YEAR needs the year in English digits AND a photo; every wrong year or missing photo is refused and nothing is created', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const bad = [['no year', { photoUrl: '/uploads/y.jpg' }, 'year is required'], ['empty year', { year: '  ', photoUrl: '/uploads/y.jpg' }, 'year is required'],
      ['letters', { year: 'abcd', photoUrl: '/uploads/y.jpg' }, 'four digits'], ['two digits', { year: '21', photoUrl: '/uploads/y.jpg' }, 'four digits'],
      ['five digits', { year: '20211', photoUrl: '/uploads/y.jpg' }, 'four digits'], ['a range', { year: '2019-2022', photoUrl: '/uploads/y.jpg' }, 'four digits'],
      ['too old', { year: 1949, photoUrl: '/uploads/y.jpg' }, `between 1950 and ${nextYear}`], ['too far ahead', { year: nextYear + 1, photoUrl: '/uploads/y.jpg' }, `between 1950 and ${nextYear}`],
      ['no photo', { year: 2021 }, 'photoUrl is required'], ['blank photo', { year: 2021, photoUrl: '   ' }, 'photoUrl is required'],
      ['photo not text', { year: 2021, photoUrl: 123 }, 'photoUrl is required'], ['null photo', { year: 2021, photoUrl: null }, 'photoUrl is required']];
    for (const [label, body, fragment] of bad) {
      const res = await addYear(token, model.id, body);
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toContain(fragment);
    }
    expect(await yearsOf(model.id)).toEqual([]);                                                      // nothing was created by any refusal
    expect((await addYear(token, 'model_does_not_exist', { year: 2021, photoUrl: '/uploads/y.jpg' })).status).toBe(404);
  }, 60000);

  it('CRITICAL: a year is stored as a one-year entry named by the year, with its photo; the limits 1950 and next year are accepted', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const created = await addYear(token, model.id, { year: 2021, photoUrl: '  /uploads/y2021.jpg ' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ modelId: model.id, name: '2021', yearStart: 2021, yearEnd: 2021, photoUrl: '/uploads/y2021.jpg' });
    expect((await addYear(token, model.id, { year: '1950', photoUrl: '/uploads/a.jpg' })).status).toBe(201);
    expect((await addYear(token, model.id, { year: String(nextYear), photoUrl: '/uploads/b.jpg' })).status).toBe(201);
    expect((await yearsOf(model.id)).map((y) => y.name)).toEqual([String(nextYear), '2021', '1950']);
  }, 60000);

  it('CRITICAL: a year typed in Arabic or Persian digits is converted to English digits (and counts as the same year)', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const arabic = await addYear(token, model.id, { year: '٢٠٢٣', photoUrl: '/uploads/a.jpg' });
    expect(arabic.status).toBe(201);
    expect(await arabic.json()).toMatchObject({ name: '2023', yearStart: 2023, yearEnd: 2023 });
    const persian = await addYear(token, model.id, { year: '۲۰۲۲', photoUrl: '/uploads/p.jpg' });
    expect(persian.status).toBe(201);
    expect((await persian.json()).name).toBe('2022');
    expect((await addYear(token, model.id, { year: ' 2020 ', photoUrl: '/uploads/s.jpg' })).status).toBe(201);   // spaces around are fine
    const again = await addYear(token, model.id, { year: '2023', photoUrl: '/uploads/dup.jpg' });                // the same year in English digits
    expect(again.status).toBe(409);
  }, 60000);

  it('CRITICAL: a year can be added only ONCE per model (409), but the same year on another model is fine', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const other = (await newModel(token)).model;
    expect((await addYear(token, model.id, { year: 2021, photoUrl: '/uploads/first.jpg' })).status).toBe(201);
    const dup = await addYear(token, model.id, { year: 2021, photoUrl: '/uploads/second.jpg' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('2021 already exists for this model');
    const list = await yearsOf(model.id);
    expect(list).toHaveLength(1);
    expect(list[0].photoUrl).toBe('/uploads/first.jpg');                                                      // the first one is untouched
    expect((await addYear(token, other.id, { year: 2021, photoUrl: '/uploads/other.jpg' })).status).toBe(201);
    // ten requests for the same year arriving AT THE SAME TIME (a double click, two admins): exactly one creates it, the other nine are told it exists
    const { model: racing } = await newModel(token);
    const many = await Promise.all(Array.from({ length: 10 }, (_, i) => addYear(token, racing.id, { year: 2019, photoUrl: `/uploads/r${i}.jpg` })));
    expect(many.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    expect(await yearsOf(racing.id)).toHaveLength(1);
    // different years at the same moment are all created (the lock only serializes one model, and ids never collide)
    const { model: busy } = await newModel(token);
    const different = await Promise.all([2015, 2016, 2017, 2018, 2019, 2020].map((y) => addYear(token, busy.id, { year: y, photoUrl: `/uploads/${y}.jpg` })));
    expect(different.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    expect((await yearsOf(busy.id)).map((y) => y.name)).toEqual(['2020', '2019', '2018', '2017', '2016', '2015']);
  }, 60000);

  it('CRITICAL: the old way of adding a year (a name and a range) is not accepted any more; only { year, photoUrl }', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const old = await addYear(token, model.id, { name: 'F20', yearStart: 2015, yearEnd: 2019, photoUrl: '/uploads/y.jpg' });
    expect(old.status).toBe(400);
    expect((await old.json()).error).toBe('year is required');
    expect(await yearsOf(model.id)).toEqual([]);
  }, 60000);

  it('CRITICAL: years are listed NEWEST FIRST (older entries with a range by their first year)', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    for (const y of [2019, 2023, 2021]) expect((await addYear(token, model.id, { year: y, photoUrl: `/uploads/${y}.jpg` })).status).toBe(201);
    await pool.query(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, 'F20', 2015, 2018, 5)`, [`gen_old_${Date.now()}`, model.id]);
    expect((await yearsOf(model.id)).map((y) => y.name)).toEqual(['2023', '2021', '2019', 'F20']);
  }, 60000);

  it('CRITICAL: an OLDER entry (a name and a range, no photo) keeps working: listed with photoUrl null, gets a photo, can be edited and deleted, and keeps its photo when edited', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    await pool.query(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, 'Old year', 2010, 2014, 10)`, [`gen_old_${Date.now()}`, model.id]);
    const [old] = await yearsOf(model.id);
    expect(old).toMatchObject({ name: 'Old year', yearStart: 2010, yearEnd: 2014, photoUrl: null });
    const added = await patch(`/fitment/generations/${old.id}/photo`, token, { photoUrl: '/uploads/first.jpg' });
    expect(added.status).toBe(200);
    expect((await added.json()).photoUrl).toBe('/uploads/first.jpg');
    expect((await (await patch(`/fitment/generations/${old.id}/photo`, token, { photoUrl: '/uploads/second.jpg' })).json()).photoUrl).toBe('/uploads/second.jpg');
    expect((await patch(`/fitment/generations/${old.id}`, token, { name: 'Renamed', yearStart: 2010, yearEnd: 2015 })).status).toBe(200);
    expect((await yearsOf(model.id))[0]).toMatchObject({ name: 'Renamed', yearEnd: 2015, photoUrl: '/uploads/second.jpg' });
    expect((await fetch(`${BACKEND_URL}/fitment/generations/${old.id}`, { method: 'DELETE', headers: auth(token) })).status).toBeLessThan(300);
    expect(await yearsOf(model.id)).toEqual([]);
  }, 60000);

  it('CRITICAL: only an admin who may open Vehicle Data can add a year or change a year\'s photo; the refusals change nothing', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const year = await addYear(token, model.id, { year: 2021, photoUrl: '/uploads/year.jpg' }).then((r) => r.json());
    expect((await patch(`/fitment/generations/${year.id}/photo`, token, { photoUrl: '' })).status).toBe(400);
    expect((await patch(`/fitment/generations/${year.id}/photo`, token, {})).status).toBe(400);
    expect((await patch(`/fitment/generations/gen_nope/photo`, token, { photoUrl: '/uploads/x.jpg' })).status).toBe(404);
    expect((await patch(`/fitment/generations/${year.id}/photo`, null, { photoUrl: '/uploads/x.jpg' })).status).toBe(401);
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `yearphoto.${Date.now()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    expect((await patch(`/fitment/generations/${year.id}/photo`, buyer.token, { photoUrl: '/uploads/x.jpg' })).status).toBe(403);
    const email = `perm-test-${Date.now()}@leap.dev`;
    expect((await post('/admin-users', token, { email, password: 'test_password_123', allowedPages: ['orders'] })).status).toBe(201);
    const limitedToken = (await login(email, 'test_password_123')).token;
    expect((await patch(`/fitment/generations/${year.id}/photo`, limitedToken, { photoUrl: '/uploads/x.jpg' })).status).toBe(403);
    expect((await addYear(limitedToken, model.id, { year: 2022, photoUrl: '/uploads/y.jpg' })).status).toBe(403);
    expect(await yearsOf(model.id)).toMatchObject([{ name: '2021', photoUrl: '/uploads/year.jpg' }]);
  }, 90000);

  it('CRITICAL: the buyer\'s garage works with one-year entries and carries the year photo, with the brand photo as the fallback and null for an older entry without one', async () => {
    const token = await adminToken();
    const { brand, model } = await newModel(token);
    const year = await addYear(token, model.id, { year: 2022, photoUrl: '/uploads/year-2022.jpg' }).then((r) => r.json());
    const oldId = `gen_old_${Date.now()}`;
    await pool.query(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, 'Old', 2010, 2014, 20)`, [oldId, model.id]);
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `garage.${Date.now()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    expect((await post('/garage/me', buyer.token, { generationId: year.id, year: 2022 })).status).toBeLessThan(300);       // a one-year entry: its single year is valid
    expect((await post('/garage/me', buyer.token, { generationId: year.id, year: 2021 })).status).toBe(400);                // any other year is not
    expect((await post('/garage/me', buyer.token, { generationId: oldId, year: 2012 })).status).toBeLessThan(300);
    const garage = await fetch(`${BACKEND_URL}/garage/me`, { headers: auth(buyer.token) }).then((r) => r.json());
    const fresh = garage.find((v) => v.generationId === year.id);
    const old = garage.find((v) => v.generationId === oldId);
    expect(fresh).toMatchObject({ generation: '2022', year: 2022, yearStart: 2022, yearEnd: 2022, generationPhotoUrl: '/uploads/year-2022.jpg', brandPhotoUrl: '/uploads/brand.png' });
    expect(old.generationPhotoUrl).toBeNull();
    expect(old.brandPhotoUrl).toBe('/uploads/brand.png');
    await patch(`/fitment/generations/${oldId}/photo`, token, { photoUrl: '/uploads/old-now-has.jpg' });
    expect((await fetch(`${BACKEND_URL}/garage/me`, { headers: auth(buyer.token) }).then((r) => r.json())).find((v) => v.generationId === oldId).generationPhotoUrl).toBe('/uploads/old-now-has.jpg');
    expect(brand.id).toBeTruthy();
  }, 90000);

  it('the database column is nullable, so every year that existed before still works', async () => {
    const { rows } = await pool.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'vehicle_generations' AND column_name = 'photo_url'`);
    expect(rows).toEqual([{ is_nullable: 'YES' }]);
  });
});
