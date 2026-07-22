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

async function createApprovedSupplierProduct({ priceCny = 100 } = {}) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `价格下降测试 ${suffix}`,
      category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `PRICEDROP-${suffix}`,
      price: priceCny, currencyCode: 'CNY', stockQuantity: 100,
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/p-a.jpg', '/uploads/p-b.jpg', '/uploads/p-c.jpg'],
      weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
    }),
  });
  const created = await createRes.json();

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', nameEn: 'Price Drop Test', nameAr: 'اختبار انخفاض السعر' }),
  });
  return created.id;
}

async function createBuyerAndWishlist(productId) {
  const suffix = Date.now() + Math.random();
  const { token } = await (await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `price-drop-test-${suffix}@example.com`, password: 'test_password_123' }),
  })).json();
  await fetch(`${BACKEND_URL}/wishlist/me/${productId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  return token;
}

async function triggerCheck() {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  return fetch(`${BACKEND_URL}/admin/price-drop-alerts/check`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
}

describe.runIf(backendUp)('real price-drop alerts on wishlist items against a REAL running backend', () => {
  it('CRITICAL: the first real check on a product only records a real baseline, with no notification', async () => {
    const productId = await createApprovedSupplierProduct();
    const buyerToken = await createBuyerAndWishlist(productId);

    await triggerCheck();

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    const matching = notifications.filter((n) => n.type === 'price_drop' && n.linkId === productId);
    expect(matching.length).toBe(0);
  });

  it('CRITICAL: a real price drop notifies every real buyer with that product wishlisted, with the correct before/after prices', async () => {
    const productId = await createApprovedSupplierProduct({ priceCny: 100 });
    const buyerToken = await createBuyerAndWishlist(productId);
    await triggerCheck(); // establishes the real baseline

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ price: 60 }), // a real, genuine drop
    });

    const result = await triggerCheck();
    expect(result.dropsFound).toBeGreaterThanOrEqual(1);

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    const matching = notifications.filter((n) => n.type === 'price_drop' && n.linkId === productId);
    expect(matching.length).toBe(1);
    expect(matching[0].body).toMatch(/dropped to \$\d+\.\d+ \(was \$\d+\.\d+\)/);
  });

  it('a buyer who does NOT have the product wishlisted is never notified of its price drop', async () => {
    const productId = await createApprovedSupplierProduct({ priceCny: 100 });
    await createBuyerAndWishlist(productId); // a different, wishlisting buyer
    await triggerCheck();

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ price: 50 }),
    });
    await triggerCheck();

    const suffix = Date.now() + Math.random();
    const { token: uninterestedBuyerToken } = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `price-drop-uninterested-${suffix}@example.com`, password: 'test_password_123' }),
    })).json();
    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${uninterestedBuyerToken}` } }).then((r) => r.json());
    expect(notifications.filter((n) => n.linkId === productId).length).toBe(0);
  });

  it('CRITICAL: a real price increase (or no change) never fires a false drop notification', async () => {
    const productId = await createApprovedSupplierProduct({ priceCny: 100 });
    const buyerToken = await createBuyerAndWishlist(productId);
    await triggerCheck();

    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await fetch(`${BACKEND_URL}/supplier/me/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ price: 150 }), // a real increase
    });
    await triggerCheck();

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    expect(notifications.filter((n) => n.type === 'price_drop' && n.linkId === productId).length).toBe(0);
  });

  it('a non-admin cannot trigger a manual price-drop check', async () => {
    const suffix = Date.now() + Math.random();
    const { token } = await (await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `price-drop-nonadmin-${suffix}@example.com`, password: 'test_password_123' }),
    })).json();
    const res = await fetch(`${BACKEND_URL}/admin/price-drop-alerts/check`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });
});
