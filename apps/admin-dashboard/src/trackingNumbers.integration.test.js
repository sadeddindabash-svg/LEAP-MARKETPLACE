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

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;

// Order p1 -> routed to the Guangzhou hub -> the SUPPLIER ships it (with its own domestic tracking number) -> the hub
// receives it. Returns what each later step needs.
async function createOrderAtHub({ guest = false } = {}) {
  const supplierNumber = `SUP-DOM-${uniq()}`;
  let buyerToken = null;
  let orderBody = { items: [{ productId: 'p1', quantity: 1 }], address: TEST_ADDRESS };
  let guestEmail = null;
  if (guest) {
    guestEmail = `track-guest-${uniq()}@example.com`;
    orderBody = { ...orderBody, guestEmail };
  } else {
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `track-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    buyerToken = buyer.token;
    orderBody = { ...orderBody, userId: buyer.user.id };
  }
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify(orderBody) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  const shipped = await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped', trackingNumber: supplierNumber }) });
  expect(shipped.status).toBe(200);

  const hub = await hubToken();
  const shipment = (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const record = (step, extra = {}) => fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  return { orderId: order.id, subOrderId, shipmentId: shipment.id, supplierNumber, buyerToken, guestEmail, record };
}

const viewAsBuyer = (o) => fetch(`${BACKEND_URL}/order/${o.orderId}${o.guestEmail ? `?guestEmail=${encodeURIComponent(o.guestEmail)}` : ''}`, { headers: o.buyerToken ? auth(o.buyerToken) : json }).then((r) => r.json());
const viewAsAdmin = async (o) => fetch(`${BACKEND_URL}/order/${o.orderId}`, { headers: auth(await adminToken()) }).then((r) => r.json());
const notificationsOf = (token) => fetch(`${BACKEND_URL}/notifications/me`, { headers: auth(token) }).then((r) => r.json());
const walkToPacked = async (o) => { for (const step of ['received', 'opened', 'inspected', 'packed']) expect((await o.record(step)).status).toBe(201); };

describe.runIf(backendUp)('tracking numbers: the buyer sees the hub\'s, never the supplier\'s (real backend)', () => {
  it('CRITICAL: before the hub ships, the buyer has NO tracking number and never sees the supplier\'s; admin sees the supplier\'s, labelled apart', async () => {
    const o = await createOrderAtHub();
    await walkToPacked(o);

    const buyer = await viewAsBuyer(o);
    expect(buyer.supplierSubOrders[0].trackingNumber).toBeNull();
    expect(buyer.supplierSubOrders[0].hubTrackingNumber).toBeNull();
    expect(JSON.stringify(buyer)).not.toContain(o.supplierNumber);

    const admin = await viewAsAdmin(o);
    expect(admin.supplierSubOrders[0].trackingNumber).toBe(o.supplierNumber); // supplier -> hub
    expect(admin.supplierSubOrders[0].hubTrackingNumber).toBeNull();          // hub -> buyer: not yet
  }, 40000);

  it('CRITICAL: once the hub ships it, the buyer sees the HUB\'s number (still never the supplier\'s) and admin sees both', async () => {
    const o = await createOrderAtHub();
    await walkToPacked(o);
    const hubNumber = `HUB-INTL-${uniq()}`;
    expect((await o.record('shipped_to_buyer', { trackingNumber: hubNumber })).status).toBe(201);

    const buyer = await viewAsBuyer(o);
    expect(buyer.supplierSubOrders[0].trackingNumber).toBe(hubNumber);
    expect(buyer.supplierSubOrders[0].hubTrackingNumber).toBe(hubNumber);
    expect(JSON.stringify(buyer)).not.toContain(o.supplierNumber);

    const admin = await viewAsAdmin(o);
    expect(admin.supplierSubOrders[0].trackingNumber).toBe(o.supplierNumber);
    expect(admin.supplierSubOrders[0].hubTrackingNumber).toBe(hubNumber);
  }, 40000);

  it('a guest buyer gets the same treatment', async () => {
    const o = await createOrderAtHub({ guest: true });
    await walkToPacked(o);
    expect((await viewAsBuyer(o)).supplierSubOrders[0].trackingNumber).toBeNull();
    const hubNumber = `HUB-GUEST-${uniq()}`;
    await o.record('shipped_to_buyer', { trackingNumber: hubNumber });
    const guestView = await viewAsBuyer(o);
    expect(guestView.supplierSubOrders[0].trackingNumber).toBe(hubNumber);
    expect(JSON.stringify(guestView)).not.toContain(o.supplierNumber);
  }, 40000);

  it('CRITICAL: the buyer is NOT told "shipped" when the SUPPLIER ships to the hub; they are told when the HUB ships, with the hub\'s number', async () => {
    const o = await createOrderAtHub();
    const afterSupplier = await notificationsOf(o.buyerToken);
    expect(afterSupplier.some((n) => n.title === 'Your order has shipped')).toBe(false);
    const onItsWay = afterSupplier.find((n) => n.title === 'Your order is on its way to our inspection hub');
    expect(onItsWay).toBeTruthy();
    expect(onItsWay.body).not.toContain(o.supplierNumber); // the supplier's number is not in any message

    await walkToPacked(o);
    const hubNumber = `HUB-NOTE-${uniq()}`;
    await o.record('shipped_to_buyer', { trackingNumber: hubNumber });
    const shipped = (await notificationsOf(o.buyerToken)).filter((n) => n.title === 'Your order has shipped');
    expect(shipped).toHaveLength(1);
    expect(shipped[0].body).toContain(hubNumber);
    expect(shipped[0].body).not.toContain(o.supplierNumber);
  }, 40000);

  it('the return tracking number and the return step are internal: admin sees them, the buyer does not', async () => {
    const o = await createOrderAtHub();
    await o.record('received');
    expect((await o.record('flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);

    const queue = await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json());
    expect((await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ shipmentId: o.shipmentId, items: ['p1'], costBearer: 'supplier' }) })).status).toBe(201);
    expect(queue.some((q) => q.id === o.shipmentId)).toBe(true);

    const returnNumber = `RET-INTERNAL-${uniq()}`;
    expect((await o.record('returned_to_supplier', { trackingNumber: returnNumber, notes: 'Collected by the supplier courier' })).status).toBe(201);

    const buyer = await viewAsBuyer(o);
    const buyerSteps = buyer.supplierSubOrders[0].hubShipment.events.map((e) => e.step);
    expect(buyerSteps).not.toContain('returned_to_supplier');
    expect(JSON.stringify(buyer)).not.toContain(returnNumber);
    expect(JSON.stringify(buyer)).not.toContain('Collected by the supplier courier');

    const admin = await viewAsAdmin(o);
    const returned = admin.supplierSubOrders[0].hubShipment.events.find((e) => e.step === 'returned_to_supplier');
    expect(returned).toMatchObject({ trackingNumber: returnNumber });
  }, 50000);
});
