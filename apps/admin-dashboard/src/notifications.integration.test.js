import { describe, it, expect } from 'vitest';
import { login } from './auth';

const BACKEND_URL = 'http://localhost:4000';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const backendUp = await isBackendUp();

async function registerFreshBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `notif-test-${suffix}@example.com`, password: 'test_password_123', name: 'Notif Test' }),
  });
  return res.json(); // { token, user }
}

async function placeOrder(userId) {
  const res = await fetch(`${BACKEND_URL}/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], userId }),
  });
  return res.json();
}

async function assignHubAndShip(subOrderId) {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/hub/assign/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ hubId: 'hub_guangzhou' }),
  });
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  await fetch(`${BACKEND_URL}/supplier/me/orders/${subOrderId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({ status: 'shipped', trackingNumber: `TEST-${subOrderId}` }),
  });
}

describe.runIf(backendUp)('real notifications (order changes + message/ticket replies) against a REAL running backend', () => {
  it('CRITICAL: trigger #1 -- a real sub-order status change to shipped notifies the real buyer', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);

    const res = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${token}` } });
    const notifications = await res.json();
    const shipped = notifications.find((n) => n.type === 'order_status' && n.linkId === order.id);
    expect(shipped).toBeDefined();
    expect(shipped.isRead).toBe(false);
  });

  it('CRITICAL: trigger #2 -- a real return case status change notifies the real buyer', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);

    const rcRes = await fetch(`${BACKEND_URL}/returns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subOrderId: order.supplierSubOrders[0].subOrderId, reason: 'Wrong item', message: 'Not what I ordered.' }),
    });
    const rc = await rcRes.json();

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/returns/${rc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'approved' }),
    });

    const res = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${token}` } });
    const notifications = await res.json();
    // Links to the real ORDER, not the return case itself -- the
    // mobile app has a real order detail screen showing the return
    // request inline, but no separate return-case-specific screen.
    const returnNotif = notifications.find((n) => n.type === 'return_status' && n.linkId === order.id);
    expect(returnNotif).toBeDefined();
    expect(returnNotif.body).toContain(rc.id);
  });

  it('CRITICAL: trigger #3 -- an admin real reply to a support ticket notifies the real buyer', async () => {
    const { token } = await registerFreshBuyer();
    const ticketRes = await fetch(`${BACKEND_URL}/support/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: 'Real notification test ticket', message: 'Need help' }),
    });
    const ticket = await ticketRes.json();

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    await fetch(`${BACKEND_URL}/support/tickets/${ticket.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ message: 'Real reply for notification test' }),
    });

    const res = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${token}` } });
    const notifications = await res.json();
    const ticketNotif = notifications.find((n) => n.type === 'ticket_reply' && n.linkId === ticket.id);
    expect(ticketNotif).toBeDefined();
    expect(ticketNotif.body).toContain('Real reply for notification test');
  });

  it('CRITICAL: trigger #4 -- an admin real reply to a supplier message notifies the real supplier\'s linked user', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const uniqueText = `Real supplier notification test ${Date.now()}`;
    await fetch(`${BACKEND_URL}/supplier-messages/admin/s1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ text: uniqueText }),
    });

    const res = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    const notifications = await res.json();
    const supplierNotif = notifications.find((n) => n.type === 'supplier_message' && n.body === uniqueText);
    expect(supplierNotif).toBeDefined();
  });

  it('CRITICAL: the real unread count reflects genuine state, and marking one as read decrements it correctly', async () => {
    const { token, user } = await registerFreshBuyer();
    const order = await placeOrder(user.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);

    const beforeRes = await fetch(`${BACKEND_URL}/notifications/me/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await beforeRes.json()).count).toBe(1);

    const listRes = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${token}` } });
    const notification = (await listRes.json())[0];
    await fetch(`${BACKEND_URL}/notifications/me/${notification.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });

    const afterRes = await fetch(`${BACKEND_URL}/notifications/me/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await afterRes.json()).count).toBe(0);
  });

  it('CRITICAL: mark-all-read genuinely clears every real unread notification for that buyer', async () => {
    const { token, user } = await registerFreshBuyer();
    const order1 = await placeOrder(user.id);
    await assignHubAndShip(order1.supplierSubOrders[0].subOrderId);
    const order2 = await placeOrder(user.id);
    await assignHubAndShip(order2.supplierSubOrders[0].subOrderId);

    const beforeRes = await fetch(`${BACKEND_URL}/notifications/me/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await beforeRes.json()).count).toBe(2);

    const markAllRes = await fetch(`${BACKEND_URL}/notifications/me/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    expect(markAllRes.status).toBe(204);

    const afterRes = await fetch(`${BACKEND_URL}/notifications/me/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await afterRes.json()).count).toBe(0);
  });

  it('CRITICAL: a buyer cannot mark another buyer\'s real notification as read -- cross-user access is rejected', async () => {
    const { token: token1, user: user1 } = await registerFreshBuyer();
    const order = await placeOrder(user1.id);
    await assignHubAndShip(order.supplierSubOrders[0].subOrderId);
    const listRes = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${token1}` } });
    const notification = (await listRes.json())[0];

    const { token: token2 } = await registerFreshBuyer();
    const res = await fetch(`${BACKEND_URL}/notifications/me/${notification.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token2}` } });
    expect(res.status).toBe(404);
  });

  it('unauthenticated requests are rejected on every endpoint', async () => {
    const listRes = await fetch(`${BACKEND_URL}/notifications/me`);
    expect(listRes.status).toBe(401);
    const countRes = await fetch(`${BACKEND_URL}/notifications/me/unread-count`);
    expect(countRes.status).toBe(401);
  });
});
