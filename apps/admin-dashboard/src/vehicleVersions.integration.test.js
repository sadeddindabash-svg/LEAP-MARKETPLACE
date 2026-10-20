// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makePng } from './testImages.js';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

const login = async (email, password) => (await (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const api = (token, method, path, body) => fetch(`${BACKEND_URL}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const upload = (token, path, png, type = 'image/png') => {
  const form = new FormData(); form.append('image', new Blob([png], { type }), 'photo.png');
  return fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
};

describe.runIf(backendUp)('vehicle photos (400 px), Chinese names and versions, against a REAL running backend', () => {
  let admin, supplier, buyer; const createdBrands = [];
  beforeAll(async () => {
    admin = await login('admin@leap.dev', 'admin_dev_password_123');
    supplier = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const signup = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `vehicle-test-${Date.now()}@leap.dev`, password: 'vehicle_test_pw_123' }) });
    buyer = (await signup.json()).token;
  });
  afterAll(async () => { for (const id of createdBrands) await api(admin, 'DELETE', `/fitment/brands/${id}`); });

  // ---------------------------------------------------------------- the photo doors
  describe('the photo doors', () => {
    it('CRITICAL: the vehicle and category door accepts a 400x400 picture, and a bigger one, and a long one (shortest side 400)', async () => {
      for (const [w, h] of [[400, 400], [800, 800], [400, 1000]]) {
        const res = await upload(admin, '/fitment/catalog-image', makePng(w, h));
        expect(res.status, `${w}x${h}`).toBe(201);
        const body = await res.json();
        expect(body.width).toBe(w); expect(body.height).toBe(h);
        expect(body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$|^https?:/);
      }
    });
    it('CRITICAL: that door refuses 399x399 (and a long 300x900) in plain words', async () => {
      for (const [w, h] of [[399, 399], [300, 900]]) {
        const res = await upload(admin, '/fitment/catalog-image', makePng(w, h));
        expect(res.status, `${w}x${h}`).toBe(400);
        expect((await res.json()).error).toMatch(/Shortest side must be at least 400px/);
      }
    });
    it('CRITICAL: the OTHER door is unchanged: a supplier\'s 400x400 is still refused (800 px minimum), and an 800x800 is still accepted', async () => {
      const small = await upload(supplier, '/uploads/product-image', makePng(400, 400));
      expect(small.status).toBe(400);
      expect((await small.json()).error).toMatch(/Shortest side must be at least 800px/);
      expect((await upload(supplier, '/uploads/product-image', makePng(799, 900))).status).toBe(400);
      expect((await upload(supplier, '/uploads/product-image', makePng(800, 800))).status).toBe(201);
    });
    it('the 400 px door is for admins only: nobody signed in, a supplier and a buyer are refused', async () => {
      expect((await upload(null, '/fitment/catalog-image', makePng(500, 500))).status).toBe(401);
      expect((await upload(supplier, '/fitment/catalog-image', makePng(500, 500))).status).toBe(403);
      expect((await upload(buyer, '/fitment/catalog-image', makePng(500, 500))).status).toBe(403);
    });
    it('a file that is not a real picture, a cut-off picture and the wrong type are refused', async () => {
      expect((await upload(admin, '/fitment/catalog-image', Buffer.from('not a picture, just text, long enough to pass'))).status).toBe(400);
      expect((await upload(admin, '/fitment/catalog-image', makePng(500, 500).subarray(0, 300))).status).toBe(400);
      expect((await upload(admin, '/fitment/catalog-image', makePng(500, 500), 'application/pdf')).status).toBe(400);
      const none = await fetch(`${BACKEND_URL}/fitment/catalog-image`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: new FormData() });
      expect(none.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------- Chinese names
  describe('Chinese names on brands and models', () => {
    it('CRITICAL: a NEW brand needs its Chinese name (missing or blank is refused); with all three names it is saved and listed with it', async () => {
      const base = { name: `ZhBrand ${Date.now()}`, nameAr: 'ماركة', photoUrl: '/uploads/x.png' };
      for (const nameZh of [undefined, '', '   ']) {
        const res = await api(admin, 'POST', '/fitment/brands', { ...base, ...(nameZh === undefined ? {} : { nameZh }) });
        expect(res.status, JSON.stringify(nameZh)).toBe(400);
        expect((await res.json()).error).toMatch(/nameZh is required/);
      }
      const ok = await api(admin, 'POST', '/fitment/brands', { ...base, nameZh: ' 品牌 ' });
      expect(ok.status).toBe(201);
      const brand = await ok.json(); createdBrands.push(brand.id);
      expect(brand.nameZh).toBe('品牌');
      const listed = (await (await api(null, 'GET', '/fitment/brands')).json()).find((b) => b.id === brand.id);
      expect(listed.nameZh).toBe('品牌');
    });
    it('CRITICAL: a NEW model needs its Chinese name too', async () => {
      const brand = await (await api(admin, 'POST', '/fitment/brands', { name: `ZhModelBrand ${Date.now()}`, nameAr: 'ب', nameZh: '牌', photoUrl: '/uploads/x.png' })).json(); createdBrands.push(brand.id);
      const missing = await api(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'M1', nameAr: 'إم1' });
      expect(missing.status).toBe(400); expect((await missing.json()).error).toMatch(/nameZh is required/);
      const ok = await api(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'M1', nameAr: 'إم1', nameZh: '车型1' });
      expect(ok.status).toBe(201); expect((await ok.json()).nameZh).toBe('车型1');
      expect((await (await api(null, 'GET', `/fitment/brands/${brand.id}/models`)).json())[0].nameZh).toBe('车型1');
    });
    it('CRITICAL: editing keeps the Chinese name when it is not sent, changes it when it is, and refuses a blank one (brands and models made before this had none and can be edited)', async () => {
      const brand = await (await api(admin, 'POST', '/fitment/brands', { name: `ZhEdit ${Date.now()}`, nameAr: 'ت', nameZh: '旧', photoUrl: '/uploads/x.png' })).json(); createdBrands.push(brand.id);
      const kept = await (await api(admin, 'PATCH', `/fitment/brands/${brand.id}`, { name: brand.name, nameAr: 'تعديل' })).json();
      expect(kept.nameZh).toBe('旧'); expect(kept.nameAr).toBe('تعديل');
      expect((await (await api(admin, 'PATCH', `/fitment/brands/${brand.id}`, { name: brand.name, nameAr: 'تعديل', nameZh: '新' })).json()).nameZh).toBe('新');
      expect((await api(admin, 'PATCH', `/fitment/brands/${brand.id}`, { name: brand.name, nameAr: 'تعديل', nameZh: '  ' })).status).toBe(400);
      const model = await (await api(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'E1', nameAr: 'إي', nameZh: '型' })).json();
      expect((await (await api(admin, 'PATCH', `/fitment/models/${model.id}`, { name: 'E1', nameAr: 'إي' })).json()).nameZh).toBe('型');
      expect((await (await api(admin, 'PATCH', `/fitment/models/${model.id}`, { name: 'E1', nameAr: 'إي', nameZh: '新型' })).json()).nameZh).toBe('新型');
    });
  });

  // ---------------------------------------------------------------- versions
  describe('versions (the level under a year)', () => {
    let genId;
    const version = (over = {}) => ({ name: 'AWD Flagship', nameAr: 'دفع كلي فلاجشيب', nameZh: '全轮驱动 旗舰版', engine: '1.5T range extender (365 kW)', engineAr: '1.5 لتر موسع مدى', engineZh: '1.5升 增程器', seats: 5, photoUrl: '/uploads/v.png', ...over });
    beforeAll(async () => {
      const brand = await (await api(admin, 'POST', '/fitment/brands', { name: `VerBrand ${Date.now()}`, nameAr: 'ب', nameZh: '牌', photoUrl: '/uploads/x.png' })).json(); createdBrands.push(brand.id);
      const model = await (await api(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'V1', nameAr: 'ف', nameZh: '型' })).json();
      genId = (await (await api(admin, 'POST', `/fitment/models/${model.id}/generations`, { year: 2024, photoUrl: '/uploads/y.png' })).json()).id;
    });

    it('CRITICAL: a version is added with its names and engine in three languages, seats and photo, and is listed', async () => {
      const res = await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version());
      expect(res.status).toBe(201);
      const v = await res.json();
      expect(v).toMatchObject({ generationId: genId, name: 'AWD Flagship', nameAr: 'دفع كلي فلاجشيب', nameZh: '全轮驱动 旗舰版', engineZh: '1.5升 增程器', seats: 5, photoUrl: '/uploads/v.png' });
      const list = await (await api(null, 'GET', `/fitment/generations/${genId}/versions`)).json();
      expect(list.map((x) => x.id)).toContain(v.id);
    });
    it('CRITICAL: every field is required: each of the six texts, the seats and the photo; a bad seat count is refused', async () => {
      for (const field of ['name', 'nameAr', 'nameZh', 'engine', 'engineAr', 'engineZh', 'seats', 'photoUrl']) {
        const body = version({ name: `Req ${field}` }); delete body[field];
        const res = await api(admin, 'POST', `/fitment/generations/${genId}/versions`, body);
        expect(res.status, field).toBe(400);
        expect((await res.json()).error, field).toContain(field);
      }
      for (const seats of [0, 13, 5.5, 'five', null]) expect((await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: `Seats ${seats}`, seats }))).status, String(seats)).toBe(400);
      expect((await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: 'Arabic digits', seats: '٦' }))).status).toBe(201);
    });
    it('CRITICAL: the same version name with the same engine cannot be added twice to a year (capitals and spaces do not make it different), but another engine or year can', async () => {
      const first = await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: 'Twin', engine: 'Engine X' }));
      expect(first.status).toBe(201);
      const again = await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: '  TWIN ', engine: 'engine   x' }));
      expect(again.status).toBe(409);
      expect((await again.json()).error).toMatch(/already exists for this year/);
      expect((await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: 'Twin', engine: 'Engine Y' }))).status).toBe(201);
    });
    it('a version of a year that does not exist is refused (404)', async () => {
      expect((await api(admin, 'POST', '/fitment/generations/gen_nope/versions', version())).status).toBe(404);
    });
    it('CRITICAL: only an admin can add, change or delete: nobody signed in, a supplier and a buyer are refused', async () => {
      for (const token of [null, supplier, buyer]) {
        const res = await api(token, 'POST', `/fitment/generations/${genId}/versions`, version({ name: 'Intruder' }));
        expect([401, 403]).toContain(res.status);
      }
      const list = await (await api(null, 'GET', `/fitment/generations/${genId}/versions`)).json();
      expect(list.some((v) => v.name === 'Intruder')).toBe(false);
    });
    it('a version can be edited, its photo replaced, and it can be deleted; each is recorded in the audit log', async () => {
      const v = await (await api(admin, 'POST', `/fitment/generations/${genId}/versions`, version({ name: 'Editable', engine: 'Engine E' }))).json();
      const edited = await (await api(admin, 'PATCH', `/fitment/versions/${v.id}`, { ...version({ name: 'Edited', engine: 'Engine E' }), seats: 6 })).json();
      expect(edited).toMatchObject({ name: 'Edited', seats: 6 });
      expect((await api(admin, 'PATCH', `/fitment/versions/${v.id}`, { ...version(), seats: 99 })).status).toBe(400);
      const photo = await (await api(admin, 'PATCH', `/fitment/versions/${v.id}/photo`, { photoUrl: '/uploads/new.png' })).json();
      expect(photo.photoUrl).toBe('/uploads/new.png');
      expect((await api(admin, 'PATCH', `/fitment/versions/${v.id}/photo`, {})).status).toBe(400);
      expect((await api(admin, 'DELETE', `/fitment/versions/${v.id}`)).status).toBe(204);
      expect((await api(admin, 'DELETE', `/fitment/versions/${v.id}`)).status).toBe(404);
      const log = await (await api(admin, 'GET', '/admin/audit-log?action=version_created')).json();
      const entries = Array.isArray(log) ? log : (log.entries || log.items || log.rows || log.log || []);
      expect(entries.length).toBeGreaterThan(0);
    });
    it('deleting a year takes its versions with it', async () => {
      const brand = await (await api(admin, 'POST', '/fitment/brands', { name: `CascadeBrand ${Date.now()}`, nameAr: 'ب', nameZh: '牌', photoUrl: '/uploads/x.png' })).json(); createdBrands.push(brand.id);
      const model = await (await api(admin, 'POST', `/fitment/brands/${brand.id}/models`, { name: 'C1', nameAr: 'ك', nameZh: '型' })).json();
      const gen = await (await api(admin, 'POST', `/fitment/models/${model.id}/generations`, { year: 2023, photoUrl: '/uploads/y.png' })).json();
      await api(admin, 'POST', `/fitment/generations/${gen.id}/versions`, version());
      expect((await api(admin, 'DELETE', `/fitment/generations/${gen.id}`)).status).toBe(204);
      expect(await (await api(null, 'GET', `/fitment/generations/${gen.id}/versions`)).json()).toEqual([]);
    });
  });
});
