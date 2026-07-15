import { describe, it, expect } from 'vitest';
import { login } from './auth';

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

describe.runIf(backendUp)('category + parts reference system against a REAL running backend', () => {
  it('CRITICAL: real seeded categories and parts are publicly readable, no auth required', async () => {
    const catRes = await fetch(`${BACKEND_URL}/catalog/categories`);
    expect(catRes.status).toBe(200);
    const categories = await catRes.json();
    expect(categories.find((c) => c.id === 'brake')).toBeDefined();
    expect(categories.length).toBeGreaterThanOrEqual(6);

    const partsRes = await fetch(`${BACKEND_URL}/catalog/categories/brake/parts`);
    expect(partsRes.status).toBe(200);
    const parts = await partsRes.json();
    expect(parts.find((p) => p.nameEn === 'Front Brake Disc')).toBeDefined();
  });

  it('CRITICAL: a supplier cannot submit a product with a category outside the real list', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '测试', category: 'not_a_real_category', part: 'Anything', position: 'Front', oemNumber: `CATTEST-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('brake'); // real category names listed in the error
  });

  it('CRITICAL: a supplier cannot submit a product with a part that is not a real one for that category (free text is rejected)', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '测试', category: 'brake', part: 'A Made Up Part Name Nobody Approved', position: 'Front', oemNumber: `PARTTEST-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Front Brake Disc'); // real parts for this category listed in the error
  });

  it('CRITICAL: a real part from a DIFFERENT category is rejected -- cross-category mismatch is not accepted just because the name is otherwise valid', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    // 'Air Filter' is real, but belongs to 'filters', not 'brake'.
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: '测试', category: 'brake', part: 'Air Filter', position: 'Front', oemNumber: `CROSSCAT-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('a real category + real part combination is accepted', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nameZh: `真实分类测试 ${Date.now()}`, category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `REALCAT-${Date.now()}`,
        price: 10, currencyCode: 'CNY', fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
        images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
        weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.category).toBe('brake');
    expect(body.part).toBe('Front Brake Disc');
  });

  it('admin can create and delete a real category and a real part, both rejected for non-admins', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');

    const forbiddenRes = await fetch(`${BACKEND_URL}/catalog/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ id: 'should_fail', nameEn: 'Should Fail' }),
    });
    expect(forbiddenRes.status).toBe(403);

    const uniqueId = `test_cat_${Date.now()}`;
    const createRes = await fetch(`${BACKEND_URL}/catalog/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ id: uniqueId, nameEn: 'Test Category', nameAr: 'فئة اختبار' }),
    });
    expect(createRes.status).toBe(201);

    const partRes = await fetch(`${BACKEND_URL}/catalog/categories/${uniqueId}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ nameEn: `Unique Part ${Date.now()}` }),
    });
    expect(partRes.status).toBe(201);
    const part = await partRes.json();

    // Real part, genuinely unused -- deletes cleanly.
    const deletePartRes = await fetch(`${BACKEND_URL}/catalog/parts/${part.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deletePartRes.status).toBe(204);

    // Now the category has no parts and no real products -- deletes cleanly.
    const deleteCatRes = await fetch(`${BACKEND_URL}/catalog/categories/${uniqueId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteCatRes.status).toBe(204);
  });

  it('CRITICAL: cannot delete a category that still has real products referencing it, or one that still has parts attached (a real bug found and fixed -- this used to be a raw 500, not a clear 409)', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');

    const productReferencedRes = await fetch(`${BACKEND_URL}/catalog/categories/brake`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(productReferencedRes.status).toBe(409);

    // A category with parts still attached (even if those specific
    // parts aren't used by any product) must also be refused -- not a
    // raw DB foreign-key error.
    const uniqueId = `test_cat_parts_${Date.now()}`;
    await fetch(`${BACKEND_URL}/catalog/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ id: uniqueId, nameEn: 'Test Category With Parts' }),
    });
    await fetch(`${BACKEND_URL}/catalog/categories/${uniqueId}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ nameEn: `Attached Part ${Date.now()}` }),
    });
    const deleteWithPartsRes = await fetch(`${BACKEND_URL}/catalog/categories/${uniqueId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteWithPartsRes.status).toBe(409);
    const body = await deleteWithPartsRes.json();
    expect(body.error).toContain('parts');
  });

  it('cannot delete a real part that a real product references', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const partsRes = await fetch(`${BACKEND_URL}/catalog/categories/brake/parts`);
    const parts = await partsRes.json();
    const frontDisc = parts.find((p) => p.nameEn === 'Front Brake Disc');
    expect(frontDisc).toBeDefined();

    const deleteRes = await fetch(`${BACKEND_URL}/catalog/parts/${frontDisc.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.status).toBe(409);
  });
});
