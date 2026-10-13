// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

// The photo moved to the vehicle YEAR (generation): required when a year is added, optional for a brand and a model. Real backend, real database.
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

// brand -> model, created through the API (a brand WITHOUT a photo: that is allowed now)
async function newModel(token, { brandPhoto, modelPhoto } = {}) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const brand = await post('/fitment/brands', token, { name: `Year Photo Brand ${suffix}`, nameAr: 'علامة', ...(brandPhoto ? { photoUrl: brandPhoto } : {}) }).then((r) => r.json());
  const model = await post(`/fitment/brands/${brand.id}/models`, token, { name: `Year Photo Model ${suffix}`, nameAr: 'موديل', ...(modelPhoto ? { photoUrl: modelPhoto } : {}) }).then((r) => r.json());
  return { brand, model };
}
const yearsOf = (modelId) => fetch(`${BACKEND_URL}/fitment/models/${modelId}/generations`).then((r) => r.json());

describe.runIf(backendUp)('the vehicle YEAR photo (real backend)', () => {
  it('CRITICAL: a brand no longer needs a photo (none, blank or given all work); a given photo is kept', async () => {
    const token = await adminToken();
    const none = await post('/fitment/brands', token, { name: `No Photo ${Date.now()}`, nameAr: 'بلا صورة' });
    expect(none.status).toBe(201);
    expect((await none.json()).photoUrl).toBeNull();
    const blank = await post('/fitment/brands', token, { name: `Blank Photo ${Date.now()}`, nameAr: 'فارغ', photoUrl: '   ' });
    expect(blank.status).toBe(201);
    expect((await blank.json()).photoUrl).toBeNull();
    const given = await post('/fitment/brands', token, { name: `With Photo ${Date.now()}`, nameAr: 'مع صورة', photoUrl: '/uploads/brand.png' });
    expect(given.status).toBe(201);
    expect((await given.json()).photoUrl).toBe('/uploads/brand.png');
    const noName = await post('/fitment/brands', token, { nameAr: 'x' });
    expect(noName.status).toBe(400);                                              // the other rules still hold
    const noArabic = await post('/fitment/brands', token, { name: `X ${Date.now()}` });
    expect(noArabic.status).toBe(400);
  }, 60000);

  it('CRITICAL: a YEAR requires a photo: refused without one (missing, blank, not text), nothing is created, and created with one it is returned in the list', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    for (const [label, body] of [['missing', { name: 'G1', yearStart: 2020 }], ['blank', { name: 'G1', yearStart: 2020, photoUrl: '   ' }], ['empty', { name: 'G1', yearStart: 2020, photoUrl: '' }], ['not text', { name: 'G1', yearStart: 2020, photoUrl: 123 }], ['null', { name: 'G1', yearStart: 2020, photoUrl: null }]]) {
      const res = await post(`/fitment/models/${model.id}/generations`, token, body);
      expect(res.status, label).toBe(400);
      expect((await res.json()).error, label).toBe('photoUrl is required');
    }
    expect(await yearsOf(model.id)).toEqual([]);                                  // nothing was created by the refusals

    const created = await post(`/fitment/models/${model.id}/generations`, token, { name: 'G1', yearStart: 2020, yearEnd: 2024, photoUrl: '  /uploads/year.jpg ' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ modelId: model.id, name: 'G1', yearStart: 2020, yearEnd: 2024, photoUrl: '/uploads/year.jpg' });   // trimmed
    expect(await yearsOf(model.id)).toMatchObject([{ name: 'G1', photoUrl: '/uploads/year.jpg' }]);
  }, 60000);

  it('the other year rules still hold: a name and start year are required, and the end year cannot be before the start (even with a photo)', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    expect((await post(`/fitment/models/${model.id}/generations`, token, { yearStart: 2020, photoUrl: '/uploads/y.jpg' })).status).toBe(400);
    expect((await post(`/fitment/models/${model.id}/generations`, token, { name: 'X', photoUrl: '/uploads/y.jpg' })).status).toBe(400);
    const range = await post(`/fitment/models/${model.id}/generations`, token, { name: 'X', yearStart: 2020, yearEnd: 2015, photoUrl: '/uploads/y.jpg' });
    expect(range.status).toBe(400);
    expect((await range.json()).error).toMatch(/yearEnd cannot be before yearStart/);
    expect((await post(`/fitment/models/model_does_not_exist/generations`, token, { name: 'X', yearStart: 2020, photoUrl: '/uploads/y.jpg' })).status).toBe(404);
  }, 60000);

  it('CRITICAL: a year that already exists WITHOUT a photo keeps working (listed with photoUrl null) and gets one with the photo endpoint; the photo can be replaced later', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    // how every year created before this change looks: a row with no photo
    await pool.query(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, 'Old year', 2010, 2014, 10)`, [`gen_old_${Date.now()}`, model.id]);
    const [old] = await yearsOf(model.id);
    expect(old.photoUrl).toBeNull();
    expect((await patch(`/fitment/generations/${old.id}`, token, { name: 'Old year renamed', yearStart: 2010, yearEnd: 2014 })).status).toBe(200);   // other edits work without a photo

    const added = await patch(`/fitment/generations/${old.id}/photo`, token, { photoUrl: '/uploads/first.jpg' });
    expect(added.status).toBe(200);
    expect(await added.json()).toMatchObject({ id: old.id, name: 'Old year renamed', photoUrl: '/uploads/first.jpg' });
    const replaced = await patch(`/fitment/generations/${old.id}/photo`, token, { photoUrl: '/uploads/second.jpg' });
    expect((await replaced.json()).photoUrl).toBe('/uploads/second.jpg');
    expect((await yearsOf(model.id))[0].photoUrl).toBe('/uploads/second.jpg');
    // editing the name or the years must not lose the photo
    await patch(`/fitment/generations/${old.id}`, token, { name: 'Renamed again', yearStart: 2010, yearEnd: 2015 });
    expect((await yearsOf(model.id))[0]).toMatchObject({ name: 'Renamed again', photoUrl: '/uploads/second.jpg' });
  }, 60000);

  it('CRITICAL: only an admin who may open Vehicle Data can change a year\'s photo; blank or missing photos and unknown years are refused', async () => {
    const token = await adminToken();
    const { model } = await newModel(token);
    const year = await post(`/fitment/models/${model.id}/generations`, token, { name: 'G1', yearStart: 2020, photoUrl: '/uploads/year.jpg' }).then((r) => r.json());
    expect((await patch(`/fitment/generations/${year.id}/photo`, token, { photoUrl: '' })).status).toBe(400);
    expect((await patch(`/fitment/generations/${year.id}/photo`, token, {})).status).toBe(400);
    expect((await patch(`/fitment/generations/gen_nope/photo`, token, { photoUrl: '/uploads/x.jpg' })).status).toBe(404);
    expect((await patch(`/fitment/generations/${year.id}/photo`, null, { photoUrl: '/uploads/x.jpg' })).status).toBe(401);          // not signed in

    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `yearphoto.${Date.now()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    expect((await patch(`/fitment/generations/${year.id}/photo`, buyer.token, { photoUrl: '/uploads/x.jpg' })).status).toBe(403);   // a buyer

    const email = `perm-test-${Date.now()}@leap.dev`;                                            // an admin with other pages only
    const limited = await post('/admin-users', token, { email, password: 'test_password_123', allowedPages: ['orders'] });
    expect(limited.status).toBe(201);
    const limitedToken = (await login(email, 'test_password_123')).token;
    expect((await patch(`/fitment/generations/${year.id}/photo`, limitedToken, { photoUrl: '/uploads/x.jpg' })).status).toBe(403);
    expect((await post(`/fitment/models/${model.id}/generations`, limitedToken, { name: 'G2', yearStart: 2021, photoUrl: '/uploads/y.jpg' })).status).toBe(403);
    expect((await yearsOf(model.id))[0].photoUrl).toBe('/uploads/year.jpg');                      // untouched by all of the refusals
  }, 90000);

  it('CRITICAL: the buyer\'s garage carries the YEAR photo first, with the model and brand photos still there as the fallbacks, and null where a year has none', async () => {
    const token = await adminToken();
    const { brand, model } = await newModel(token, { brandPhoto: '/uploads/brand.png', modelPhoto: '/uploads/model.png' });
    const withPhoto = await post(`/fitment/models/${model.id}/generations`, token, { name: 'New', yearStart: 2022, yearEnd: 2025, photoUrl: '/uploads/year-new.jpg' }).then((r) => r.json());
    const oldId = `gen_old_${Date.now()}`;
    await pool.query(`INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end, sort_order) VALUES ($1, $2, 'Old', 2010, 2014, 20)`, [oldId, model.id]);
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `garage.${Date.now()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());

    expect((await post('/garage/me', buyer.token, { generationId: withPhoto.id, year: 2023 })).status).toBeLessThan(300);
    expect((await post('/garage/me', buyer.token, { generationId: oldId, year: 2012 })).status).toBeLessThan(300);
    const garage = await fetch(`${BACKEND_URL}/garage/me`, { headers: auth(buyer.token) }).then((r) => r.json());
    const fresh = garage.find((v) => v.generationId === withPhoto.id);
    const old = garage.find((v) => v.generationId === oldId);
    expect(fresh).toMatchObject({ generationPhotoUrl: '/uploads/year-new.jpg', modelPhotoUrl: '/uploads/model.png', brandPhotoUrl: '/uploads/brand.png' });
    expect(old.generationPhotoUrl).toBeNull();                                                      // a year without a photo: the app falls back to the model's
    expect(old).toMatchObject({ modelPhotoUrl: '/uploads/model.png', brandPhotoUrl: '/uploads/brand.png' });

    await patch(`/fitment/generations/${oldId}/photo`, token, { photoUrl: '/uploads/old-now-has.jpg' });   // adding the photo later shows up in the garage
    const again = await fetch(`${BACKEND_URL}/garage/me`, { headers: auth(buyer.token) }).then((r) => r.json());
    expect(again.find((v) => v.generationId === oldId).generationPhotoUrl).toBe('/uploads/old-now-has.jpg');
    expect(brand.id).toBeTruthy();
  }, 90000);

  it('the database column is nullable, so every year that existed before this change stays valid', async () => {
    const { rows } = await pool.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'vehicle_generations' AND column_name = 'photo_url'`);
    expect(rows).toEqual([{ is_nullable: 'YES' }]);
  });
});
