// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_marketplace_dev' });

const login = async (email, password) => (await (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const api = (token, method, path, body) => fetch(`${BACKEND_URL}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const signup = async (tag) => { const s = await (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `gv-${tag}-${Date.now()}@leap.dev`, password: 'garage_version_pw_1' }) })).json(); return { token: s.token, id: s.user.id }; };
const version = (name, over = {}) => ({ name, nameAr: `ن ${name}`, nameZh: `中${name}`, engine: `Engine ${name}`, engineAr: 'محرك', engineZh: '发动机', seats: 5, photoUrl: '/uploads/v.png', ...over });

// SAVED CARS NOW CARRY THEIR VERSION: brand, model, year and version.
describe.runIf(backendUp)('My Garage with versions, against a REAL running backend', () => {
  let admin, brandId, gen, genNoVersions, vA, vB, vC; const buyers = [];
  beforeAll(async () => {
    admin = await login('admin@leap.dev', 'admin_dev_password_123');
    const brand = await (await api(admin, 'POST', '/fitment/brands', { name: `GVBrand ${Date.now()}`, nameAr: 'ب', nameZh: '牌', photoUrl: '/uploads/x.png' })).json(); brandId = brand.id;
    const model = await (await api(admin, 'POST', `/fitment/brands/${brandId}/models`, { name: 'G1', nameAr: 'ج', nameZh: '型' })).json();
    gen = await (await api(admin, 'POST', `/fitment/models/${model.id}/generations`, { year: 2024, photoUrl: '/uploads/y.png' })).json();
    genNoVersions = await (await api(admin, 'POST', `/fitment/models/${model.id}/generations`, { year: 2020, photoUrl: '/uploads/y.png' })).json();
    vA = await (await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version('A'))).json();
    vB = await (await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version('B', { seats: 6 }))).json();
    vC = await (await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version('C', { photoUrl: '/uploads/c.png' }))).json();
  });
  afterAll(async () => { await api(admin, 'DELETE', `/fitment/brands/${brandId}`); await db.end(); });
  const newBuyer = async (tag) => { const b = await signup(tag); buyers.push(b); return b; };
  const add = (b, body) => api(b.token, 'POST', '/garage/me', body);
  const list = async (b) => (await api(b.token, 'GET', '/garage/me')).json();

  it('CRITICAL: a year WITH versions needs one: without it the car is refused (with the message the website translates); with one of its versions the car is saved and carries it', async () => {
    const b = await newBuyer('add');
    const without = await add(b, { generationId: gen.id, year: 2024 });
    expect(without.status).toBe(400); expect((await without.json()).error).toBe('Choose the version of this car');
    const ok = await add(b, { generationId: gen.id, year: 2024, versionId: vA.id });
    expect(ok.status).toBe(201);
    const car = await ok.json();
    expect(car).toMatchObject({ generationId: gen.id, year: 2024, versionId: vA.id, versionCount: 3, version: { id: vA.id, name: 'A', nameAr: 'ن A', engine: 'Engine A', engineAr: 'محرك', seats: 5, photoUrl: '/uploads/v.png' } });
    expect((await list(b))).toHaveLength(1);
  });

  it('CRITICAL: a version of ANOTHER year is refused, and a year WITHOUT versions takes none (and works exactly as before)', async () => {
    const b = await newBuyer('year');
    const other = await (await api(admin, 'POST', `/fitment/generations/${genNoVersions.id}/versions`, version('Z'))).json();
    expect((await add(b, { generationId: gen.id, year: 2024, versionId: other.id })).status).toBe(400);
    await api(admin, 'DELETE', `/fitment/versions/${other.id}`);                       // back to a year without versions
    const plain = await add(b, { generationId: genNoVersions.id, year: 2020 });
    expect(plain.status).toBe(201);
    expect(await plain.json()).toMatchObject({ versionId: null, version: null, versionCount: 0 });
    const withVersion = await add(b, { generationId: genNoVersions.id, year: 2020, versionId: vA.id });
    expect(withVersion.status).toBe(400); expect((await withVersion.json()).error).toMatch(/does not belong to this year/);
  });

  it('CRITICAL: two versions of the same year are TWO cars; saving the same version again is not a new car', async () => {
    const b = await newBuyer('two');
    expect((await add(b, { generationId: gen.id, year: 2024, versionId: vA.id })).status).toBe(201);
    expect((await add(b, { generationId: gen.id, year: 2024, versionId: vB.id })).status).toBe(201);
    expect((await add(b, { generationId: gen.id, year: 2024, versionId: vA.id })).status).toBe(201);   // idempotent
    const cars = await list(b);
    expect(cars).toHaveLength(2);
    expect(cars.map((c) => c.version.name).sort()).toEqual(['A', 'B']);
    expect(cars.filter((c) => c.isDefault)).toHaveLength(1);
  });

  it('CRITICAL: the 5-car limit counts every version as its own car: five different versions fill the garage, a sixth car is refused, an already saved one is still fine', async () => {
    const b = await newBuyer('limit');
    const extra = [];
    for (const n of ['D', 'E']) extra.push(await (await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version(n))).json());
    for (const v of [vA, vB, vC, ...extra]) expect((await add(b, { generationId: gen.id, year: 2024, versionId: v.id })).status).toBe(201);
    expect(await list(b)).toHaveLength(5);
    const sixth = await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version('F'));
    const refused = await add(b, { generationId: gen.id, year: 2024, versionId: (await sixth.json()).id });
    expect(refused.status).toBe(400); expect((await refused.json()).error).toMatch(/up to 5 vehicles/);
    expect((await add(b, { generationId: gen.id, year: 2024, versionId: vA.id })).status).toBe(201);
    expect(await list(b)).toHaveLength(5);
    for (const v of extra) await api(admin, 'DELETE', `/fitment/versions/${v.id}`);
    const f = await (await api(null, 'GET', `/fitment/generations/${gen.id}/versions`)).json();
    for (const v of f.filter((x) => x.name === 'F')) await api(admin, 'DELETE', `/fitment/versions/${v.id}`);
  });

  it('CRITICAL: making a car the default, and removing a car, act on THAT version only', async () => {
    const b = await newBuyer('act');
    await add(b, { generationId: gen.id, year: 2024, versionId: vA.id });
    await add(b, { generationId: gen.id, year: 2024, versionId: vB.id });
    const made = await (await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/default?versionId=${vB.id}`)).json();
    expect(made.filter((c) => c.isDefault).map((c) => c.version.name)).toEqual(['B']);
    const afterRemoval = await (await api(b.token, 'DELETE', `/garage/me/${gen.id}/2024?versionId=${vB.id}`)).json();
    expect(afterRemoval.map((c) => c.version.name)).toEqual(['A']);
    expect(afterRemoval[0].isDefault).toBe(true);                                   // the other car became the default
    const wrong = await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/default`);   // no version: there is no such car
    expect(wrong.status).toBe(404);
    expect((await (await api(b.token, 'DELETE', `/garage/me/${gen.id}/2024`)).json())).toHaveLength(1);   // removing "no version" removes nothing here
  });

  it('CRITICAL: a car saved BEFORE versions existed keeps working, and can be given its version once', async () => {
    const b = await newBuyer('old');
    await db.query('INSERT INTO user_saved_generations (buyer_id, generation_id, year, is_default) VALUES ($1, $2, 2024, true)', [b.id, gen.id]);
    const old = (await list(b))[0];
    expect(old).toMatchObject({ versionId: null, version: null, versionCount: 3, isDefault: true });
    expect((await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/version`, {})).status).toBe(400);
    const wrongYear = await (await api(admin, 'POST', `/fitment/generations/${genNoVersions.id}/versions`, version('Y'))).json();
    expect((await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/version`, { versionId: wrongYear.id })).status).toBe(400);
    await api(admin, 'DELETE', `/fitment/versions/${wrongYear.id}`);
    const done = await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/version`, { versionId: vC.id });
    expect(done.status).toBe(200);
    const cars = await done.json();
    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({ versionId: vC.id, isDefault: true, version: { name: 'C', photoUrl: '/uploads/c.png' } });
    expect((await api(b.token, 'PATCH', `/garage/me/${gen.id}/2024/version`, { versionId: vA.id })).status).toBe(409);      // it already has one
    expect((await api(b.token, 'PATCH', `/garage/me/${gen.id}/2020/version`, { versionId: vA.id })).status).toBe(404);      // not a saved car
    expect((await api(null, 'PATCH', `/garage/me/${gen.id}/2024/version`, { versionId: vA.id })).status).toBe(401);
  });

  it('CRITICAL: one buyer cannot change or remove another buyer\'s car', async () => {
    const owner = await newBuyer('owner'), other = await newBuyer('other');
    await add(owner, { generationId: gen.id, year: 2024, versionId: vA.id });
    await api(other.token, 'DELETE', `/garage/me/${gen.id}/2024?versionId=${vA.id}`);
    expect(await list(owner)).toHaveLength(1);
    expect((await api(other.token, 'PATCH', `/garage/me/${gen.id}/2024/default?versionId=${vA.id}`)).status).toBe(404);
  });

  it('CRITICAL: when an admin deletes a version, buyers who saved it keep the car as a car of that YEAR; and nobody ends up with the same car twice or without a default', async () => {
    const temp = [];
    for (const n of ['T1', 'T2']) temp.push(await (await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version(n))).json());
    const solo = await newBuyer('solo'), both = await newBuyer('both');
    await add(solo, { generationId: gen.id, year: 2024, versionId: temp[0].id });
    await add(both, { generationId: gen.id, year: 2024, versionId: temp[0].id });
    await add(both, { generationId: gen.id, year: 2024, versionId: temp[1].id });
    expect((await api(admin, 'DELETE', `/fitment/versions/${temp[0].id}`)).status).toBe(204);
    const soloCars = await list(solo);
    expect(soloCars).toHaveLength(1); expect(soloCars[0]).toMatchObject({ versionId: null, version: null, isDefault: true });
    const names = (await list(both)).map((c) => (c.version ? c.version.name : null));
    expect(names).toHaveLength(2); expect(names).toContain('T2'); expect(names).toContain(null);       // one year-only car (the deleted version) and the T2 car
    expect((await api(admin, 'DELETE', `/fitment/versions/${temp[1].id}`)).status).toBe(204);       // the second delete would clash with the first one's year-only car
    const bothCars = await list(both);
    expect(bothCars).toHaveLength(1); expect(bothCars[0].version).toBeNull(); expect(bothCars.filter((c) => c.isDefault)).toHaveLength(1);
  });

  it('only a signed in buyer has a garage', async () => {
    expect((await api(null, 'POST', '/garage/me', { generationId: gen.id, year: 2024, versionId: vA.id })).status).toBe(401);
    expect((await api(null, 'GET', '/garage/me')).status).toBe(401);
  });
});
