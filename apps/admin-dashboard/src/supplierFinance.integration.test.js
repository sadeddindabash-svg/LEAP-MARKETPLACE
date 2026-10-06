import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for test setup only: backdating a delivery to simulate days passing (same
// approach as payouts.integration.test.js).
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
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

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });

async function supplierToken() { return (await login('supplier@leap.dev', 'supplier_dev_password_123')).token; }
async function adminToken() { return (await login('admin@leap.dev', 'admin_dev_password_123')).token; }
const getFinance = async () => fetch(`${BACKEND_URL}/supplier/me/finance`, { headers: auth(await supplierToken()) }).then((r) => r.json());

// Places an order for the seeded product p1 and walks it through the real hub workflow to
// "delivered". Backdating makes the return window count as passed.
async function createDeliveredSubOrder({ quantity = 1, backdateDays } = {}) {
  const admin = await adminToken();
  const supplier = await supplierToken();
  const hub = (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const email = `finance-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const buyer = (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'test_password_123' }) }).then((r) => r.json())).user;
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity }], userId: buyer.id, address: TEST_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(admin), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplier), body: JSON.stringify({ status: 'shipped' }) });
  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json());
  const shipment = shipments.find((s) => s.orderId === order.id);
  for (const step of ['received', 'opened', 'inspected', 'packed']) {
    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'] }) });
  }
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step: 'shipped_to_buyer', photos: ['/uploads/test.jpg'], trackingNumber: `FIN-${Date.now()}` }) });
  await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, { method: 'PATCH', headers: auth(hub), body: JSON.stringify({ deliveryNote: 'Test: manual delivery confirmation' }) });
  if (backdateDays) {
    const pool = new Pool({ connectionString: TEST_DB_URL });
    await pool.query(`UPDATE hub_shipments SET delivered_at = now() - interval '${backdateDays} days' WHERE sub_order_id = $1`, [subOrderId]);
    await pool.end();
  }
  return { subOrderId };
}

describe.runIf(backendUp)("a supplier's real finance figures against a REAL running backend", () => {
  beforeAll(async () => {
    // Recording a payout requires a payout method on file (migration 034).
    await fetch(`${BACKEND_URL}/supplier/me/payout-method`, {
      method: 'PUT', headers: auth(await supplierToken()),
      body: JSON.stringify({ bankName: 'Test Bank', accountNumber: '000111222', accountHolderName: 'Test Supplier Account' }),
    });
  });

  it('returns the supplier\'s own figures in USD, and refuses anyone who is not a supplier', async () => {
    const f = await getFinance();
    expect(f.currencyCode).toBe('USD');
    expect(f.returnWindowDays).toBeGreaterThan(0);
    for (const key of ['readyToPay', 'inReturnWindow']) {
      expect(typeof f[key].amount).toBe('number');
      expect(Number.isInteger(f[key].orderCount)).toBe(true);
    }
    expect(typeof f.totalPaid).toBe('number');
    expect(Array.isArray(f.payouts)).toBe(true);
    expect(Array.isArray(f.commission.categories)).toBe(true);

    expect((await fetch(`${BACKEND_URL}/supplier/me/finance`, { headers: auth(await adminToken()) })).status).toBe(403);
    expect((await fetch(`${BACKEND_URL}/supplier/me/finance`)).status).toBe(401);
  });

  it('CRITICAL: "ready to be paid" always matches what the admin Payouts page says is owed to this supplier', async () => {
    // Other test files record payouts for this same supplier at the same time, so a read of each
    // can land either side of one; retry a few times and require a consistent pair.
    let finance;
    let owed;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      finance = await getFinance();
      const list = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: auth(await adminToken()) }).then((r) => r.json());
      owed = list.find((o) => o.supplierId === 's1')?.amountOwed || 0;
      if (Math.abs(finance.readyToPay.amount - owed) < 0.005) break;
    }
    expect(finance.readyToPay.amount).toBeCloseTo(owed, 2);
  });

  it('CRITICAL: a recorded payout shows up in the supplier\'s history with exact orders, sales and commission', async () => {
    await createDeliveredSubOrder({ quantity: 2, backdateDays: 10 }); // delivered long ago -> payable now
    const recorded = await fetch(`${BACKEND_URL}/payouts`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ supplierId: 's1', notes: 'finance test payout' }) });
    expect(recorded.status).toBe(201);
    const payout = await recorded.json();

    // Look the payout up by its own id: nothing a concurrent test does can change it.
    const row = (await getFinance()).payouts.find((p) => p.id === payout.id);
    expect(row).toBeTruthy();
    expect(row.amount).toBe(payout.amount);
    expect(row.currencyCode).toBe('USD');
    expect(row.notes).toBe('finance test payout');
    expect(row.orderCount).toBe(payout.subOrderCount);
    expect(row.orderCount).toBeGreaterThanOrEqual(1);
    // The server computed the amount from these orders, so sales minus payout IS the commission.
    expect(row.commission).toBeGreaterThan(0);
    expect(row.sales - row.commission).toBeCloseTo(row.amount, 2);
    expect(row.commission).toBeLessThan(row.sales);
  }, 40000);

  it('every payout in the history reconciles, and the lifetime total equals the sum of them', async () => {
    const f = await getFinance();
    for (const p of f.payouts) {
      expect(p.sales - p.commission).toBeCloseTo(p.amount, 2);
      expect(p.commission).toBeGreaterThanOrEqual(-0.01);
    }
    // The history is capped (newest 100); the total is not. Only comparable while under the cap.
    if (f.payouts.length < 100) {
      expect(f.totalPaid).toBeCloseTo(f.payouts.reduce((s, p) => s + p.amount, 0), 2);
    }
    const newestFirst = f.payouts.map((p) => new Date(p.paidAt).getTime());
    expect([...newestFirst].sort((a, b) => b - a)).toEqual(newestFirst);
  });

  it('a freshly delivered order is counted as "in the return window", not as ready to be paid', async () => {
    const before = await getFinance();
    await createDeliveredSubOrder({ quantity: 1 }); // delivered just now: window has NOT passed
    const after = await getFinance();
    expect(after.inReturnWindow.orderCount).toBeGreaterThanOrEqual(before.inReturnWindow.orderCount + 1);
    expect(after.inReturnWindow.amount).toBeGreaterThan(before.inReturnWindow.amount);
  }, 40000);

  it('commission rates are per category and come from the categories this supplier actually sells in', async () => {
    const { commission } = await getFinance();
    expect(commission.categories.length).toBeGreaterThan(0);
    for (const c of commission.categories) {
      expect(typeof c.percent).toBe('number');
      expect(c.percent).toBeGreaterThanOrEqual(0);
      expect(c.percent).toBeLessThan(100);
    }
    const percents = commission.categories.map((c) => c.percent);
    expect(commission.minPercent).toBe(Math.min(...percents));
    expect(commission.maxPercent).toBe(Math.max(...percents));
  });
});
