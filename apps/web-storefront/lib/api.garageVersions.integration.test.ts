import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { addVehicleToGarage, chooseGarageVersion, fetchMyGarage, fetchVersionsForGeneration, removeVehicleFromGarage, setDefaultVehicle } from './api';
import { t } from './i18n';
import { setErrorLanguage } from './serverMessages';

// The website's garage functions against a REAL running backend, with versions made the way an admin makes them.
const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp(): Promise<boolean> { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();
afterEach(() => setErrorLanguage('en'));

const post = async (token: string, path: string, body: unknown) => (await fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })).json();
const version = (name: string, seats = 5) => ({ name, nameAr: `ن ${name}`, nameZh: `中${name}`, engine: `Engine ${name}`, engineAr: 'محرك', engineZh: '发动机', seats, photoUrl: '/uploads/v.png' });

describe.runIf(backendUp)('the website\'s garage with versions, against the REAL server', () => {
  let admin = '', brandId = '', gen = '', buyer = '', modelId = '';
  const versions: Array<{ id: string; name: string }> = [];
  beforeAll(async () => {
    admin = (await (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@leap.dev', password: 'admin_dev_password_123' }) })).json()).token;
    const brand = await post(admin, '/fitment/brands', { name: `WebVer ${Date.now()}`, nameAr: 'ب', nameZh: '牌', photoUrl: '/uploads/x.png' }); brandId = brand.id;
    const model = await post(admin, `/fitment/brands/${brandId}/models`, { name: 'W1', nameAr: 'و', nameZh: '型' }); modelId = model.id;
    gen = (await post(admin, `/fitment/models/${model.id}/generations`, { year: 2024, photoUrl: '/uploads/y.png' })).id;
    for (const n of ['A', 'B']) versions.push(await post(admin, `/fitment/generations/${gen}/versions`, version(n, n === 'A' ? 5 : 6)));
    buyer = (await (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `web-ver-${Date.now()}@leap.dev`, password: 'web_version_pw_123' }) })).json()).token;
  });
  afterAll(async () => { await fetch(`${BACKEND_URL}/fitment/brands/${brandId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin}` } }); });

  it('the chooser reads the versions of a year (with the Arabic and English texts, engine and seats)', async () => {
    const list = await fetchVersionsForGeneration(gen);
    expect(list.map((v) => v.name)).toEqual(['A', 'B']);
    expect(list[0]).toMatchObject({ nameAr: 'ن A', engine: 'Engine A', engineAr: 'محرك', seats: 5 });
    expect(await fetchVersionsForGeneration('gen_that_does_not_exist')).toEqual([]);
  });

  it('CRITICAL: a car of a year with versions needs its version, in English and in Arabic on the Arabic site; with it the car is saved and carries it', async () => {
    const english = await addVehicleToGarage(buyer, gen, 2024).catch((e) => (e as Error).message);
    expect(english).toBe('Choose the version of this car');
    setErrorLanguage('ar');
    expect(await addVehicleToGarage(buyer, gen, 2024).catch((e) => (e as Error).message)).toBe('اختر فئة هذه المركبة');
    setErrorLanguage('en');
    const car = await addVehicleToGarage(buyer, gen, 2024, versions[0].id);
    expect(car).toMatchObject({ versionId: versions[0].id, versionCount: 2, version: { name: 'A', seats: 5 } });
    expect(await fetchMyGarage(buyer)).toHaveLength(1);
  });

  it('CRITICAL: two versions are two cars; making the default and removing act on the exact car', async () => {
    await addVehicleToGarage(buyer, gen, 2024, versions[1].id);
    expect((await fetchMyGarage(buyer)).map((c) => c.version?.name).sort()).toEqual(['A', 'B']);
    await setDefaultVehicle(buyer, gen, 2024, versions[1].id);
    const afterDefault = await fetchMyGarage(buyer);
    expect(afterDefault.find((c) => c.isDefault)?.version?.name).toBe('B');
    await removeVehicleFromGarage(buyer, gen, 2024, versions[1].id);
    const left = await fetchMyGarage(buyer);
    expect(left.map((c) => c.version?.name)).toEqual(['A']);
    expect(left[0].isDefault).toBe(true);
  });

  it('CRITICAL: a car saved BEFORE its year had versions is still in the garage, says how many versions its year now has, and can be given one (once)', async () => {
    const older = (await post(admin, `/fitment/models/${modelId}/generations`, { year: 2021, photoUrl: '/uploads/y.png' })).id;
    const saved = await addVehicleToGarage(buyer, older, 2021);                       // no versions yet: saved as a year-only car
    expect(saved).toMatchObject({ versionId: null, version: null, versionCount: 0 });
    const added = await post(admin, `/fitment/generations/${older}/versions`, version('Later', 7));
    const mine = (await fetchMyGarage(buyer)).find((c) => c.generationId === older);
    expect(mine).toMatchObject({ version: null, versionCount: 1 });
    const garage = await chooseGarageVersion(buyer, older, 2021, added.id);
    expect(garage.find((c) => c.generationId === older)).toMatchObject({ versionId: added.id, version: { name: 'Later', seats: 7 } });
    expect(await chooseGarageVersion(buyer, older, 2021, added.id).catch((e) => (e as Error).message)).toBe('You already have this car with that version');
    setErrorLanguage('ar');
    expect(await chooseGarageVersion(buyer, older, 2021, added.id).catch((e) => (e as Error).message)).toBe('لديك هذه المركبة بهذه الفئة بالفعل');
  });

  it('a version of another year is refused with the Arabic message on the Arabic site', async () => {
    setErrorLanguage('ar');
    expect(await addVehicleToGarage(buyer, gen, 2024, 'ver_nope').catch((e) => (e as Error).message)).toBe('هذه الفئة ليست من هذه السنة');
  });

  it('the words the website shows for these messages are the SAME as the server\'s (English)', () => {
    expect(t('en', 'picker_version_needed')).toBeTruthy();
    expect('Choose the version of this car').toMatch(/version/);
  });
});
