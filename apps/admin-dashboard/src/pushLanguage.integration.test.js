// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const BACKEND_URL = 'http://localhost:4000';
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
process.env.DATABASE_URL = TEST_DB_URL; // the backend's own database pool, loaded below, reads this
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'fake-project' }); // makes push "configured"; Firebase itself is faked below

const require = createRequire(import.meta.url);
const Module = require('module');

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

// A stand-in for the real Firebase, recording every push that WOULD have been sent.
const sent = [];
const fakeFirebase = { initializeApp: () => ({}), credential: { cert: () => ({}) }, messaging: () => ({ send: async (message) => { sent.push(message); } }) };
const realLoad = Module._load;

let push;
let messages;
let pool;

beforeAll(() => {
  if (!backendUp) return;
  Module._load = function patched(request, ...rest) {
    if (request === 'firebase-admin') return fakeFirebase;
    return realLoad.call(this, request, ...rest);
  };
  push = require('../../../services/api/src/modules/push/client.js');
  messages = require('../../../services/api/src/modules/notifications/messages.js');
  pool = require('../../../services/api/db/pool.js').getPool();
});
afterAll(async () => {
  Module._load = realLoad;
  if (pool) await pool.end();
});

async function newBuyerWithDevice() {
  const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `push-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  const reg = await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ token: `fake-device-${uniq()}`, platform: 'android' }) });
  expect(reg.status).toBe(204);
  return { userId: buyer.user.id, token: buyer.token };
}
const appSays = (buyer, lang) => fetch(`${BACKEND_URL}/notifications/me?lang=${lang}`, { headers: auth(buyer.token) });
async function pushShipped(userId) {
  sent.length = 0;
  await push.sendPushToUser({ userId, type: 'order_status', ...messages.orderShipped('LP-4242', 'HUB-1'), linkType: 'order', linkId: 'LP-4242' });
  return sent[0];
}

describe.runIf(backendUp)('push notifications are sent in the language the user\'s app last reported (fake Firebase, real database)', () => {
  it('CRITICAL: an Arabic user gets an Arabic push; switching the app back to English switches the push too', async () => {
    const buyer = await newBuyerWithDevice();
    await appSays(buyer, 'ar');
    const arabic = await pushShipped(buyer.userId);
    expect(arabic.notification.title).toBe('تم شحن طلبك');
    expect(arabic.notification.body).toBe('طلبك LP-4242 في طريقه إليك. رقم التتبع: HUB-1');
    expect(arabic.data).toEqual({ linkType: 'order', linkId: 'LP-4242' }); // where tapping it goes is unchanged

    await appSays(buyer, 'en');
    const english = await pushShipped(buyer.userId);
    expect(english.notification.title).toBe('Your order has shipped');
    expect(english.notification.body).toBe('Order LP-4242 is on its way to you. Tracking number: HUB-1');
  }, 40000);

  it('CRITICAL: registering a device stores it for THAT user, and unregistering (logout) really removes it so the phone stops receiving that user\'s pushes', async () => {
    const buyer = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email: `push-reg-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
    const token = `reg-device-${uniq()}`;
    const countFor = async () => Number((await pool.query('SELECT count(*) FROM device_tokens WHERE user_id = $1 AND token = $2', [buyer.user.id, token])).rows[0].count);

    expect((await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ token, platform: 'android' }) })).status).toBe(204);
    expect(await countFor()).toBe(1);
    // registering the same device again does not duplicate it
    await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ token, platform: 'android' }) });
    expect(await countFor()).toBe(1);

    expect((await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'DELETE', headers: auth(buyer.token), body: JSON.stringify({ token }) })).status).toBe(204);
    expect(await countFor()).toBe(0);
    // a bad request is refused, not a server error
    expect((await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ token, platform: 'toaster' }) })).status).toBe(400);
  }, 40000);

  it('a user whose app has never reported a language gets English', async () => {
    const buyer = await newBuyerWithDevice();
    const push1 = await pushShipped(buyer.userId);
    expect(push1.notification.title).toBe('Your order has shipped');
  }, 40000);

  it('a notification with no Arabic text (e.g. one for a supplier) is sent in English even to an Arabic user', async () => {
    const buyer = await newBuyerWithDevice();
    await appSays(buyer, 'ar');
    sent.length = 0;
    await push.sendPushToUser({ userId: buyer.userId, type: 'low_stock', title: 'Low stock alert', body: 'Brake Disc is low.', linkType: 'product', linkId: 'p1' });
    expect(sent[0].notification.title).toBe('Low stock alert');
    expect(sent[0].notification.body).toBe('Brake Disc is low.');
  }, 40000);

  it('with several devices registered, every one gets the push, in the same language', async () => {
    const buyer = await newBuyerWithDevice();
    await fetch(`${BACKEND_URL}/notifications/register-device`, { method: 'POST', headers: auth(buyer.token), body: JSON.stringify({ token: `second-device-${uniq()}`, platform: 'ios' }) });
    await appSays(buyer, 'ar');
    sent.length = 0;
    await push.sendPushToUser({ userId: buyer.userId, type: 'order_status', ...messages.orderDelivered('LP-1'), linkType: 'order', linkId: 'LP-1' });
    expect(sent).toHaveLength(2);
    for (const m of sent) expect(m.notification.title).toBe('تم تسليم طلبك');
  }, 40000);
});
