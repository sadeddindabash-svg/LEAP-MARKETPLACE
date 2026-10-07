import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup / inspection only (the final state of a closed case, ageing a delivery past the return window), same approach as payouts.integration.test.js.
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ARABIC_ADDRESS = { recipientName: 'محمد العتيبي', phone: '0551234567', country: 'السعودية', city: 'الرياض', streetAddress: 'شارع الملك فهد، حي العليا، مبنى رقم ١٢٣' };

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
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ARABIC = /[\u0600-\u06FF]/;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const otherSupplierToken = async () => (await login('leap-supplier@leap.dev', 'LeapSupplier2026!')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const in5Days = () => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

// A buyer's order for p1 (Arabic address), shipped to the Guangzhou hub, received and FLAGGED by the hub.
async function createFlagged({ qty = 2 } = {}) {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `rp-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: qty }], userId: buyer.user.id, address: ARABIC_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  const f = { orderId: order.id, total: order.total, subOrderId, buyerToken: buyer.token, buyerId: buyer.user.id };
  f.shipment = await hubShipmentOfSub(subOrderId);
  expect((await record(f.shipment.id, 'received')).status).toBe(201);
  expect((await record(f.shipment.id, 'flagged', { notes: 'Cracked housing', damageType: 'physical_damage' })).status).toBe(201);
  return f;
}
const hubShipmentOfSub = async (subOrderId) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
const record = async (shipmentId, step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/events`, { method: 'POST', headers: auth(await hubToken()), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
const subOrderIdOf = async (orderId) => (await pool.query('SELECT id FROM supplier_sub_orders WHERE order_id = $1', [orderId])).rows[0].id;

const post = async (path, body, token) => fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(token || (await adminToken())), body: JSON.stringify(body || {}) });
const openCase = async (shipmentId, costBearer = 'supplier') => (await (await post('/fault-cases', { shipmentId, items: ['p1'], costBearer })).json());
const queueEntry = async (shipmentId) => (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.id === shipmentId);
const caseOf = async (shipmentId) => (await queueEntry(shipmentId)).faultCase;
const supplierAnswers = async (caseId, canReplace, token) => post(`/fault-cases/supplier/me/${caseId}/answer`, canReplace ? { canReplace: true, eta: in5Days() } : { canReplace: false, note: 'no stock' }, token || (await supplierToken()));
const confirmReplacement = (caseId, token) => post(`/fault-cases/${caseId}/confirm-replacement`, {}, token);
const orderAs = (token, orderId) => fetch(`${BACKEND_URL}/order/${orderId}`, { headers: auth(token) }).then((r) => r.json());
const notificationsOf = (token, lang) => fetch(`${BACKEND_URL}/notifications/me${lang ? `?lang=${lang}` : ''}`, { headers: auth(token) }).then((r) => r.json());
const dbCase = async (caseId) => (await pool.query('SELECT status, outcome, replacement_order_id, replacement_delivered_at, hub_return FROM fault_cases WHERE id = $1', [caseId])).rows[0];

// Takes a replacement order from the supplier shipping it to the buyer receiving it.
async function shipAndDeliverReplacement(replacementOrderId, { deliver = true } = {}) {
  const subId = await subOrderIdOf(replacementOrderId);
  expect((await fetch(`${BACKEND_URL}/supplier/me/orders/${subId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) })).status).toBe(200);
  const shipment = await hubShipmentOfSub(subId);
  for (const step of ['received', 'opened', 'inspected', 'packed']) expect((await record(shipment.id, step)).status).toBe(201);
  expect((await record(shipment.id, 'shipped_to_buyer', { trackingNumber: `HUB-R-${uniq()}` })).status).toBe(201);
  if (deliver) expect((await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, { method: 'PATCH', headers: auth(await hubToken()), body: JSON.stringify({ deliveryNote: 'Left with the doorman' }) })).status).toBe(200);
  return { subId, shipment };
}
// The supplier ships a replacement and the hub RECEIVES it (it stops there, so the hub can still flag it).
async function receiveReplacementAtHub(replacementOrderId) {
  const subId = await subOrderIdOf(replacementOrderId);
  expect((await fetch(`${BACKEND_URL}/supplier/me/orders/${subId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) })).status).toBe(200);
  const shipment = await hubShipmentOfSub(subId);
  expect((await record(shipment.id, 'received')).status).toBe(201);
  return shipment;
}
const returnFaultyUnit = (f) => record(f.shipment.id, 'returned_to_supplier', { trackingNumber: `RET-${uniq()}` });

// A flagged order with the case opened, the supplier saying yes, and the replacement confirmed.
async function withReplacement(opts) {
  const f = await createFlagged(opts);
  const opened = await openCase(f.shipment.id);
  await supplierAnswers(opened.faultCase?.id ?? (await caseOf(f.shipment.id)).id, true);
  const caseId = (await caseOf(f.shipment.id)).id;
  const res = await confirmReplacement(caseId);
  expect(res.status).toBe(200);
  return { ...f, caseId, replacementOrderId: `${f.orderId}-R1` };
}

describe.runIf(backendUp)('replacement orders for a confirmed real fault (real backend)', () => {
  it('CRITICAL: a replacement needs the supplier to have said YES; nothing is created otherwise; only an admin can confirm it', async () => {
    const f = await createFlagged();
    await openCase(f.shipment.id);
    const caseId = (await caseOf(f.shipment.id)).id;

    expect((await confirmReplacement(caseId)).status).toBe(400);                  // the supplier has not answered
    expect((await supplierAnswers(caseId, false)).status).toBe(200);              // "we cannot replace it"
    const refused = await confirmReplacement(caseId);
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatch(/cannot replace/i);
    expect((await pool.query('SELECT 1 FROM orders WHERE id = $1', [`${f.orderId}-R1`])).rows).toHaveLength(0); // no order was created by the refusals

    expect((await confirmReplacement(999999)).status).toBe(404);
    for (const token of [f.buyerToken, await hubToken(), await supplierToken()]) expect((await confirmReplacement(caseId, token)).status).toBe(403);
  }, 60000);

  it('CRITICAL: confirming creates the free replacement order "<original>-R1" with the faulty items at their original prices, the same address (English version too), the same hub; the buyer and supplier are told', async () => {
    const r = await withReplacement({ qty: 2 });
    const admin = await orderAs(await adminToken(), r.replacementOrderId);
    expect(admin).toMatchObject({ id: r.replacementOrderId, isReplacement: true, replacementOf: r.orderId, total: 0 });
    const original = await orderAs(await adminToken(), r.orderId);
    const origItem = original.supplierSubOrders[0].items[0];
    expect(admin.supplierSubOrders).toHaveLength(1);
    expect(admin.supplierSubOrders[0].items).toEqual([expect.objectContaining({ productId: 'p1', quantity: 2, unitPrice: origItem.unitPrice })]); // original price, kept for the supplier's payout
    expect(admin.supplierSubOrders[0].hubId).toBe(original.supplierSubOrders[0].hubId);
    expect(admin.address).toMatchObject({ recipientName: 'محمد العتيبي', city: 'الرياض' });
    expect(admin.addressEnglish).toMatchObject({ recipientName: 'Mohammed Al-Otaibi', city: 'Riyadh' }); // the hub gets the English address for the replacement too

    const fc = await dbCase(r.caseId);
    expect(fc).toMatchObject({ status: 'replacement_pending', outcome: 'replacement', replacement_order_id: r.replacementOrderId });
    const entry = await queueEntry(r.shipment.id);
    expect(entry.faultCase.replacement).toMatchObject({ orderId: r.replacementOrderId, stage: 'waiting_for_supplier' });

    // the buyer is told, in each language; the supplier is asked to ship it
    const en = (await notificationsOf(r.buyerToken)).find((n) => n.body.includes(r.replacementOrderId));
    expect(en.body).toContain('replacement at no charge');
    const ar = (await notificationsOf(r.buyerToken, 'ar')).find((n) => n.id === en.id);
    expect(ar.body).toMatch(ARABIC);
    expect(ar.body).toContain(r.replacementOrderId);
    const supplierNote = (await notificationsOf(await supplierToken())).find((n) => n.title === `Replacement order ${r.replacementOrderId}`);
    expect(supplierNote).toBeTruthy();
  }, 60000);

  it('CRITICAL: the buyer sees the replacement with NO prices and a total of zero, and cannot cancel it; the real prices stay visible to admin', async () => {
    const r = await withReplacement();
    const buyerView = await orderAs(r.buyerToken, r.replacementOrderId);
    expect(buyerView).toMatchObject({ isReplacement: true, replacementOf: r.orderId, total: 0 });
    for (const item of buyerView.supplierSubOrders.flatMap((so) => so.items)) expect(item.unitPrice).toBe(0);
    expect((await orderAs(await adminToken(), r.replacementOrderId)).supplierSubOrders[0].items[0].unitPrice).toBeGreaterThan(0);

    const subId = await subOrderIdOf(r.replacementOrderId);
    for (const path of [`/order/${r.replacementOrderId}/cancel`, `/order/${r.replacementOrderId}/sub-orders/${subId}/cancel`]) {
      const res = await fetch(`${BACKEND_URL}${path}`, { method: 'POST', headers: auth(r.buyerToken), body: JSON.stringify({}) });
      expect([400, 404]).toContain(res.status); // never a success
      if (res.status === 400) expect((await res.json()).error).toMatch(/replacement order is free of charge/i);
    }
    expect((await orderAs(await adminToken(), r.replacementOrderId)).status).not.toBe('cancelled');
  }, 60000);

  it('CRITICAL: the replacement flows through the normal pipeline, and the case completes only when it is DELIVERED *and* the faulty unit is back (delivered first)', async () => {
    const r = await withReplacement();
    const { shipment } = await shipAndDeliverReplacement(r.replacementOrderId, { deliver: false });
    const hubDetail = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}`, { headers: auth(await hubToken()) }).then((r2) => r2.json());
    expect(hubDetail.replacementFor).toBe(r.orderId);                                   // hub staff are told what it is
    expect((await queueEntry(r.shipment.id)).faultCase.replacement.stage).toBe('shipped_to_buyer');

    await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, { method: 'PATCH', headers: auth(await hubToken()), body: JSON.stringify({ deliveryNote: 'Delivered to the buyer' }) });
    let fc = await dbCase(r.caseId);
    expect(fc.replacement_delivered_at).not.toBeNull();
    expect(fc.status).toBe('replacement_pending');                                      // the faulty unit is still at the hub: NOT complete yet
    expect((await queueEntry(r.shipment.id))).toBeTruthy();                             // the flag is still open

    expect((await returnFaultyUnit(r)).status).toBe(201);                               // now it leaves the hub
    fc = await dbCase(r.caseId);
    expect(fc).toMatchObject({ status: 'completed', hub_return: 'returned' });
    expect(await queueEntry(r.shipment.id)).toBeUndefined();                            // the flag is closed
    expect((await pool.query('SELECT resolution FROM hub_shipments WHERE id = $1', [r.shipment.id])).rows[0].resolution).toBe('fault_replacement');
    const closed = (await notificationsOf(r.buyerToken)).filter((n) => n.title === 'Your return request was updated');
    expect(closed.some((n) => n.body.includes('This case is now closed'))).toBe(true);
  }, 90000);

  it('...and the same when the faulty unit goes back FIRST and the replacement is delivered afterwards', async () => {
    const r = await withReplacement();
    expect((await returnFaultyUnit(r)).status).toBe(201);
    expect((await dbCase(r.caseId)).status).toBe('replacement_pending');               // nothing is complete until the replacement arrives
    await shipAndDeliverReplacement(r.replacementOrderId);
    expect(await dbCase(r.caseId)).toMatchObject({ status: 'completed', hub_return: 'returned' });
  }, 90000);

  it('CRITICAL: the supplier is paid ONCE: the replacement becomes payable when delivered (at the original price); the faulty original never does', async () => {
    const owedFor = async (supplierId) => { const rows = await fetch(`${BACKEND_URL}/payouts/owed`, { headers: auth(await adminToken()) }).then((x) => x.json()); return rows.find((x) => x.supplierId === supplierId)?.amountOwed ?? 0; };
    const readyFor = async () => (await fetch(`${BACKEND_URL}/supplier/me/finance`, { headers: auth(await supplierToken()) }).then((x) => x.json())).readyToPay.amount;

    const r = await withReplacement({ qty: 2 });
    await returnFaultyUnit(r);
    const { subId, shipment } = await shipAndDeliverReplacement(r.replacementOrderId);
    const owedBefore = await owedFor('s1');
    const readyBefore = await readyFor();

    // age the delivery past the return window: only now can it be paid
    await pool.query(`UPDATE hub_shipments SET delivered_at = now() - interval '60 days' WHERE id = $1`, [shipment.id]);
    const expected = Number((await pool.query(
      `SELECT SUM(oli.unit_price * oli.quantity * (1 - pc.commission_percent / 100.0)) AS net
       FROM order_line_items oli JOIN products p ON p.id = oli.product_id JOIN product_categories pc ON pc.id = p.category WHERE oli.sub_order_id = $1`, [subId]
    )).rows[0].net);
    expect(expected).toBeGreaterThan(0);

    // Amounts are compared to within a cent: the true figure can sit exactly on a rounding boundary (e.g. 66.385), and two sums rounded
    // separately may land on either side of it.
    const withinACent = (actual, wanted) => Math.abs(actual - wanted) < 0.011;
    expect(withinACent((await owedFor('s1')) - owedBefore, expected)).toBe(true);   // exactly the replacement, and not the faulty original
    expect(withinACent((await readyFor()) - readyBefore, expected)).toBe(true);     // the supplier's own Finance page agrees
    // the faulty original (it has a return case) is not payable, however old
    expect((await pool.query('SELECT 1 FROM return_cases WHERE sub_order_id = $1', [r.subOrderId])).rows.length).toBeGreaterThan(0);
  }, 90000);

  it('a replacement that is ITSELF faulty is numbered -R2 from the order the buyer paid for, and a refund on it is measured against the original payment', async () => {
    const r = await withReplacement();
    const shipment = await receiveReplacementAtHub(r.replacementOrderId);
    // the hub receives it and flags the replacement too (it never reached the buyer)
    expect((await record(shipment.id, 'flagged', { notes: 'Also cracked', damageType: 'physical_damage' })).status).toBe(201);
    const second = await (await post('/fault-cases', { shipmentId: shipment.id, items: ['p1'], costBearer: 'supplier' })).json();
    expect(second.faultCase).toBeTruthy();
    const secondId = (await caseOf(shipment.id)).id;

    // a refund on the free replacement is capped by what the buyer PAID (the original order), never by the replacement's zero total
    const suggestion = (await caseOf(shipment.id)).refundSuggestion;
    expect(suggestion.orderTotal).toBe(r.total);
    expect(suggestion.suggested).toBeGreaterThan(0);
    const refund = await post(`/fault-cases/${secondId}/confirm-refund`, {});
    expect(refund.status).toBe(200);
    expect((await refund.json()).faultCase.refund.amount).toBeLessThanOrEqual(r.total);

    // and a SECOND replacement of the same root would be numbered -R2: prove it on a fresh chain
    const chain = await withReplacement();
    const s2 = await receiveReplacementAtHub(chain.replacementOrderId);
    await record(s2.id, 'flagged', { notes: 'Again', damageType: 'physical_damage' });
    await post('/fault-cases', { shipmentId: s2.id, items: ['p1'], costBearer: 'supplier' });
    const c2 = (await caseOf(s2.id)).id;
    await supplierAnswers(c2, true);
    expect((await confirmReplacement(c2)).status).toBe(200);
    const r2 = await orderAs(await adminToken(), `${chain.orderId}-R2`);
    expect(r2).toMatchObject({ id: `${chain.orderId}-R2`, replacementOf: chain.orderId, isReplacement: true });
  }, 120000);

  it('a case takes ONE outcome: after a replacement is confirmed a refund is refused (and the other way round); confirming twice is refused; the audit log records it', async () => {
    const r = await withReplacement();
    expect((await post(`/fault-cases/${r.caseId}/confirm-refund`, {})).status).toBe(400);
    expect((await confirmReplacement(r.caseId)).status).toBe(400);
    expect((await pool.query('SELECT count(*) AS n FROM orders WHERE replacement_of = $1', [r.orderId])).rows[0].n).toBe('1'); // no second order from the repeat

    const other = await createFlagged();
    await openCase(other.shipment.id);
    const otherCase = (await caseOf(other.shipment.id)).id;
    await supplierAnswers(otherCase, true);
    expect((await post(`/fault-cases/${otherCase}/confirm-refund`, {})).status).toBe(200);
    const refused = await confirmReplacement(otherCase);
    expect(refused.status).toBe(400);
    expect((await pool.query('SELECT 1 FROM orders WHERE id = $1', [`${other.orderId}-R1`])).rows).toHaveLength(0);

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=fault_case_replacement_confirmed`, { headers: auth(await adminToken()) }).then((x) => x.json());
    const entries = (Array.isArray(log) ? log : log.entries).filter((e) => e.targetId === String(r.caseId));
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries)).toContain(r.replacementOrderId);
  }, 90000);

  it('hub staff see a neutral stage and no money; the supplier sees the replacement order to ship, and another supplier sees nothing', async () => {
    const r = await withReplacement();
    const hubFault = (await fetch(`${BACKEND_URL}/hub/me/shipments/${r.shipment.id}`, { headers: auth(await hubToken()) }).then((x) => x.json())).faultCase;
    expect(hubFault.platformStage).toBe('finalising');
    expect(JSON.stringify(hubFault)).not.toMatch(/refund|costBearer|cost_bearer|amount/i);

    const mine = (await fetch(`${BACKEND_URL}/fault-cases/supplier/me`, { headers: auth(await supplierToken()) }).then((x) => x.json())).find((c) => c.orderId === r.orderId);
    expect(mine.replacementOrderId).toBe(r.replacementOrderId);
    expect(JSON.stringify(mine)).not.toMatch(/costBearer|cost_bearer|refund/i);
    const others = await fetch(`${BACKEND_URL}/fault-cases/supplier/me`, { headers: auth(await otherSupplierToken()) }).then((x) => x.json());
    expect(others.some((c) => c.orderId === r.orderId)).toBe(false);
  }, 60000);
});
