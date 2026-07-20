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
// Real, valid test address (migration 030 now requires one for a real
// logged-in buyer placing an order).
const TEST_ADDRESS = { recipientName: 'Test Buyer', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const email = `review-test-${suffix}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test_password_123' }),
  });
  return res.json();
}

async function deliverProductToBuyer(adminToken, buyerId, productId) {
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
    body: JSON.stringify({ status: 'shipped' }),
  });

  // CONFIRMED (migration 027): delivery confirmation is a real HUB
  // action now -- the supplier's own leg only reaches the hub, never
  // the buyer directly. Walk the full real hub workflow.
  const { token: hubToken } = await login('hub@leap.dev', 'hub_dev_password_123');
  const shipmentRows = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: { Authorization: `Bearer ${hubToken}` } }).then((r) => r.json());
  const shipment = shipmentRows.find((s) => s.orderId === order.id);
  for (const step of ['received', 'opened', 'inspected', 'packed']) {
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ step, photos: ['/uploads/test.jpg'] }),
    });
  }
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
    body: JSON.stringify({ step: 'shipped_to_buyer', photos: ['/uploads/test.jpg'], trackingNumber: `TEST-FINAL-LEG-${Date.now()}-${Math.random()}` }),
  });
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
    body: JSON.stringify({ deliveryNote: 'Test helper: manual delivery confirmation for integration testing' }),
  });
}

async function setVerifiedPurchaseRequired(adminToken, value) {
  await fetch(`${BACKEND_URL}/platform-settings/require-verified-purchase-for-reviews`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ requireVerifiedPurchase: value }),
  });
}

describe.runIf(backendUp)('real product reviews (admin moderation, verified-purchase toggle) against a REAL running backend', () => {
  it('CRITICAL: a submitted review is invisible publicly until a real admin approves it', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await setVerifiedPurchaseRequired(adminToken, false);
    const { token: buyerToken } = await createSignedUpBuyer();

    const createRes = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ productId: 'p1', rating: 5, comment: 'test review' }),
    });
    expect(createRes.status).toBe(201);
    const review = await createRes.json();
    expect(review.status).toBe('pending');

    const beforeApproval = await fetch(`${BACKEND_URL}/catalog/products/p1/reviews`).then((r) => r.json());
    expect(beforeApproval.reviews.find((r) => r.id === review.id)).toBeUndefined();

    const { token: adminToken2 } = await login('admin@leap.dev', 'admin_dev_password_123');
    const approveRes = await fetch(`${BACKEND_URL}/reviews/${review.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken2}` },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(approveRes.status).toBe(200);

    const afterApproval = await fetch(`${BACKEND_URL}/catalog/products/p1/reviews`).then((r) => r.json());
    expect(afterApproval.reviews.find((r) => r.id === review.id)).toBeDefined();
  });

  it('CRITICAL: submitting a second review for the same product is a real EDIT, not a new row, and sends it back to pending', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await setVerifiedPurchaseRequired(adminToken, false);
    const { token: buyerToken } = await createSignedUpBuyer();

    const first = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ productId: 'p1', rating: 5 }),
    }).then((r) => r.json());

    await fetch(`${BACKEND_URL}/reviews/${first.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve' }),
    });

    const second = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ productId: 'p1', rating: 2, comment: 'changed my mind' }),
    }).then((r) => r.json());

    expect(second.id).toBe(first.id); // same real row, a real edit
    expect(second.status).toBe('pending'); // genuinely sent back for re-review
    expect(second.rating).toBe(2);

    const myReviews = await fetch(`${BACKEND_URL}/reviews/me`, { headers: { Authorization: `Bearer ${buyerToken}` } }).then((r) => r.json());
    expect(myReviews.length).toBe(1); // never a second row
  });

  it('CRITICAL: when verified purchase is required, only a buyer who actually received the product can review it', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await setVerifiedPurchaseRequired(adminToken, true);
    const buyer = await createSignedUpBuyer();

    const withoutPurchase = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5 }),
    });
    expect(withoutPurchase.status).toBe(403);

    await deliverProductToBuyer(adminToken, buyer.user.id, 'p1');
    const withPurchase = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5 }),
    });
    expect(withPurchase.status).toBe(201);

    await setVerifiedPurchaseRequired(adminToken, false);
  }, 20000);

  it('a buyer can delete only their own real review, never someone else\'s', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await setVerifiedPurchaseRequired(adminToken, false);
    const buyer1 = await createSignedUpBuyer();
    const buyer2 = await createSignedUpBuyer();

    const review = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({ productId: 'p1', rating: 5 }),
    }).then((r) => r.json());

    const otherDelete = await fetch(`${BACKEND_URL}/reviews/${review.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${buyer2.token}` } });
    expect(otherDelete.status).toBe(404);

    const ownDelete = await fetch(`${BACKEND_URL}/reviews/${review.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${buyer1.token}` } });
    expect(ownDelete.status).toBe(204);
  });

  it('an invalid rating is rejected, and non-admins cannot access moderation endpoints', async () => {
    const { token: buyerToken } = await createSignedUpBuyer();
    const badRating = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ productId: 'p1', rating: 6 }),
    });
    expect(badRating.status).toBe(400);

    const pendingRes = await fetch(`${BACKEND_URL}/reviews/pending`, { headers: { Authorization: `Bearer ${buyerToken}` } });
    expect(pendingRes.status).toBe(403);

    const moderateRes = await fetch(`${BACKEND_URL}/reviews/1/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(moderateRes.status).toBe(403);
  });

  it('CRITICAL: the average rating on a product is computed only from real APPROVED reviews', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await setVerifiedPurchaseRequired(adminToken, false);
    const buyer1 = await createSignedUpBuyer();
    const buyer2 = await createSignedUpBuyer();

    // A real delta check, not an absolute one -- product p9 may already
    // carry real approved reviews from earlier real test runs (this
    // test file has no direct DB access to reset that state, unlike
    // payouts.integration.test.js).
    const before = await fetch(`${BACKEND_URL}/catalog/products/p9/reviews`).then((r) => r.json());

    const r1 = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({ productId: 'p9', rating: 4 }),
    }).then((r) => r.json());
    const r2 = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({ productId: 'p9', rating: 2 }),
    }).then((r) => r.json());

    // Approve only ONE of the two -- the average must reflect only that one.
    await fetch(`${BACKEND_URL}/reviews/${r1.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve' }),
    });
    await fetch(`${BACKEND_URL}/reviews/${r2.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'reject' }),
    });

    const after = await fetch(`${BACKEND_URL}/catalog/products/p9/reviews`).then((r) => r.json());
    // Exactly ONE real new approved review was added (r1); r2 was
    // rejected and must never count.
    expect(after.reviewCount).toBe(before.reviewCount + 1);
    expect(after.reviews.find((r) => r.id === r1.id)).toBeDefined();
    expect(after.reviews.find((r) => r.id === r2.id)).toBeUndefined();
  });
});
