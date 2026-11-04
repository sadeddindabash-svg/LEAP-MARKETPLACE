/**
 * Test helper: takes a sub-order that the SUPPLIER has already shipped (to the inspection hub) through the hub's steps to "shipped to the buyer".
 *
 * WHY: the buyer-facing "shipped" status, and the point after which an order can no longer be cancelled, are decided by the HUB shipping the parcel
 * to the buyer, not by the supplier sending it to the hub (that leg is internal). Older tests treated "the supplier shipped it" as "shipped".
 */
const BACKEND_URL = 'http://localhost:4000';

export async function hubShipsToBuyer(subOrderId, { login }) {
  const { token } = await login('hub@leap.dev', 'hub_dev_password_123');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const shipments = await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers }).then((r) => r.json());
  const shipment = shipments.find((s) => s.subOrderId === subOrderId);
  if (!shipment) throw new Error(`The hub has no shipment for sub-order ${subOrderId}: did the supplier ship it, and is it assigned to the Guangzhou hub?`);
  for (const step of ['received', 'opened', 'inspected', 'packed', 'shipped_to_buyer']) {
    if (step === 'inspected') await passInspection(shipment.id, { login, hubToken: token });      // the inspection list (migration 129)
    if (step === 'shipped_to_buyer') await clearParcelCost(shipment.id, { login, hubToken: token });      // the Shipping cost step (migration 127)
    const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers,
      body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...(step === 'shipped_to_buyer' ? { trackingNumber: `HUB-TEST-${subOrderId}` } : {}), ...(step === 'packed' ? { supplierLabelCovered: true } : {}) }),
    });
    if (res.status !== 201) throw new Error(`Hub step "${step}" failed (${res.status}): ${JSON.stringify(await res.json())}`);
  }
  return shipment.id;
}

/**
 * Test helper: the Shipping cost step (migration 127) for a PACKED parcel, so it may then be shipped to the buyer. The hub enters a cost; if the
 * parcel comes out dearer than planned (or the planned cost cannot be worked out), the hub adds a parcel photo and an admin approves it.
 * Call it before posting the "shipped_to_buyer" step in a test that ships a parcel itself.
 */
/**
 * Test helper: the inspection list (migration 129) for an OPENED shipment, so it may then be marked inspected: every line of every item ticked,
 * and each item's received quantity entered (equal to the order). Call it before posting the "inspected" step in a test that does it itself.
 */
export async function passInspection(shipmentId, { login, hubToken }) {
  const token = hubToken || (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const detail = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}`, { headers }).then((r) => r.json());
  for (const item of detail.items || []) {
    for (const [method, part, body] of [['PUT', 'checks', { checked: (item.checklist || []).map((c) => c.key) }], ['PATCH', 'received', { receivedQuantity: item.quantity }]]) {
      const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipmentId}/items/${encodeURIComponent(item.productId)}/${part}`, { method, headers, body: JSON.stringify(body) });
      if (res.status !== 200) throw new Error(`Inspection list (${part}) failed (${res.status}): ${JSON.stringify(await res.json())}`);
    }
  }
}

export async function clearParcelCost(shipmentId, { login, hubToken }) {
  const token = hubToken || (await login('hub@leap.dev', 'hub_dev_password_123')).token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const post = async (body) => {
    const res = await fetch(`${BACKEND_URL}/parcel-costs/hub/${shipmentId}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.status !== 201 && data.code !== 'already_recorded') throw new Error(`Shipping cost failed (${res.status}): ${JSON.stringify(data)}`);
    return data;
  };
  let state = await post({ amount: 0.01, currency: 'USD', carrier: 'Test carrier' });
  if (state.state === 'needs_photo') state = await post({ parcelPhoto: '/uploads/test.jpg' });
  if (state.mayShip || state.code === 'already_recorded') return;
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const report = await fetch(`${BACKEND_URL}/parcel-costs?period=year`, { headers: adminHeaders }).then((r) => r.json());
  const waiting = (report.waiting || []).find((w) => w.shipmentId === shipmentId);
  if (!waiting) throw new Error(`The parcel ${shipmentId} is not waiting for approval: ${JSON.stringify(state)}`);
  const res = await fetch(`${BACKEND_URL}/parcel-costs/${waiting.id}/approve`, { method: 'POST', headers: adminHeaders, body: '{}' });
  if (res.status !== 200) throw new Error(`Approving the shipping cost failed (${res.status}): ${JSON.stringify(await res.json())}`);
}
