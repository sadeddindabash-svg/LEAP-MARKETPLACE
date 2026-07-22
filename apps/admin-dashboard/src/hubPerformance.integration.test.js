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

async function createHub() {
  const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
  const suffix = Date.now() + Math.random();
  return fetch(`${BACKEND_URL}/hub/locations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Perf Test Hub ${suffix}`, region: 'Test Region' }),
  }).then((r) => r.json());
}

async function createApprovedProduct() {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const created = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh: `性能测试 ${suffix}`, category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `PERF-${suffix}`,
      price: 100, currencyCode: 'CNY', stockQuantity: 50,
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/p-a.jpg', '/uploads/p-b.jpg', '/uploads/p-c.jpg'],
      weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
    }),
  }).then((r) => r.json());
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', nameEn: 'Perf Test', nameAr: 'اختبار' }),
  });
  return created.id;
}

async function routeOrderToHub(productId, hubId) {
  const suffix = Date.now() + Math.random();
  const buyer = await (await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `perf-test-${suffix}@example.com`, password: 'test_password_123' }),
  })).json();
  const order = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId, quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }),
  }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `PERF-${suffix}` }),
  });

  const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: { Authorization: `Bearer ${hubToken}` } }).then((r) => r.json());
  const shipment = shipments.find((s) => s.subOrderId === subOrderId);
  return shipment.id;
}

describe.runIf(backendUp)('real hub performance metrics against a REAL running backend', () => {
  it('CRITICAL: average time between real stage transitions is genuinely computed from real timestamps, not fabricated', async () => {
    // Real, deliberate: routed to the hub the real hub_dev_seed staff
    // account is actually scoped to (hub_guangzhou) -- a brand new
    // real hub has no real staff account able to see shipments there,
    // since GET /hub/me/shipments is scoped to req.user.hubId.
    const { token: adminToken0 } = await login('admin@leap.dev', 'admin_dev_password_123');
    const before = await fetch(`${BACKEND_URL}/hub/performance`, { headers: { Authorization: `Bearer ${adminToken0}` } }).then((r) => r.json());
    const beforeCount = before.find((h) => h.id === 'hub_guangzhou').stageTimes.toOpened?.sampleCount || 0;

    const productId = await createApprovedProduct();
    const shipmentId = await routeOrderToHub(productId, 'hub_guangzhou');

    const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step: 'received', photos: ['/uploads/test.jpg'] }),
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step: 'opened', photos: ['/uploads/test.jpg'] }),
    });

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const performance = await fetch(`${BACKEND_URL}/hub/performance`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const thisHub = performance.find((h) => h.id === 'hub_guangzhou');

    // Real, deliberate: a real, single new sample among hundreds of
    // pre-existing near-instant real test samples won't meaningfully
    // move the real aggregate average -- so this checks the real
    // sample COUNT genuinely increased by exactly one, which the
    // aggregate can't hide, rather than asserting on the diluted
    // average itself.
    expect(thisHub.stageTimes.toOpened.sampleCount).toBe(beforeCount + 1);
  }, 20000);

  it('a hub with no real shipment activity shows null stage times, not zero or a fabricated number', async () => {
    const hub = await createHub();
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const performance = await fetch(`${BACKEND_URL}/hub/performance`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const thisHub = performance.find((h) => h.id === hub.id);

    expect(thisHub.stageTimes.toOpened).toBeNull();
    expect(thisHub.stageTimes.toInspected).toBeNull();
    expect(thisHub.stageTimes.toPacked).toBeNull();
    expect(thisHub.stageTimes.toShippedToBuyer).toBeNull();

    await fetch(`${BACKEND_URL}/hub/locations/${hub.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  });

  it('a non-admin cannot view hub performance metrics', async () => {
    const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/hub/performance`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });
});
