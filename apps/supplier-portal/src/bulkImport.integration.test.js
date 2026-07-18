import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { login } from './auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

async function bulkImport(token, body) {
  const res = await fetch(`${BACKEND_URL}/supplier/me/products/bulk-import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function fetchDrafts(token) {
  const res = await fetch(`${BACKEND_URL}/supplier/me/products/drafts`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function completeDraft(token, id, body) {
  const res = await fetch(`${BACKEND_URL}/supplier/me/products/${id}/complete`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function uploadRealImage(token) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('image', fs.readFileSync(path.join(__dirname, 'fixtures', 'valid-test-image.jpg')), { filename: 'valid.jpg', contentType: 'image/jpeg' });
    const headers = form.getHeaders();
    headers.Authorization = `Bearer ${token}`;
    form.submit({ host: 'localhost', port: 4000, path: '/uploads/product-image', headers }, (err, res) => {
      if (err) return reject(err);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data).url));
    });
  });
}

async function threeRealPhotos(token) {
  return Promise.all([uploadRealImage(token), uploadRealImage(token), uploadRealImage(token)]);
}

const REAL_FITMENT = { generationId: 'gen_bmw_1_series_f20', year: 2018 };

describe.runIf(backendUp)('real supplier bulk product import (spreadsheet-style, one vehicle per batch) against a REAL running backend', () => {
  it('CRITICAL: a real batch with valid items, one missing required field, and one with unmatched optional fields — best-effort, not all-or-nothing', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { status, body } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'zh',
      items: [
        { oemNumber: `BI-A-${suffix}`, itemName: '前刹车盘', price: 200, category: 'Brake System', part: 'Front Brake Disc', position: 'Front', weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 10 },
        { oemNumber: `BI-B-${suffix}`, itemName: '后刹车盘', price: 180 },
        { itemName: 'missing oem', price: 100 },
        { oemNumber: `BI-D-${suffix}`, itemName: '刹车片', price: 90, category: 'NotReal', position: 'NotReal' },
      ],
    });
    expect(status).toBe(201);
    expect(body.results[0].success).toBe(true);
    expect(body.results[1].success).toBe(true);
    expect(body.results[2].success).toBe(false);
    expect(body.results[2].error).toContain('oemNumber');
    expect(body.results[3].success).toBe(true); // unmatched optional fields don't block the row

    const drafts = await fetchDrafts(token);
    const itemA = drafts.find((d) => d.oemNumber === `BI-A-${suffix}`);
    const itemB = drafts.find((d) => d.oemNumber === `BI-B-${suffix}`);
    const itemD = drafts.find((d) => d.oemNumber === `BI-D-${suffix}`);
    expect(itemA.missing).toEqual(['photos']); // everything else matched
    expect(itemB.missing).toEqual(expect.arrayContaining(['category', 'part', 'position', 'dimensions', 'photos']));
    expect(itemD.missing).toEqual(expect.arrayContaining(['category', 'part', 'position', 'dimensions', 'photos'])); // invalid optional fields = not provided, not rejected
  });

  it('CRITICAL: the real vehicle fitment is validated once for the whole batch, not per item', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { status: badGenStatus } = await bulkImport(token, {
      fitment: { generationId: 'not_a_real_generation', year: 2018 }, nameLanguage: 'zh',
      items: [{ oemNumber: 'X', itemName: 'Y', price: 100 }],
    });
    expect(badGenStatus).toBe(400);

    const { status: badYearStatus, body: badYearBody } = await bulkImport(token, {
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2050 }, nameLanguage: 'zh',
      items: [{ oemNumber: 'X', itemName: 'Y', price: 100 }],
    });
    expect(badYearStatus).toBe(400);
    expect(badYearBody.error).toContain('outside this generation');
  });

  it('CRITICAL: the full real completion flow — a fully-matched draft only needs real photos, then enters real moderation', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { body: importBody } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'zh',
      items: [{ oemNumber: `BI-COMPLETE-${suffix}`, itemName: '完整测试', price: 150, category: 'Brake System', part: 'Front Brake Disc', position: 'Front', weightKg: 3, lengthCm: 20, widthCm: 20, heightCm: 5 }],
    });
    const productId = importBody.results[0].productId;

    const photos = await threeRealPhotos(token);
    const { status, body } = await completeDraft(token, productId, { images: photos });
    expect(status).toBe(200);
    expect(body.status).toBe('translating');
    expect(body.images).toHaveLength(3);
    expect(body.fitment[0]).toMatchObject({ brand: 'BMW', model: '1 Series', generation: 'F20', year: 2018 });
  });

  it('CRITICAL: a minimal draft cannot be completed with only photos — still needs its real required fields', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { body: importBody } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'zh',
      items: [{ oemNumber: `BI-MINIMAL-${suffix}`, itemName: '最小测试', price: 80 }],
    });
    const productId = importBody.results[0].productId;

    const photos = await threeRealPhotos(token);
    const { status: partialStatus, body: partialBody } = await completeDraft(token, productId, { images: photos });
    expect(partialStatus).toBe(400);
    expect(partialBody.error).toContain('category');

    const { status: fullStatus, body: fullBody } = await completeDraft(token, productId, {
      category: 'brake', part: 'Rear Brake Disc', position: 'Rear', weightKg: 2, lengthCm: 15, widthCm: 15, heightCm: 5, images: photos,
    });
    expect(fullStatus).toBe(200);
    expect(fullBody.status).toBe('translating');
  });

  it('an unknown category or a part not belonging to the given category is rejected at completion time', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { body: importBody } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'zh',
      items: [{ oemNumber: `BI-BADCAT-${suffix}`, itemName: 'test', price: 50 }],
    });
    const productId = importBody.results[0].productId;
    const photos = await threeRealPhotos(token);

    const { status: badCategoryStatus } = await completeDraft(token, productId, {
      category: 'not_a_real_category', part: 'X', position: 'Front', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1, images: photos,
    });
    expect(badCategoryStatus).toBe(400);

    const { status: badPartStatus } = await completeDraft(token, productId, {
      category: 'brake', part: 'Air Filter', position: 'Front', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1, images: photos,
    });
    expect(badPartStatus).toBe(400); // Air Filter belongs to 'filters', not 'brake'
  });

  it('CRITICAL: a draft that has already been completed cannot be completed again', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { body: importBody } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'zh',
      items: [{ oemNumber: `BI-ONCE-${suffix}`, itemName: 'test', price: 50, category: 'Brake System', part: 'Front Brake Disc', position: 'Front', weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1 }],
    });
    const productId = importBody.results[0].productId;
    const photos = await threeRealPhotos(token);

    const first = await completeDraft(token, productId, { images: photos });
    expect(first.status).toBe(200);
    const second = await completeDraft(token, productId, { images: photos });
    expect(second.status).toBe(404);
  });

  it('an empty items array and a batch over the real 200-item limit are both rejected', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { status: emptyStatus } = await bulkImport(token, { fitment: REAL_FITMENT, nameLanguage: 'zh', items: [] });
    expect(emptyStatus).toBe(400);

    const tooMany = Array.from({ length: 201 }, (_, i) => ({ oemNumber: `X${i}`, itemName: 'Y', price: 1 }));
    const { status: tooManyStatus } = await bulkImport(token, { fitment: REAL_FITMENT, nameLanguage: 'zh', items: tooMany });
    expect(tooManyStatus).toBe(400);
  });

  it('an invalid nameLanguage is rejected', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { status } = await bulkImport(token, { fitment: REAL_FITMENT, nameLanguage: 'fr', items: [{ oemNumber: 'X', itemName: 'Y', price: 1 }] });
    expect(status).toBe(400);
  });

  it('CRITICAL: an English-named item stores no Chinese original, unlike a Chinese-named one', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const suffix = Date.now();
    const { body: importBody } = await bulkImport(token, {
      fitment: REAL_FITMENT, nameLanguage: 'en',
      items: [{ oemNumber: `BI-ENGLISH-${suffix}`, itemName: 'Front Brake Disc English Name', price: 60 }],
    });
    const productId = importBody.results[0].productId;
    const drafts = await fetchDrafts(token);
    const item = drafts.find((d) => d.id === productId);
    expect(item.name).toBe('Front Brake Disc English Name');
    expect(item.nameZh).toBeNull();
  });

  it('non-suppliers cannot use any of the 3 real bulk-import endpoints', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { status: importStatus } = await bulkImport(token, { fitment: REAL_FITMENT, nameLanguage: 'zh', items: [{ oemNumber: 'X', itemName: 'Y', price: 1 }] });
    expect(importStatus).toBe(403);

    const draftsRes = await fetch(`${BACKEND_URL}/supplier/me/products/drafts`, { headers: { Authorization: `Bearer ${token}` } });
    expect(draftsRes.status).toBe(403);

    const completeRes = await fetch(`${BACKEND_URL}/supplier/me/products/p1/complete`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({}),
    });
    expect(completeRes.status).toBe(403);
  });
});
