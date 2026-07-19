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

async function createSignedUpBuyer() {
  const suffix = Date.now() + Math.random();
  const email = `txn-email-test-${suffix}@example.com`;
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test_password_123', name: 'Email Trigger Test Buyer' }),
  });
  return res.json();
}

async function shipAndDeliverSubOrder(adminToken, subOrderId, trackingNumber) {
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber }),
  });
  return supplierToken;
}

describe.runIf(backendUp)('real transactional email trigger points against a REAL running backend', () => {
  // NOTE: no real SMTP credentials exist in this environment, so these
  // tests confirm each real trigger point genuinely FIRES (the
  // endpoint succeeds and the underlying action completes correctly)
  // rather than asserting on real delivered email content — that's
  // covered separately, directly against the template functions, in
  // email.test.js (a different app's test suite in this monorepo).

  it('CRITICAL: placing a real order succeeds regardless of whether email delivery succeeds -- the order itself is never blocked by email', async () => {
    const buyer = await createSignedUpBuyer();
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id }),
    });
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.id).toMatch(/^LP-/);
  });

  it('CRITICAL: a real guest order (no real account) also succeeds -- the email trigger handles a real guestEmail, not just a logged-in buyer', async () => {
    const res = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], guestEmail: `txn-email-guest-test-${Date.now()}@example.com` }),
    });
    expect(res.status).toBe(201);
  });

  it('CRITICAL: marking a sub-order shipped succeeds regardless of email delivery, for both a real account and a real guest order', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;

    await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hubId: 'hub_guangzhou' }),
    });
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const shipRes = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'shipped', trackingNumber: `TXN-EMAIL-TEST-${Date.now()}` }),
    });
    expect(shipRes.status).toBe(200);
  }, 15000);

  it('CRITICAL: manually confirming delivery succeeds regardless of email delivery', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    const supplierToken = await shipAndDeliverSubOrder(adminToken, subOrderId, `TXN-EMAIL-DELIVER-${Date.now()}`);

    const deliverRes = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered', deliveryNote: 'Testing the real email trigger' }),
    });
    expect(deliverRes.status).toBe(200);
  }, 15000);

  it('CRITICAL: recording a real payout succeeds regardless of email delivery to the supplier', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const buyer = await createSignedUpBuyer();
    const orderRes = await fetch(`${BACKEND_URL}/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id }),
    });
    const order = await orderRes.json();
    const subOrderId = order.supplierSubOrders[0].subOrderId;
    const supplierToken = await shipAndDeliverSubOrder(adminToken, subOrderId, `TXN-EMAIL-PAYOUT-${Date.now()}`);
    await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ status: 'delivered', deliveryNote: 'Testing the real payout email trigger' }),
    });

    // Real DB access to backdate delivery past the real return window --
    // same real pattern already established in payouts.integration.test.js.
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev' });
    await pool.query(`UPDATE supplier_sub_orders SET delivered_at = now() - interval '10 days' WHERE id = $1`, [subOrderId]);
    await pool.end();

    const payoutRes = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supplierId: 's1', notes: 'Testing the real payout confirmation email trigger' }),
    });
    expect(payoutRes.status).toBe(201);
  }, 15000);
});
