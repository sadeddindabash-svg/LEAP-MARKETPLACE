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

describe.runIf(backendUp)('real admin audit log against a REAL running backend', () => {
  it('CRITICAL: a real promo code creation is logged with the real code as its target', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `AUDITTEST${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5 }),
    });

    const log = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const entry = log.find((e) => e.action === 'promo_code_created' && e.targetId === code);
    expect(entry).toBeTruthy();
    expect(entry.details.type).toBe('flat');
    expect(entry.adminEmail).toBe('admin@leap.dev');
  });

  it('CRITICAL: a real category commission change is logged with the real new value', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const categories = await fetch(`${BACKEND_URL}/catalog/categories`).then((r) => r.json());
    const categoryId = categories[0].id;

    await fetch(`${BACKEND_URL}/catalog/categories/${categoryId}/commission`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ commissionPercent: 17 }),
    });

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=category_commission_changed`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const entry = log.find((e) => e.targetId === categoryId);
    expect(entry).toBeTruthy();
    expect(entry.details.commissionPercent).toBe(17);
  });

  it('CRITICAL: a real review moderation action is logged with the real product ID', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now() + Math.random();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `audit-log-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token: buyerToken } = await signupRes.json();
    const review = await fetch(`${BACKEND_URL}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ productId: 'p1', rating: 5, comment: 'audit log test' }),
    }).then((r) => r.json());

    await fetch(`${BACKEND_URL}/reviews/${review.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'approve' }),
    });

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=review_approve`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
    const entry = log.find((e) => e.targetId === String(review.id));
    expect(entry).toBeTruthy();
    expect(entry.details.productId).toBe('p1');
  });

  it('CRITICAL: only the real owner account can view the audit log, not a regular admin', async () => {
    const { token: ownerToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const suffix = Date.now();
    await fetch(`${BACKEND_URL}/admin-users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ email: `audit-nonowner-test-${suffix}@example.com`, password: 'test_password_123', allowedPages: ['orders'] }),
    });
    const { token: nonOwnerToken } = await login(`audit-nonowner-test-${suffix}@example.com`, 'test_password_123');

    const res = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: { Authorization: `Bearer ${nonOwnerToken}` } });
    expect(res.status).toBe(403);

    const ownerRes = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    expect(ownerRes.status).toBe(200);
  });

  it('a non-admin (buyer) cannot view the audit log at all', async () => {
    const suffix = Date.now() + Math.random();
    const signupRes = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `audit-buyer-test-${suffix}@example.com`, password: 'test_password_123' }),
    });
    const { token } = await signupRes.json();
    const res = await fetch(`${BACKEND_URL}/admin/audit-log`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });
});
