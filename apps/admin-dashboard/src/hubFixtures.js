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
    const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, {
      method: 'POST', headers,
      body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...(step === 'shipped_to_buyer' ? { trackingNumber: `HUB-TEST-${subOrderId}` } : {}) }),
    });
    if (res.status !== 201) throw new Error(`Hub step "${step}" failed (${res.status}): ${JSON.stringify(await res.json())}`);
  }
  return shipment.id;
}
