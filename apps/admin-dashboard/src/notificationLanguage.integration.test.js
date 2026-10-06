import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';
// Direct DB access for setup/inspection only (reading the remembered language, planting an old notification), same approach as payouts.integration.test.js.
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
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ARABIC = /[\u0600-\u06FF]/;
const adminToken = async () => (await login('admin@leap.dev', 'admin_dev_password_123')).token;
const supplierToken = async () => (await login('supplier@leap.dev', 'supplier_dev_password_123')).token;
const hubToken = async () => (await login('hub@leap.dev', 'hub_dev_password_123')).token;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

// A buyer's order for p1, sent to the Guangzhou hub. `ship` is the SUPPLIER shipping to the hub (the buyer's first notification).
async function createOrder() {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `nl-buyer-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const order = await fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId: buyer.user.id, address: TEST_ADDRESS }) }).then((r) => r.json());
  const subOrderId = order.supplierSubOrders[0].subOrderId;
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ hubId: 'hub_guangzhou' }) });
  const hub = await hubToken();
  const ship = () => fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, { method: 'PATCH', headers: auth(supplierTokenCache), body: JSON.stringify({ status: 'shipped' }) });
  const hubShipment = async () => (await fetch(`${BACKEND_URL}/hub/me/shipments`, { headers: auth(hub) }).then((r) => r.json())).find((s) => s.subOrderId === subOrderId);
  const record = async (step, extra = {}) => {
    const shipment = await hubShipment();
    return fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/events`, { method: 'POST', headers: auth(hub), body: JSON.stringify({ step, photos: ['/uploads/test.jpg'], ...extra }) });
  };
  return { orderId: order.id, buyerId: buyer.user.id, buyerToken: buyer.token, subOrderId, ship, record, hub, hubShipment };
}
let supplierTokenCache = null;

const notificationsOf = (token, lang) => fetch(`${BACKEND_URL}/notifications/me${lang ? `?lang=${lang}` : ''}`, { headers: auth(token) }).then((r) => r.json());
const find = (list, title, orderId) => list.find((n) => n.title === title && (!orderId || n.linkId === orderId));
const languageOf = async (userId) => (await pool.query('SELECT language FROM users WHERE id = $1', [userId])).rows[0].language;

describe.runIf(backendUp)('notifications arrive in the language the app asks for (real backend)', () => {
  it('CRITICAL: a buyer\'s order journey -- supplier ships, hub ships, delivered -- reads in Arabic when the app is Arabic and in English otherwise', async () => {
    supplierTokenCache = await supplierToken();
    const o = await createOrder();
    expect((await o.ship()).status).toBe(200);
    for (const step of ['received', 'opened', 'inspected', 'packed']) expect((await o.record(step)).status).toBe(201);
    const trackingNumber = `HUB-NL-${uniq()}`;
    expect((await o.record('shipped_to_buyer', { trackingNumber })).status).toBe(201);
    const shipment = await o.hubShipment();
    expect((await fetch(`${BACKEND_URL}/hub/me/shipments/${shipment.id}/confirm-delivery`, { method: 'PATCH', headers: auth(o.hub), body: JSON.stringify({ deliveryNote: 'Left with the doorman' }) })).status).toBe(200);

    const en = await notificationsOf(o.buyerToken);
    const ar = await notificationsOf(o.buyerToken, 'ar');
    expect(ar).toHaveLength(en.length); // the same notifications, only the words differ
    expect(ar.map((n) => n.id)).toEqual(en.map((n) => n.id));

    // 1. the SUPPLIER sent it to our inspection hub
    expect(find(en, 'Your order is on its way to our inspection hub', o.orderId)).toBeTruthy();
    expect(find(ar, 'طلبك في طريقه إلى مركز الفحص لدينا', o.orderId).body).toContain(o.orderId);
    // 2. the HUB shipped it, with the hub's tracking number
    expect(find(en, 'Your order has shipped', o.orderId).body).toBe(`Order ${o.orderId} is on its way to you. Tracking number: ${trackingNumber}`);
    expect(find(ar, 'تم شحن طلبك', o.orderId).body).toBe(`طلبك ${o.orderId} في طريقه إليك. رقم التتبع: ${trackingNumber}`);
    // 3. delivered
    expect(find(en, 'Your order has been delivered', o.orderId).body).toBe(`Order ${o.orderId} is now delivered.`);
    expect(find(ar, 'تم تسليم طلبك', o.orderId).body).toBe(`تم تسليم الطلب ${o.orderId}.`);

    // no English leaks into the Arabic list, and no Arabic into the English list
    for (const n of en) expect(n.title + n.body).not.toMatch(ARABIC);
    for (const n of ar) expect(n.title).toMatch(ARABIC);
  }, 60000);

  it('no language, or one we do not support, gives English; an old notification with no Arabic text still shows in Arabic mode, in English', async () => {
    supplierTokenCache = await supplierToken();
    const o = await createOrder();
    await o.ship();
    for (const lang of [undefined, 'en', 'fr', 'AR', '']) {
      const list = await notificationsOf(o.buyerToken, lang);
      expect(find(list, 'Your order is on its way to our inspection hub', o.orderId), `lang=${lang}`).toBeTruthy();
    }
    // a notification stored before Arabic existed: English only
    await pool.query(`INSERT INTO notifications (user_id, type, title, body) VALUES ($1, 'order_status', 'An old English-only notice', 'Written before Arabic existed.')`, [o.buyerId]);
    const ar = await notificationsOf(o.buyerToken, 'ar');
    expect(ar.find((n) => n.title === 'An old English-only notice').body).toBe('Written before Arabic existed.');
  }, 40000);

  it('CRITICAL: the app\'s language is remembered (for push), only from a clear "ar" or "en", and per user', async () => {
    const make = async () => (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `nl-lang-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json()));
    const a = await make();
    const b = await make();
    expect(await languageOf(a.user.id)).toBe('en'); // the default

    await notificationsOf(a.token, 'ar');
    expect(await languageOf(a.user.id)).toBe('ar');
    expect(await languageOf(b.user.id)).toBe('en'); // another user is unaffected

    await notificationsOf(a.token, 'fr');                 // unsupported: ignored
    await notificationsOf(a.token);                       // no language: ignored
    await notificationsOf(a.token, 'AR');                 // wrong case: ignored (and answered in English)
    expect(await languageOf(a.user.id)).toBe('ar');

    // the unread-count poll keeps it current too
    await fetch(`${BACKEND_URL}/notifications/me/unread-count?lang=en`, { headers: auth(a.token) });
    expect(await languageOf(a.user.id)).toBe('en');
  }, 40000);

  it('CRITICAL: a return case moving to a new status tells the buyer the status in Arabic using the app\'s own words', async () => {
    supplierTokenCache = await supplierToken();
    const o = await createOrder();
    await o.ship();
    await o.record('received');
    expect((await o.record('flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);
    const entry = (await fetch(`${BACKEND_URL}/hub/flagged`, { headers: auth(await adminToken()) }).then((r) => r.json())).find((q) => q.orderId === o.orderId);
    expect(entry.returnCaseId).toBeTruthy();

    expect((await fetch(`${BACKEND_URL}/returns/${entry.returnCaseId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ status: 'approved' }) })).status).toBe(200);
    const en = (await notificationsOf(o.buyerToken)).find((n) => n.body === `Return ${entry.returnCaseId} is now approved.`);
    expect(en.title).toBe('Your return request was updated');
    const ar = (await notificationsOf(o.buyerToken, 'ar')).find((n) => n.id === en.id);
    expect(ar.title).toBe('تم تحديث طلب الإرجاع الخاص بك');
    expect(ar.body).toBe(`أصبحت حالة الإرجاع ${entry.returnCaseId}: موافق عليه.`);

    // "no fault": the hub's mistake is cleared, the case is rejected, the buyer is told in their language
    expect((await fetch(`${BACKEND_URL}/returns/${entry.returnCaseId}`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ status: 'in_progress' }) })).status).toBe(200);
    const resolved = await fetch(`${BACKEND_URL}/hub/flagged/${entry.id}/resolve`, { method: 'PATCH', headers: auth(await adminToken()), body: JSON.stringify({ resolution: 'continue_processing' }) });
    expect(resolved.status).toBe(200);
    const after = await notificationsOf(o.buyerToken, 'ar');
    expect(after.some((n) => n.body === `أصبحت حالة الإرجاع ${entry.returnCaseId}: مرفوض.`)).toBe(true);
    expect((await notificationsOf(o.buyerToken)).some((n) => n.body === `Return ${entry.returnCaseId} is now rejected.`)).toBe(true);
  }, 60000);

  it('a support reply: the title is translated, the admin\'s own words are passed through unchanged', async () => {
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `nl-ticket-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    const ticket = await fetch(`${BACKEND_URL}/support/tickets`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ subject: 'Late parcel', message: 'Where is my order?' }) }).then((r) => r.json());
    const reply = await fetch(`${BACKEND_URL}/support/tickets/${ticket.id}/messages`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ message: 'We are on it.' }) });
    expect(reply.status).toBe(201);
    const en = (await notificationsOf(buyer.token)).find((n) => n.type === 'ticket_reply');
    const ar = (await notificationsOf(buyer.token, 'ar')).find((n) => n.type === 'ticket_reply');
    expect(en.title).toBe('New reply on your support ticket');
    expect(ar.title).toBe('رد جديد على تذكرة الدعم الخاصة بك');
    expect(en.body).toBe('"Late parcel": We are on it.');
    expect(ar.body).toBe('"Late parcel": We are on it.');
  }, 40000);

  it('marking a notification read answers in the language asked for', async () => {
    supplierTokenCache = await supplierToken();
    const o = await createOrder();
    await o.ship();
    const target = find(await notificationsOf(o.buyerToken), 'Your order is on its way to our inspection hub', o.orderId);
    const arRes = await fetch(`${BACKEND_URL}/notifications/me/${target.id}/read?lang=ar`, { method: 'PATCH', headers: auth(o.buyerToken) }).then((r) => r.json());
    expect(arRes.title).toBe('طلبك في طريقه إلى مركز الفحص لدينا');
    expect(arRes.isRead).toBe(true);
    const enRes = await fetch(`${BACKEND_URL}/notifications/me/${target.id}/read`, { method: 'PATCH', headers: auth(o.buyerToken) }).then((r) => r.json());
    expect(enRes.title).toBe('Your order is on its way to our inspection hub');
  }, 40000);

  it('CRITICAL: a fault case tells the buyer in one language per notification (not both mixed), while the supplier\'s notice stays English', async () => {
    supplierTokenCache = await supplierToken();
    const o = await createOrder();
    await o.ship();
    await o.record('received');
    expect((await o.record('flagged', { notes: 'Cracked', damageType: 'physical_damage' })).status).toBe(201);
    const shipment = await o.hubShipment();
    expect((await fetch(`${BACKEND_URL}/fault-cases`, { method: 'POST', headers: auth(await adminToken()), body: JSON.stringify({ shipmentId: shipment.id, items: ['p1'], costBearer: 'supplier' }) })).status).toBe(201);

    const en = (await notificationsOf(o.buyerToken)).filter((n) => n.type === 'return_status');
    const ar = (await notificationsOf(o.buyerToken, 'ar')).filter((n) => n.type === 'return_status');
    expect(en.length).toBeGreaterThan(0);
    for (const n of en) expect(n.title + n.body).not.toMatch(ARABIC);
    for (const n of ar) { expect(n.title).toMatch(ARABIC); expect(n.body).toMatch(ARABIC); expect(n.body).not.toContain('Our inspection'); }

    // the SUPPLIER's notice has no Arabic text (the supplier portal is Chinese / English), so it is English even if Arabic is asked for
    const supplierNote = (await notificationsOf(supplierTokenCache, 'ar')).find((n) => n.type === 'supplier_message' && n.linkId === o.orderId);
    expect(supplierNote.title).toBe(`Can you replace? Order ${o.orderId}`);
    expect(supplierNote.title + supplierNote.body).not.toMatch(ARABIC);
  }, 60000);
});
