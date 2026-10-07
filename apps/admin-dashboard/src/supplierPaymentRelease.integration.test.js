// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup / inspection only (ageing a delivery past the return window, reading the adjustments), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function isBackendUp() {
  try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; }
}
const backendUp = await isBackendUp();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const in5Days = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const withinACent = (actual, wanted) => Math.abs(actual - wanted) < 0.011; // true amounts can sit exactly on a rounding boundary

beforeAll(async () => {
  // creating a payout needs a payout method on file for the supplier these tests use
  await fetch(`${BACKEND_URL}/supplier/me/payout-method`, { method: 'PUT', headers: auth(await supplierToken()), body: JSON.stringify({ bankName: 'Test Bank', accountNumber: '000111222', accountHolderName: 'Test Supplier Account' }) });
});

const record = async (shipmentId, step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, { method: 'POST', headers: auth(await hubToken()), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
const hubShipmentOfSub = async (subOrderId) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
const post = async (path, body, token) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token || (await adminToken())), body: JSON.stringify(body || {}) });
const subOrderIdOf = async (orderId) => (await pool.query('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [orderId])).rows[0].id;
const owedFor = async () => (await fetch(`${BACKEND_URL}/payouts/owed`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((x) => x.supplierId === 's1')?.amountOwed ?? 0;
const financeNow = async () => fetch(`${BACKEND_URL}/supplier/me/finance`, { headers: auth(await supplierToken()) }).then((r) => r.json());
const netOfSubOrder = async (subOrderId) => Number((await pool.query(
  `SELECT SUM(oli.unit_price * oli.quantity * (1 - pc.commission_percent / 100.0)) AS net FROM order_line_items oli
   JOIN products p ON p.id = oli.product_id JOIN product_categories pc ON pc.id = p.category WHERE oli.sub_order_id = $1`, [subOrderId])).rows[0].net);

// An order shipped by the supplier to the hub, received and FLAGGED, with a fault case opened and the supplier saying they can replace it.
async function flaggedCase({ costBearer, qty = 1 }) {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `sp-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: qty }], userId: buyer.user.id, address: ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = await hubShipmentOfSub(subOrderId);
  await record(shipment.id, 'received');
  expect((await record(shipment.id, 'flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
  expect((await post('/fault-cases', { shipmentId: shipment.id, items: ['p1'], costBearer })).status).toBe(201);
  const caseId = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipment.id).faultCase.id;
  expect((await post(`/fault-cases/supplier/me/${caseId}/answer`, { canReplace: true, eta: in5Days() }, await supplierToken())).status).toBe(200);
  return { orderId: order.id, subOrderId, shipmentId: shipment.id, caseId };
}
const confirmReplacement = (caseId) => post(`/fault-cases/${caseId}/confirm-replacement`, {});
const release = (caseId, body, token) => post(`/fault-cases/${caseId}/release-supplier-payment`, body, token);
const adjustmentsOf = async (caseId) => (await pool.query('SELECT kind, amount, gross_amount, payout_id FROM payout_adjustments WHERE fault_case_id = $1 ORDER BY kind', [caseId])).rows;
const caseView = async (shipmentId) => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipmentId)?.faultCase;

// Takes the replacement all the way to DELIVERED and ages the delivery past the return window, so it becomes payable.
async function deliverReplacementAndAge(replacementOrderId) {
  const subId = await subOrderIdOf(replacementOrderId);
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const shipment = await hubShipmentOfSub(subId);
  for (const step of ['received', 'opened', 'inspected', 'packed']) await record(shipment.id, step);
  await record(shipment.id, 'shipped_to_buyer', { trackingNumber: `HUB-SP-${uniq()}` });
  expect((await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, { method: 'PATCH', headers: auth(await hubToken()), body: JSON.stringify({ deliveryNote: 'Delivered' }) })).status).toBe(200);
  await pool.query(`UPDATE hub_shipments SET delivered_at = now() - interval '60 days' WHERE id = $1`, [shipment.id]);
  return subId;
}

describe.runIf(backendUp)('paying the supplier when LEAP bears the cost of a fault (real backend)', () => {
  it('CRITICAL: only an admin can release it; a SUPPLIER-fault case releases nothing; nothing is released before the refund or replacement is decided; bad shipping amounts are refused', async () => {
    const supplierFault = await flaggedCase({ costBearer: 'supplier' });
    expect((await confirmReplacement(supplierFault.caseId)).status).toBe(200);
    const refused = await release(supplierFault.caseId, {});
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/supplier is at fault/i);
    expect(await adjustmentsOf(supplierFault.caseId)).toHaveLength(0);

    const leapFault = await flaggedCase({ costBearer: 'leap' });
    const early = await release(leapFault.caseId, {});
    expect(early.status).toBe(400);
    expect((await early.json()).error).toMatch(/confirm the refund or the replacement first/i);

    expect((await confirmReplacement(leapFault.caseId)).status).toBe(200);
    for (const bad of [-5, 'abc', 1e9]) expect((await release(leapFault.caseId, { localShippingAmount: bad })).status).toBe(400);
    expect(await adjustmentsOf(leapFault.caseId)).toHaveLength(0);               // none of the refusals recorded anything
    for (const token of [await supplierToken(), await hubToken()]) expect((await release(leapFault.caseId, {}, token)).status).toBe(403);
    expect((await release(999999, {})).status).toBe(404);
  }, 120000);

  it('CRITICAL: releasing records the ORIGINAL order (net of commission) plus the local shipping the admin typed; it is owed straight away, on the admin payout page AND on the supplier\'s own Finance page, and cannot be released twice', async () => {
    const c = await flaggedCase({ costBearer: 'leap' });
    expect((await confirmReplacement(c.caseId)).status).toBe(200);
    const expectedNet = await netOfSubOrder(c.subOrderId);
    expect(expectedNet).toBeGreaterThan(0);
    const owedBefore = await owedFor();
    const readyBefore = (await financeNow()).readyToPay.amount;

    const res = await release(c.caseId, { localShippingAmount: 12.5, note: 'Courier in Guangzhou' });
    expect(res.status).toBe(200);
    const rows = await adjustmentsOf(c.caseId);
    expect(rows.map((r) => r.kind)).toEqual(['local_shipping', 'original_order']);
    expect(withinACent(Number(rows.find((r) => r.kind === 'original_order').amount), expectedNet)).toBe(true);
    expect(Number(rows.find((r) => r.kind === 'local_shipping').amount)).toBe(12.5);
    expect(rows.every((r) => r.payout_id === null)).toBe(true);

    const view = (await caseView(c.shipmentId)).supplierPayment;
    expect(view).toMatchObject({ released: true, localShipping: 12.5, paidOut: false });
    expect(withinACent(view.originalOrder, expectedNet)).toBe(true);

    expect(withinACent((await owedFor()) - owedBefore, expectedNet + 12.5)).toBe(true);            // the admin payout page
    const finance = await financeNow();
    expect(withinACent(finance.readyToPay.amount - readyBefore, expectedNet + 12.5)).toBe(true);  // the supplier's Finance page agrees
    expect(finance.readyToPay.adjustments.filter((a) => a.orderId === c.orderId).map((a) => a.kind).sort()).toEqual(['local_shipping', 'original_order']);

    const again = await release(c.caseId, { localShippingAmount: 3 });
    expect(again.status).toBe(409);
    expect(await adjustmentsOf(c.caseId)).toHaveLength(2);                         // still exactly the two

    const note = (await fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(await supplierToken()) }).then((r) => r.json())).find((n) => n.title === `Payment released for order ${c.orderId}`);
    expect(note.body).toContain('original order');
    expect(note.body).toContain('local shipping');
    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=fault_case_supplier_payment_released`, { headers: auth(await adminToken()) }).then((r) => r.json());
    expect((Array.isArray(log) ? log : log.entries).some((e) => e.targetId === String(c.caseId))).toBe(true);
  }, 120000);

  it('CRITICAL: the whole rule. Leap bears it: the supplier is paid the order + the replacement + local shipping. Supplier at fault: only the unit that was delivered (the replacement), nothing else', async () => {
    const leap = await flaggedCase({ costBearer: 'leap' });
    const supplier = await flaggedCase({ costBearer: 'supplier' });
    expect((await confirmReplacement(leap.caseId)).status).toBe(200);
    expect((await confirmReplacement(supplier.caseId)).status).toBe(200);
    const leapOrderNet = await netOfSubOrder(leap.subOrderId);
    const supplierOrderNet = await netOfSubOrder(supplier.subOrderId);
    const owedBefore = await owedFor();

    expect((await release(leap.caseId, { localShippingAmount: 20 })).status).toBe(200);
    const leapReplacementSub = await deliverReplacementAndAge(`${leap.orderId}-R1`);
    const supplierReplacementSub = await deliverReplacementAndAge(`${supplier.orderId}-R1`);
    const leapReplacementNet = await netOfSubOrder(leapReplacementSub);
    const supplierReplacementNet = await netOfSubOrder(supplierReplacementSub);

    // Leap: original + replacement + shipping.   Supplier at fault: the replacement only (the faulty original is never paid, and nothing is released).
    const expected = leapOrderNet + leapReplacementNet + 20 + supplierReplacementNet;
    expect(withinACent((await owedFor()) - owedBefore, expected)).toBe(true);
    expect(supplierOrderNet).toBeGreaterThan(0); // (the supplier-fault original has a real value; the point is that none of it is paid)
  }, 180000);

  it('CRITICAL: creating the payout takes the adjustments with it: the amount matches what was owed, they are marked paid, nothing is owed twice, and the supplier\'s history never shows a negative commission', async () => {
    const c = await flaggedCase({ costBearer: 'leap' });
    expect((await confirmReplacement(c.caseId)).status).toBe(200);
    expect((await release(c.caseId, { localShippingAmount: 7 })).status).toBe(200);
    const owedBefore = await owedFor();
    expect(owedBefore).toBeGreaterThan(7);

    const payoutRes = await post('/payouts', { supplierId: 's1', notes: 'Includes a released fault payment' });
    expect(payoutRes.status).toBe(201);
    const payout = await payoutRes.json();
    expect(withinACent(payout.amount, owedBefore)).toBe(true);
    expect(payout.adjustmentCount).toBeGreaterThanOrEqual(2);

    const rows = await adjustmentsOf(c.caseId);
    expect(rows.every((r) => r.payout_id === payout.id)).toBe(true);
    expect((await caseView(c.shipmentId))?.supplierPayment?.paidOut ?? true).toBe(true);
    expect(await owedFor()).toBe(0);                                              // nothing is owed twice

    const history = (await financeNow()).payouts.find((p) => p.id === payout.id);
    expect(history.adjustmentsTotal).toBeGreaterThan(7);
    expect(history.commission).toBeGreaterThanOrEqual(0);                          // local shipping is not "commission", and the original order's sales count
    expect(withinACent(history.sales - history.amount, history.commission)).toBe(true);
  }, 120000);

  it('a refund also counts: when Leap bears the cost and the buyer is refunded, the supplier is still paid the original order (no local shipping row when none is given)', async () => {
    const c = await flaggedCase({ costBearer: 'leap' });
    expect((await post(`/fault-cases/${c.caseId}/confirm-refund`, {})).status).toBe(200);
    const res = await release(c.caseId, {});
    expect(res.status).toBe(200);
    expect((await adjustmentsOf(c.caseId)).map((r) => r.kind)).toEqual(['original_order']);
    expect((await caseView(c.shipmentId)).supplierPayment).toMatchObject({ released: true, localShipping: null });
  }, 90000);
});
