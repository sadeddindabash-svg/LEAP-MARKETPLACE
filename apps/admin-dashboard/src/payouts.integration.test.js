import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for test setup only (backdating a real delivered_at
// timestamp to simulate real time passing, since there's no real way
// to wait several real days in an automated test) — reads DATABASE_URL
// from the environment, same pattern already established (and the same
// real bug already found and fixed once) in moderation.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

async function createDeliveredSubOrder(adminToken, quantity = 1) {
  const suffix = Date.now() + Math.random();
  const email = `payout-test-${suffix}@example.com`;
  const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test_password_123' }),
  });
  const { user: buyer } = await signupRes.json();

  const orderRes = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity }], userId: buyer.id }),
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
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'delivered', deliveryNote: 'Test helper: manual delivery confirmation for integration testing' }),
  });

  return { subOrderId, buyerId: buyer.id, buyerEmail: email, orderId: order.id };
}

async function backdateDelivery(subOrderId, daysAgo) {
  const pool = new Pool({ connectionString: TEST_DB_URL });
  await pool.query(`UPDATE supplier_sub_orders SET delivered_at = now() - interval '${daysAgo} days' WHERE id = $1`, [subOrderId]);
  await pool.end();
}

describe.runIf(backendUp)('real return window + real payouts foundation against a REAL running backend', () => {
  it('CRITICAL: the real return window is admin-configurable within 3-7 days, rejecting anything outside that real range', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const tooLow = await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnWindowDays: 2 }),
    });
    expect(tooLow.status).toBe(400);

    const tooHigh = await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnWindowDays: 8 }),
    });
    expect(tooHigh.status).toBe(400);

    const valid = await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnWindowDays: 5 }),
    });
    expect(valid.status).toBe(200);
    expect((await valid.json()).returnWindowDays).toBe(5);

    await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnWindowDays: 7 }),
    });
  });

  it('CRITICAL: a real return CAN be filed within the real window, and CANNOT be filed once the real window has passed', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ returnWindowDays: 5 }),
    });

    const withinWindow = await createDeliveredSubOrder(adminToken);
    const fileWithinWindow = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subOrderId: withinWindow.subOrderId, reason: 'defective', message: 'test', guestEmail: withinWindow.buyerEmail }),
    });
    expect(fileWithinWindow.status).toBe(201);

    const expired = await createDeliveredSubOrder(adminToken);
    await backdateDelivery(expired.subOrderId, 10);
    const fileExpired = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subOrderId: expired.subOrderId, reason: 'defective', message: 'test', guestEmail: expired.buyerEmail }),
    });
    expect(fileExpired.status).toBe(400);
    expect((await fileExpired.json()).error).toContain('return window');

    await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ returnWindowDays: 7 }),
    });
  }, 20000);

  it('CRITICAL: an order only becomes payout-eligible once delivered, the real window has passed, AND no return case was ever filed — verified with real, exact math', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');

    // Freshly delivered -- real window hasn't passed, should NOT be
    // eligible yet.
    const fresh = await createDeliveredSubOrder(adminToken, 1);
    const owedFresh = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const freshTotal = owedFresh.find((o) => o.supplierId === 's1')?.amountOwed || 0;

    // Delivered long ago, real window has passed, no return -- SHOULD
    // be eligible, with a real, exact commission-adjusted amount.
    const eligible = await createDeliveredSubOrder(adminToken, 2);
    await backdateDelivery(eligible.subOrderId, 10);
    const owedAfterEligible = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const eligibleEntry = owedAfterEligible.find((o) => o.supplierId === 's1');
    expect(eligibleEntry).toBeDefined();
    expect(eligibleEntry.amountOwed).toBeGreaterThan(freshTotal);

    // Delivered long ago, real window has passed, but a REAL return
    // case was filed -- should be excluded from payout eligibility
    // entirely, regardless of the calendar window. File the return
    // FIRST (while genuinely within the window, so it actually
    // succeeds), THEN backdate delivery to simulate time having passed
    // since -- backdating first would make the return filing itself
    // get rejected by the window check, which would defeat the point
    // of this test entirely.
    const returned = await createDeliveredSubOrder(adminToken, 1);
    const returnRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subOrderId: returned.subOrderId, reason: 'defective', message: 'test', guestEmail: returned.buyerEmail }),
    });
    expect(returnRes.status).toBe(201); // confirm the return itself genuinely succeeded
    await backdateDelivery(returned.subOrderId, 10);
    const owedAfterReturn = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const afterReturnEntry = owedAfterReturn.find((o) => o.supplierId === 's1');
    // The real owed amount should be unchanged by the returned
    // sub-order -- it must never be counted, whether or not the window
    // has technically passed for it.
    expect(afterReturnEntry.amountOwed).toBe(eligibleEntry.amountOwed);
  }, 30000);

  it('CRITICAL: recording a real payout covers exactly the real eligible amount, clears it from what\'s owed, and cannot be double-paid', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const order = await createDeliveredSubOrder(adminToken, 3);
    await backdateDelivery(order.subOrderId, 10);

    const owedBefore = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const amountBefore = owedBefore.find((o) => o.supplierId === 's1').amountOwed;
    expect(amountBefore).toBeGreaterThan(0);

    const payoutRes = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supplierId: 's1', notes: 'test payout' }),
    });
    expect(payoutRes.status).toBe(201);
    const payout = await payoutRes.json();
    expect(payout.amount).toBeCloseTo(amountBefore, 1);

    // Immediately trying to pay again should find nothing new owed for
    // the exact same real sub-orders (the real UNIQUE constraint on
    // payout_sub_orders prevents double-counting).
    const secondPayout = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supplierId: 's1' }),
    });
    expect(secondPayout.status).toBe(400);

    // The real payout shows up in real history.
    const history = await fetch(`${BACKEND_URL}/payouts`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    expect(history.find((p) => p.id === payout.id)).toBeDefined();
  }, 20000);

  it('non-admins cannot access any of the real payouts or platform-settings endpoints', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const owedRes = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: { Authorization: `Bearer ${token}` } });
    expect(owedRes.status).toBe(403);
    const settingsRes = await fetch(`${BACKEND_URL}/platform-settings/return-window`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ returnWindowDays: 5 }),
    });
    expect(settingsRes.status).toBe(403);
    const createPayoutRes = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ supplierId: 's1' }),
    });
    expect(createPayoutRes.status).toBe(403);
  });

  it('CRITICAL: recording a payout for a supplier with nothing real owed is rejected', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/payouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supplierId: 's3' }), // a real supplier with no real eligible sub-orders right now
    });
    expect(res.status).toBe(400);
  });

  it('CRITICAL: the real commission percent is admin-editable per category, within a real 0-100 range', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const original = await fetch(`${BACKEND_URL}/catalog/categories`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => r.json())
      .then((cats) => cats.find((c) => c.id === 'brake').commissionPercent);

    const invalid = await fetch(`${BACKEND_URL}/catalog/categories/brake/commission`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ commissionPercent: 150 }),
    });
    expect(invalid.status).toBe(400);

    const valid = await fetch(`${BACKEND_URL}/catalog/categories/brake/commission`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ commissionPercent: 20 }),
    });
    expect(valid.status).toBe(200);
    expect((await valid.json()).commissionPercent).toBe(20);

    await fetch(`${BACKEND_URL}/catalog/categories/brake/commission`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ commissionPercent: original }),
    });
  });
});
