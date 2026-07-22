import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

async function createSupplierProduct({ stockQuantity, lowStockThreshold }) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `库存测试 ${suffix}`,
      category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `STOCK-${suffix}`,
      price: 100, currencyCode: 'CNY', stockQuantity,
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/p-a.jpg', '/uploads/p-b.jpg', '/uploads/p-c.jpg'],
      weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
    }),
  });
  const created = await createRes.json();

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve' }),
  });

  if (lowStockThreshold !== undefined) {
    await fetch(`${BACKEND_URL}/supplier/me/products/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ lowStockThreshold }),
    });
  }
  return created.id;
}

async function placeOrder(productId, quantity, buyerToken, buyerId) {
  return fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId, quantity }], userId: buyerId, address: TEST_ADDRESS }),
  });
}

describe.runIf(backendUp)('real stock decrementing, oversell prevention, and low-stock alerts against a REAL running backend', () => {
  it('CRITICAL: placing a real order genuinely decrements stock by the ordered quantity', async () => {
    const productId = await createSupplierProduct({ stockQuantity: 20 });
    const buyer = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stock-test-${Date.now()}@example.com`, password: 'test_password_123' }),
    })).json();

    const res = await placeOrder(productId, 5, buyer.token, buyer.user.id);
    expect(res.status).toBe(201);

    const product = await fetch(`${BACKEND_URL}/catalog/products/${productId}`).then((r) => r.json());
    expect(product.stockQuantity).toBe(15);
  });

  it('CRITICAL: a real order that would oversell past available stock is rejected, and stock is left completely unchanged', async () => {
    const productId = await createSupplierProduct({ stockQuantity: 3 });
    const buyer = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stock-test-${Date.now()}@example.com`, password: 'test_password_123' }),
    })).json();

    const res = await placeOrder(productId, 10, buyer.token, buyer.user.id);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('3 left in stock');

    const product = await fetch(`${BACKEND_URL}/catalog/products/${productId}`).then((r) => r.json());
    expect(product.stockQuantity).toBe(3);
  });

  it('CRITICAL: a real low-stock notification fires exactly once, right when crossing the real threshold', async () => {
    const productId = await createSupplierProduct({ stockQuantity: 10, lowStockThreshold: 8 });
    const buyer = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stock-test-${Date.now()}@example.com`, password: 'test_password_123' }),
    })).json();

    // 10 -> 7: crosses the real threshold of 8, should notify once.
    await placeOrder(productId, 3, buyer.token, buyer.user.id);
    // 7 -> 6: already below threshold, should NOT notify again.
    await placeOrder(productId, 1, buyer.token, buyer.user.id);

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${supplierToken}` } }).then((r) => r.json());
    const matching = notifications.filter((n) => n.type === 'low_stock' && n.linkId === productId);
    expect(matching.length).toBe(1);
    expect(matching[0].body).toContain('7 units');
  });

  it('a supplier can configure their own real low-stock threshold per product', async () => {
    const productId = await createSupplierProduct({ stockQuantity: 50 });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');

    const res = await fetch(`${BACKEND_URL}/supplier/me/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ lowStockThreshold: 12 }),
    });
    const body = await res.json();
    expect(body.lowStockThreshold).toBe(12);
  });

  it('a negative low-stock threshold is rejected', async () => {
    const productId = await createSupplierProduct({ stockQuantity: 50 });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier/me/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ lowStockThreshold: -1 }),
    });
    expect(res.status).toBe(400);
  });
});
