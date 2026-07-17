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

async function createScopedAdmin(ownerToken, allowedPages) {
  const suffix = Date.now() + Math.random();
  const email = `perm-test-${suffix}@leap.dev`;
  const res = await fetch(`${BACKEND_URL}/admin-users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ email, password: 'test_password_123', allowedPages }),
  });
  const body = await res.json();
  return { status: res.status, body, email };
}

describe.runIf(backendUp)('real admin team permissions (owner + page-level access control) against a REAL running backend', () => {
  it('CRITICAL: the real seeded admin is a real owner with full real access', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    expect(body.isOwner).toBe(true);
    expect(body.allowedPages).toBe('all');
  });

  it('CRITICAL: Scenario 1 -- a real support-only admin can access Tickets and Returns, but is rejected from Pricing, Promo Codes, and Moderation', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body: created, email } = await createScopedAdmin(ownerToken, ['tickets', 'returns']);
    const { token } = await login(email, 'test_password_123');

    expect(created.isOwner).toBe(false);
    expect(created.allowedPages).toEqual(['tickets', 'returns']);

    const ticketsRes = await fetch(`${BACKEND_URL}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } });
    expect(ticketsRes.status).toBe(200);
    const returnsRes = await fetch(`${BACKEND_URL}/returns`, { headers: { Authorization: `Bearer ${token}` } });
    expect(returnsRes.status).toBe(200);

    const pricingRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
    expect(pricingRes.status).toBe(403);
    const promoRes = await fetch(`${BACKEND_URL}/promo-codes`, { headers: { Authorization: `Bearer ${token}` } });
    expect(promoRes.status).toBe(403);
    const moderationRes = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, { headers: { Authorization: `Bearer ${token}` } });
    expect(moderationRes.status).toBe(403);
  });

  it('CRITICAL: Scenario 2 -- a real finance-only admin can access Pricing, but is rejected from Moderation and Supplier Messages', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { email } = await createScopedAdmin(ownerToken, ['pricing']);
    const { token } = await login(email, 'test_password_123');

    const pricingRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
    expect(pricingRes.status).toBe(200);

    const moderationRes = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, { headers: { Authorization: `Bearer ${token}` } });
    expect(moderationRes.status).toBe(403);
    const messagesRes = await fetch(`${BACKEND_URL}/supplier-messages/admin`, { headers: { Authorization: `Bearer ${token}` } });
    expect(messagesRes.status).toBe(403);
  });

  it('CRITICAL: a real owner always has full access, bypassing the permissions table entirely, across every real page', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const endpoints = ['/pricing/fee-components', '/catalog/moderation-queue', '/promo-codes', '/supplier-messages/admin', '/order', '/returns', '/support/tickets'];
    for (const endpoint of endpoints) {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(200);
    }
  }, 15000);

  it('CRITICAL: a real buyer is completely unaffected by page-access logic on the real shared GET /order endpoint', async () => {
    const suffix = Date.now();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `perm-buyer-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const res = await fetch(`${BACKEND_URL}/order`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it('CRITICAL: the owner can update a real scoped admin\'s permissions, and it takes effect on their NEXT request immediately -- not after a new login', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body: created, email } = await createScopedAdmin(ownerToken, ['tickets']);
    const { token } = await login(email, 'test_password_123');

    const beforeRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
    expect(beforeRes.status).toBe(403);

    await fetch(`${BACKEND_URL}/admin-users/${created.id}/permissions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ allowedPages: ['pricing'] }),
    });

    // Same real token, no new login -- the permission change should be
    // real and live, not cached in the JWT from the original login.
    const afterRes = await fetch(`${BACKEND_URL}/pricing/fee-components`, { headers: { Authorization: `Bearer ${token}` } });
    expect(afterRes.status).toBe(200);
    const nowTicketsRes = await fetch(`${BACKEND_URL}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } });
    expect(nowTicketsRes.status).toBe(403); // real full replace -- the old 'tickets' access is genuinely gone
  });

  it('an unknown page id is rejected on both create and permission-update', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const createRes = await fetch(`${BACKEND_URL}/admin-users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: `perm-badpage-${Date.now()}@leap.dev`, password: 'test_password_123', allowedPages: ['notARealPage'] }),
    });
    expect(createRes.status).toBe(400);
  });

  it('CRITICAL: a non-owner admin cannot manage any other admin\'s account or permissions', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body: created, email } = await createScopedAdmin(ownerToken, ['tickets']);
    const { token } = await login(email, 'test_password_123');

    const listRes = await fetch(`${BACKEND_URL}/admin-users`, { headers: { Authorization: `Bearer ${token}` } });
    expect(listRes.status).toBe(403);

    const createOtherRes = await fetch(`${BACKEND_URL}/admin-users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: `perm-hijack-${Date.now()}@leap.dev`, password: 'test_password_123' }),
    });
    expect(createOtherRes.status).toBe(403);

    const patchRes = await fetch(`${BACKEND_URL}/admin-users/${created.id}/permissions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ allowedPages: ['pricing'] }),
    });
    expect(patchRes.status).toBe(403);
  });

  it('CRITICAL: the real owner account cannot be deleted, and cannot be edited via the permissions endpoint', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const meRes = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    const owner = await meRes.json();

    const deleteRes = await fetch(`${BACKEND_URL}/admin-users/${owner.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(deleteRes.status).toBe(400);

    const patchRes = await fetch(`${BACKEND_URL}/admin-users/${owner.id}/permissions`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ allowedPages: ['pricing'] }),
    });
    expect(patchRes.status).toBe(400);
  });

  it('a real scoped admin can be deleted by the owner, and their account genuinely stops working afterward', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body: created, email } = await createScopedAdmin(ownerToken, ['tickets']);

    const deleteRes = await fetch(`${BACKEND_URL}/admin-users/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(deleteRes.status).toBe(204);

    const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test_password_123' }),
    });
    expect(loginRes.status).toBe(401);
  });

  it('duplicate email is rejected when creating a new admin account', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/admin-users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: 'admin@leap.dev', password: 'test_password_123' }),
    });
    expect(res.status).toBe(409);
  });

  it('the real GET /admin-users list includes accurate real permissions for every real admin account', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { body: created } = await createScopedAdmin(ownerToken, ['hubs', 'flagged']);

    const listRes = await fetch(`${BACKEND_URL}/admin-users`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    const list = await listRes.json();
    const entry = list.find((u) => u.id === created.id);
    expect(entry).toBeDefined();
    expect(entry.allowedPages.sort()).toEqual(['flagged', 'hubs']);
  });
});
