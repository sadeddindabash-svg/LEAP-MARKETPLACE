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

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `verified-purchase-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

// Real, full delivery workflow -- p1 belongs to supplier s1
// (supplier@leap.dev), matching the real accounts already seeded.
async function deliverProductToBuyer(buyerId, productId = 'p1') {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId, quantity: 1 }], userId: buyerId, address: TEST_ADDRESS }),
  });
  const order = await orderRes.json();
  const subOrderId = order.supplierSubOrders[0].subOrderId;

  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `VP-${Date.now()}` }),
  });

  const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: { Authorization: `Bearer ${hubToken}` } }).then((r) => r.json());
  const shipment = shipments.find((s) => s.orderId === order.id);
  for (const step of ['received', 'opened', 'inspected', 'packed']) {
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step, photos: ['/uploads/test.jpg'] }),
    });
  }
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
    body: JSON.stringify({ step: 'shipped_to_buyer', photos: ['/uploads/test.jpg'], trackingNumber: `VP-FINAL-${Date.now()}` }),
  });
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
    body: JSON.stringify({ deliveryNote: 'Delivered for real test' }),
  });
}

describe.runIf(backendUp)('real verified-purchase badge on reviews against a REAL running backend', () => {
  it('CRITICAL: a review from a buyer with no real purchase is stored as isVerifiedPurchase: false', async () => {
    const buyer = await createSignedUpBuyer();
    const res = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5, comment: 'no real purchase behind this' }),
    });
    const body = await res.json();
    expect(body.isVerifiedPurchase).toBe(false);
  }, 15000);

  it('CRITICAL: a review from a buyer with a genuinely delivered order is stored as isVerifiedPurchase: true, correctly shown in the moderate response and the real public endpoint', async () => {
    const buyer = await createSignedUpBuyer();
    await deliverProductToBuyer(buyer.user.id, 'p1');

    const created = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5, comment: 'a real, genuine verified purchase' }),
    }).then((r) => r.json());
    expect(created.isVerifiedPurchase).toBe(true);

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const moderated = await fetch(`${BACKEND_URL}/reviews/${created.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve' }),
    }).then((r) => r.json());
    expect(moderated.isVerifiedPurchase).toBe(true);

    const publicReviews = await fetch(`${BACKEND_URL}/catalog/products/p1/reviews`).then((r) => r.json());
    const publicEntry = publicReviews.reviews.find((r) => r.id === created.id);
    expect(publicEntry.isVerifiedPurchase).toBe(true);
  }, 20000);

  it('a real, later edit of the SAME review re-checks and re-stores the real verified-purchase status', async () => {
    const buyer = await createSignedUpBuyer();
    const first = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 3, comment: 'before delivery' }),
    }).then((r) => r.json());
    expect(first.isVerifiedPurchase).toBe(false);

    await deliverProductToBuyer(buyer.user.id, 'p1');

    const edited = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5, comment: 'after delivery, same review row' }),
    }).then((r) => r.json());
    expect(edited.id).toBe(first.id);
    expect(edited.isVerifiedPurchase).toBe(true);
  }, 20000);
});
