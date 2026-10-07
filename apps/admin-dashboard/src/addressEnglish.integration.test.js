import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup only (planting an address from before migration 094), same approach as payouts.integration.test.js.
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

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ARABIC = /[\u0600-\u06FF]/;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

const ARABIC_ADDRESS = { recipientName: 'محمد العتيبي', phone: '0551234567', country: 'السعودية', city: 'الرياض', streetAddress: 'شارع الملك فهد، حي العليا، مبنى رقم ١٢٣', state: 'منطقة الرياض' };
const ENGLISH_ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

// A buyer's order for p1, routed to the Guangzhou hub, shipped by the supplier (so the hub has a shipment to look at).
async function createOrder({ address, guest = false } = {}) {
  let body = { items: [{ productId: 'p1', quantity: 1 }] };
  let buyer = null;
  let guestEmail = null;
  if (guest) {
    guestEmail = `addr-guest-${uniq()}@example.com`;
    body = { ...body, guestEmail, ...(address ? { address } : {}) };
  } else {
    buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `addr-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    body = { ...body, userId: buyer.user.id, address };
  }
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify(body) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(await supplierToken()), body: JSON.stringify({ status: 'shipped' }) });
  return { orderId: order.id, subOrderId, buyerToken: buyer?.token, guestEmail };
}
const hubShipmentOf = async (o) => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(await hubToken()) }).then((r) => r.json())).find((s) => s.subOrderId === o.subOrderId);
const hubSees = async (o) => {
  const shipment = await hubShipmentOf(o);
  return (await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}`, { headers: auth(await hubToken()) }).then((r) => r.json())).deliveryAddress;
};
const orderAs = (token, orderId, query = '') => fetch(`${BACKEND_URL}/order/${orderId}${query}`, { headers: token ? auth(token) : json }).then((r) => r.json());
const putAdmin = async (orderId, body, token) => fetch(`${BACKEND_URL}/order/${orderId}/address-english`, { method: 'PUT', headers: auth(token || (await adminToken())), body: JSON.stringify(body) });
const confirmAs = (token, orderId, body = {}) => fetch(`${BACKEND_URL}/order/${orderId}/address-english/confirm`, { method: 'PUT', headers: token ? auth(token) : json, body: JSON.stringify(body) });

const CORRECTED = { recipientName: 'Mohammad Al-Otaibi', country: 'Saudi Arabia', city: 'Riyadh', streetAddress: 'King Fahd Road, Olaya, Building 123', state: 'Riyadh Region' };

describe.runIf(backendUp)('the inspection hub reads the delivery address in English (real backend)', () => {
  it('CRITICAL: an Arabic address is shown to the hub in English; the buyer\'s original is untouched; the English one is marked "auto" until someone confirms it', async () => {
    const o = await createOrder({ address: ARABIC_ADDRESS });

    const hub = await hubSees(o);
    expect(hub).toMatchObject({
      recipientName: 'Mohammed Al-Otaibi', country: 'Saudi Arabia', city: 'Riyadh',
      streetAddress: 'King Fahad Street, Al-Olaya District, Building No. 123',
      phone: '0551234567', // digits are not translated
    });
    for (const value of Object.values(hub)) expect(String(value ?? '')).not.toMatch(ARABIC); // not one Arabic letter reaches the hub

    const buyerView = await orderAs(o.buyerToken, o.orderId);
    expect(buyerView.address).toMatchObject({ recipientName: 'محمد العتيبي', city: 'الرياض' }); // the original is exactly what the buyer typed
    expect(buyerView.addressEnglish).toMatchObject({ recipientName: 'Mohammed Al-Otaibi', city: 'Riyadh', source: 'auto', confirmed: false });

    const adminView = await orderAs(await adminToken(), o.orderId);
    expect(adminView.address.streetAddress).toBe(ARABIC_ADDRESS.streetAddress);
    expect(adminView.addressEnglish.streetAddress).toBe('King Fahad Street, Al-Olaya District, Building No. 123');
  }, 60000);

  it('an address already in English is left exactly as it is (source "same", nothing to confirm)', async () => {
    const o = await createOrder({ address: ENGLISH_ADDRESS });
    const hub = await hubSees(o);
    expect(hub).toMatchObject({ recipientName: 'John Smith', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' });
    const view = await orderAs(o.buyerToken, o.orderId);
    expect(view.addressEnglish).toMatchObject({ source: 'same', streetAddress: '123 Test St' });
  }, 40000);

  it('the printable address label is produced for an Arabic order (from the English address, never the Arabic original)', async () => {
    const o = await createOrder({ address: ARABIC_ADDRESS });
    const shipment = await hubShipmentOf(o);
    const res = await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/address-label`, { headers: auth(await hubToken()) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(1000);
  }, 40000);

  it('CRITICAL: an admin can correct the English version; the hub then sees the correction; the original is untouched; it is audit-logged without copying the address', async () => {
    const o = await createOrder({ address: ARABIC_ADDRESS });
    const res = await putAdmin(o.orderId, CORRECTED);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...CORRECTED, source: 'admin', confirmed: true });

    expect(await hubSees(o)).toMatchObject({ recipientName: 'Mohammad Al-Otaibi', streetAddress: 'King Fahd Road, Olaya, Building 123', state: 'Riyadh Region' });
    expect((await orderAs(await adminToken(), o.orderId)).address.recipientName).toBe('محمد العتيبي');

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=order_address_english_updated`, { headers: auth(await adminToken()) }).then((r) => r.json());
    const entries = (Array.isArray(log) ? log : log.entries).filter((e) => e.targetId === o.orderId);
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries)).not.toContain('King Fahd');
  }, 60000);

  it('the English correction must really be English, complete and a sensible size', async () => {
    const o = await createOrder({ address: ARABIC_ADDRESS });
    for (const bad of [
      { ...CORRECTED, city: 'الرياض' },           // Arabic: back to an address the hub cannot read
      { ...CORRECTED, streetAddress: 'شارع 5' },
      { ...CORRECTED, recipientName: '' },
      { ...CORRECTED, country: '   ' },
      {}, { ...CORRECTED, streetAddress: 'x'.repeat(201) },
    ]) expect((await putAdmin(o.orderId, bad)).status).toBe(400);
    // nothing was changed by the refusals
    expect((await hubSees(o)).city).toBe('Riyadh');
  }, 40000);

  it('only an admin with access to the Orders page can correct it; an order with no address, or no such order, is a 404', async () => {
    const o = await createOrder({ address: ARABIC_ADDRESS });
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `addr-roles-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    for (const token of [buyer.token, await hubToken(), await supplierToken(), o.buyerToken]) expect((await putAdmin(o.orderId, CORRECTED, token)).status).toBe(403);
    expect((await fetch(`${BACKEND_URL}/order/${o.orderId}/address-english`, { method: 'PUT', headers: json, body: JSON.stringify(CORRECTED) })).status).toBe(401);

    const limitedEmail = `addr-limited-${uniq()}@example.com`;
    await fetch(`${BACKEND_URL}/admin-users`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ email: limitedEmail, password: 'limited_pass_123', name: 'Limited', allowedPages: ['hubs'] }) });
    expect((await putAdmin(o.orderId, CORRECTED, (await login(limitedEmail, 'limited_pass_123')).token)).status).toBe(403);

    const noAddress = await createOrder({ guest: true }); // a guest who has not given an address yet
    expect((await putAdmin(noAddress.orderId, CORRECTED)).status).toBe(404);
    expect((await putAdmin('LP-NOPE', CORRECTED)).status).toBe(404);
  }, 60000);

  it('CRITICAL: the buyer can confirm the automatic English version as it is, or correct it; either way it is marked as the buyer\'s, and the hub sees it', async () => {
    const asIs = await createOrder({ address: ARABIC_ADDRESS });
    const confirmed = await confirmAs(asIs.buyerToken, asIs.orderId);
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ source: 'buyer', confirmed: true, city: 'Riyadh', recipientName: 'Mohammed Al-Otaibi' }); // the words are unchanged

    const edited = await createOrder({ address: ARABIC_ADDRESS });
    const corrected = await confirmAs(edited.buyerToken, edited.orderId, CORRECTED);
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toMatchObject({ ...CORRECTED, source: 'buyer', confirmed: true });
    expect(await hubSees(edited)).toMatchObject({ recipientName: 'Mohammad Al-Otaibi', streetAddress: 'King Fahd Road, Olaya, Building 123' });

    expect((await confirmAs(edited.buyerToken, edited.orderId, { ...CORRECTED, city: 'الرياض' })).status).toBe(400); // must be English
  }, 60000);

  it('only the buyer whose order it is can confirm; a guest needs the email the order was placed with', async () => {
    const mine = await createOrder({ address: ARABIC_ADDRESS });
    const other = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `addr-other-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    expect((await confirmAs(other.token, mine.orderId)).status).toBe(404);
    expect((await confirmAs(null, mine.orderId)).status).toBe(404);

    const guest = await createOrder({ guest: true, address: ARABIC_ADDRESS });
    expect((await confirmAs(null, guest.orderId, { guestEmail: 'wrong@example.com' })).status).toBe(404);
    expect((await confirmAs(null, guest.orderId, { guestEmail: guest.guestEmail })).status).toBe(200);
  }, 60000);

  it('CRITICAL: if the buyer REPLACES the address itself, the English version is worked out again from the new one (an old correction no longer applies)', async () => {
    const guest = await createOrder({ guest: true }); // no address yet
    const set = (address) => fetch(`${BACKEND_URL}/order/${guest.orderId}/address`, { method: 'PATCH', headers: json, body: JSON.stringify({ address, guestEmail: guest.guestEmail }) });
    expect((await set(ARABIC_ADDRESS)).status).toBe(200);
    expect((await orderAs(null, guest.orderId, `?guestEmail=${encodeURIComponent(guest.guestEmail)}`)).addressEnglish).toMatchObject({ city: 'Riyadh', source: 'auto' });

    expect((await putAdmin(guest.orderId, CORRECTED)).status).toBe(200); // admin corrects it

    expect((await set({ ...ARABIC_ADDRESS, city: 'جدة', streetAddress: 'شارع التحلية، حي الروضة' })).status).toBe(200);
    const after = (await orderAs(null, guest.orderId, `?guestEmail=${encodeURIComponent(guest.guestEmail)}`)).addressEnglish;
    expect(after).toMatchObject({ city: 'Jeddah', streetAddress: 'Al-Tahlia Street, Al-Rawda District', source: 'auto', confirmed: false });
  }, 60000);

  it('CRITICAL: an order from BEFORE this feature (an Arabic address with no English version stored) gets one the first time it is read', async () => {
    const o = await createOrder({ guest: true }); // no address row yet
    await pool.query(
      `INSERT INTO order_addresses (order_id, recipient_name, phone, country, city, street_address, source) VALUES ($1, $2, $3, $4, $5, $6, 'manual')`,
      [o.orderId, 'فاطمة الزهراني', '0509998888', 'الإمارات', 'دبي', 'شارع الشيخ زايد، برج الفطيم']
    ); // english_source stays NULL, exactly like a row written before migration 094
    expect((await pool.query('SELECT english_source FROM order_addresses WHERE order_id = $1', [o.orderId])).rows[0].english_source).toBeNull();

    const hub = await hubSees(o);
    expect(hub).toMatchObject({ recipientName: 'Fatima Al-Zahrani', country: 'United Arab Emirates', city: 'Dubai', streetAddress: 'Sheikh Zayed Street, Al-Futtaim Tower' });
    expect((await pool.query('SELECT english_source FROM order_addresses WHERE order_id = $1', [o.orderId])).rows[0].english_source).toBe('auto'); // and it was saved
  }, 60000);
});
