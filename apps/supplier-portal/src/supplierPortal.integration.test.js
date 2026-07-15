import { describe, it, expect } from 'vitest';
import {
  login, getCurrentUser, fetchMySupplierProfile,
  fetchMyProducts, createProduct, updateProduct,
  fetchMyOrders, updateSubOrder,
} from './auth';

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

describe.runIf(backendUp)('supplier portal against a REAL running backend', () => {  it('logs in with the seeded dev supplier and gets a real JWT with supplierId', async () => {
    const { token, user } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    expect(typeof token).toBe('string');
    expect(user.role).toBe('supplier');
    expect(user.supplierId).toBe('s1');
  });

  it('rejects a buyer account trying to view supplier data', async () => {
    const email = `portal-test-buyer-${Date.now()}@example.com`;
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    await expect(fetchMyProducts(buyerToken)).rejects.toThrow();
  });

  it('fetches the real supplier profile via /auth/me and /supplier/me consistently', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const me = await getCurrentUser(token);
    const profile = await fetchMySupplierProfile(token);
    expect(me.supplierId).toBe(profile.id);
    expect(profile.name).toBe('Guangzhou AutoParts Co.');
  });

  it('fetches only this supplier\'s own products, never another supplier\'s', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const products = await fetchMyProducts(token);
    expect(products.length).toBeGreaterThan(0);
    // p4 belongs to supplier s2 (Ningbo Filtration Ltd.) — must never appear here.
    expect(products.find((p) => p.id === 'p4')).toBeUndefined();
  });

  it('creates a new product, which starts in translating status (awaiting moderation)', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const created = await createProduct(token, {
      nameZh: `集成测试商品 ${Date.now()}`,
      category: 'brake',
      part: 'Front Brake Disc',
      position: 'Front',
      oemNumber: `OEM-${Date.now()}`,
      price: 19.99,
      currencyCode: 'USD',
      stockQuantity: 50,
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2017 },
      images: ['/uploads/test-a.jpg', '/uploads/test-b.jpg', '/uploads/test-c.jpg'],
      weightKg: 2.2, lengthCm: 25, widthCm: 25, heightCm: 4,
    });
    expect(created.status).toBe('translating');

    // Confirm it shows up in the ADMIN moderation queue too — proves the
    // two apps are genuinely connected through the same data, not two
    // independent mocks.
    const adminLogin = await login('admin@leap.dev', 'admin_dev_password_123');
    const modQueueRes = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, {
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    const modQueue = await modQueueRes.json();
    expect(modQueue.find((p) => p.id === created.id)).toBeDefined();
  });

  it('updates own product price/stock, and the change is real and persisted', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const updated = await updateProduct(token, 'p1', { price: 39.99 });
    expect(updated.price).toBe(39.99);

    const products = await fetchMyProducts(token);
    const p1 = products.find((p) => p.id === 'p1');
    expect(p1.price).toBe(39.99);
  });

  it('rejects updating a product belonging to a different supplier (p4 belongs to s2)', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await expect(updateProduct(token, 'p4', { price: 1.0 })).rejects.toThrow();
  });

  it('places a real order, then confirms it appears in the supplier\'s own order list', async () => {
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `portal-order-test-${Date.now()}@example.com` }),
    });
    const order = await orderRes.json();

    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const myOrders = await fetchMyOrders(token);
    expect(myOrders.find((o) => o.orderId === order.id)).toBeDefined();
  });

  it('marks a sub-order shipped with tracking, and this shows up on the admin side too', async () => {
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `portal-ship-test-${Date.now()}@example.com` }),
    });
    const order = await orderRes.json();

    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const myOrders = await fetchMyOrders(token);
    const subOrder = myOrders.find((o) => o.orderId === order.id);

    // NEW as of the inspection-hubs feature: every order now routes
    // Supplier -> Hub -> Buyer, so a hub must be assigned before this
    // sub-order can be marked shipped at all — confirmed as its own
    // negative case, then done properly here.
    const trackingNumber = `TEST-TRACK-${Date.now()}`;
    const shipWithoutHubRes = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrder.subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'shipped', trackingNumber }),
    });
    expect(shipWithoutHubRes.status).toBe(400);

    const { token: adminTokenForAssign } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/hub/assign/${subOrder.subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenForAssign}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });

    const updated = await updateSubOrder(token, subOrder.subOrderId, { status: 'shipped', trackingNumber });
    expect(updated.status).toBe('shipped');
    expect(updated.trackingNumber).toBe(trackingNumber);

    // Confirm on the ADMIN side — same real join used by the admin
    // dashboard's order detail page.
    const adminLogin = await login('admin@leap.dev', 'admin_dev_password_123');
    const adminOrderRes = await fetch(`${BACKEND_URL}/order/${order.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    const adminOrder = await adminOrderRes.json();
    expect(adminOrder.supplierSubOrders[0].trackingNumber).toBe(trackingNumber);
    expect(adminOrder.supplierSubOrders[0].status).toBe('shipped');
    // The hub's own leg should have been auto-created the moment this
    // sub-order transitioned to 'shipped' (shipped TO THE HUB, not the
    // buyer — see migration 011's header comment for the meaning change).
    expect(adminOrder.supplierSubOrders[0].hubShipment.status).toBe('awaiting_receipt');
  });

  it('rejects updating a sub-order that doesn\'t belong to this supplier', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    await expect(updateSubOrder(token, 999999999, { status: 'shipped' })).rejects.toThrow();
  });
});
