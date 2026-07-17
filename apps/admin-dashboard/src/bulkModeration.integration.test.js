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

async function createPendingProduct(supplierToken, oemSuffix) {
  const res = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `批量测试产品${oemSuffix}`, category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `BULKTEST-${oemSuffix}-${Date.now()}`,
      price: 200, currencyCode: 'CNY',
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
      weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 10,
    }),
  });
  const body = await res.json();
  return body.id;
}

async function bulkModerate(token, items) {
  const res = await fetch(`${BACKEND_URL}/catalog/products/bulk-moderate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  });
  return { status: res.status, body: await res.json() };
}

describe.runIf(backendUp)('real bulk moderation (approve/reject many at once) against a REAL running backend', () => {
  it('CRITICAL: a real batch of valid approvals and rejections all succeed together in one request', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const p1 = await createPendingProduct(supplierToken, 'A');
    const p2 = await createPendingProduct(supplierToken, 'B');

    const { status, body } = await bulkModerate(adminToken, [
      { productId: p1, action: 'approve', nameEn: 'Bulk A', nameAr: 'دفعة أ' },
      { productId: p2, action: 'reject' },
    ]);
    expect(status).toBe(200);
    expect(body.results.every((r) => r.success)).toBe(true);
  });

  it('CRITICAL: best-effort processing -- one invalid item in a batch does not block the other valid ones', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const validProduct = await createPendingProduct(supplierToken, 'VALID');
    const invalidProduct = await createPendingProduct(supplierToken, 'INVALID');

    const { status, body } = await bulkModerate(adminToken, [
      { productId: validProduct, action: 'approve', nameEn: 'Valid Item', nameAr: 'عنصر صالح' },
      { productId: invalidProduct, action: 'approve' }, // missing required nameEn/nameAr
    ]);
    expect(status).toBe(200);
    const validResult = body.results.find((r) => r.productId === validProduct);
    const invalidResult = body.results.find((r) => r.productId === invalidProduct);
    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('nameEn and nameAr required');

    // Confirm this at the real data level, not just trusting the response.
    const queueRes = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const queue = await queueRes.json();
    expect(queue.find((p) => p.id === validProduct)).toBeUndefined(); // approved, out of the queue
    expect(queue.find((p) => p.id === invalidProduct)).toBeDefined(); // still pending, untouched
  });

  it('a nonexistent product in a batch reports a real per-item failure without affecting other items', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const realProduct = await createPendingProduct(supplierToken, 'REAL');

    const { body } = await bulkModerate(adminToken, [
      { productId: realProduct, action: 'reject' },
      { productId: 'definitely_not_a_real_product_id', action: 'reject' },
    ]);
    expect(body.results.find((r) => r.productId === realProduct).success).toBe(true);
    expect(body.results.find((r) => r.productId === 'definitely_not_a_real_product_id')).toMatchObject({ success: false, error: 'Product not found' });
  });

  it('an empty items array is rejected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { status } = await bulkModerate(adminToken, []);
    expect(status).toBe(400);
  });

  it('a batch over the real 100-item limit is rejected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const items = Array.from({ length: 101 }, (_, i) => ({ productId: `p${i}`, action: 'reject' }));
    const { status, body } = await bulkModerate(adminToken, items);
    expect(status).toBe(400);
    expect(body.error).toContain('100');
  });

  it('an invalid action or missing productId within a batch is a real per-item failure, not a request-level error', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body } = await bulkModerate(adminToken, [
      { productId: 'p1', action: 'delete' },
      { action: 'reject' }, // missing productId
    ]);
    expect(body.results[0].success).toBe(false);
    expect(body.results[1].success).toBe(false);
  });

  it('CRITICAL: non-admins cannot use the bulk moderation endpoint', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { status } = await bulkModerate(supplierToken, [{ productId: 'p1', action: 'reject' }]);
    expect(status).toBe(403);
  });
});
