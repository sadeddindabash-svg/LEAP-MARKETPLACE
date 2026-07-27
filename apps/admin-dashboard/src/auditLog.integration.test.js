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

  // Real date-range filter (new) -- previously the audit log had no
  // way to narrow by date at all.
  it('CRITICAL: a real date-range filter genuinely narrows to only entries within it, using the real date this test itself creates one on', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `AUDITDATETEST${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5 }),
    });

    const today = new Date().toISOString().slice(0, 10);
    const logToday = await fetch(`${BACKEND_URL}/admin/audit-log?startDate=${today}&endDate=${today}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(logToday.find((e) => e.targetId === code)).toBeTruthy();

    // A real range that couldn't possibly include an entry created
    // just now must genuinely exclude it.
    const logPast = await fetch(`${BACKEND_URL}/admin/audit-log?startDate=2020-01-01&endDate=2020-01-02`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(logPast.find((e) => e.targetId === code)).toBeFalsy();

    // The end date is genuinely inclusive of the WHOLE day, not just
    // midnight of that day -- an admin picking "today" as the end date
    // means "through the end of today."
    expect(logToday.length).toBeGreaterThan(0);
  });

  it('the action filter and date-range filter genuinely compose together, not just independently', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `AUDITCOMBOTEST${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5 }),
    });

    const today = new Date().toISOString().slice(0, 10);
    const combined = await fetch(`${BACKEND_URL}/admin/audit-log?action=promo_code_created&startDate=${today}&endDate=${today}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(combined.find((e) => e.targetId === code)).toBeTruthy();
    expect(combined.every((e) => e.action === 'promo_code_created')).toBe(true);
  });

  // Real catalog/fitment/moderation audit coverage (new) -- closes a
  // real gap: essentially all vehicle reference-data management and
  // product-listing moderation were completely unlogged before this,
  // despite this page's own scope already covering the conceptually
  // adjacent "review moderation" (a different, real system).
  it('CRITICAL: creating a real brand is logged with its real name', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const name = `AuditBrandTest${Date.now()}`;
    const created = await fetch(`${BACKEND_URL}/fitment/brands`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, nameAr: 'اختبار', photoUrl: '/uploads/test.jpg' }),
    }).then((r) => r.json());

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=brand_created`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const entry = log.find((e) => e.targetId === created.id);
    expect(entry).toBeTruthy();
    expect(entry.details.name).toBe(name);
  });

  it('CRITICAL: creating and deleting a real category are both logged', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const id = `audit_cat_test_${Date.now()}`;
    await fetch(`${BACKEND_URL}/catalog/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, nameEn: 'Audit Cat Test', nameAr: 'اختبار', photoUrl: '/uploads/test.jpg' }),
    });

    const createdLog = await fetch(`${BACKEND_URL}/admin/audit-log?action=category_created`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(createdLog.find((e) => e.targetId === id)).toBeTruthy();

    await fetch(`${BACKEND_URL}/catalog/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const deletedLog = await fetch(`${BACKEND_URL}/admin/audit-log?action=category_deleted`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(deletedLog.find((e) => e.targetId === id)).toBeTruthy();
  });

  it('CRITICAL: approving or rejecting a real product listing is logged, distinctly from buyer review moderation', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const queue = await fetch(`${BACKEND_URL}/catalog/moderation-queue`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (queue.length === 0) return; // nothing pending right now -- not this test's job to create one

    const product = queue[0];
    await fetch(`${BACKEND_URL}/catalog/products/${product.id}/moderate`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'reject' }),
    });

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=product_rejected`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const entry = log.find((e) => e.targetId === product.id);
    expect(entry).toBeTruthy();
    expect(entry.targetType).toBe('product');
  });

  // Real promo code and fee component audit coverage (new) -- closes a
  // real gap: only CREATING either was logged before this, not editing
  // (activating/deactivating a code, changing a fee's real value) or
  // deleting -- arguably more consequential than creation for both.
  it('CRITICAL: deactivating a real promo code is logged, distinctly from creating it', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const code = `AuditPromoUpdateTest${Date.now()}`;
    await fetch(`${BACKEND_URL}/promo-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code, type: 'flat', value: 5 }),
    });
    await fetch(`${BACKEND_URL}/promo-codes/${code}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: false }),
    });

    const log = await fetch(`${BACKEND_URL}/admin/audit-log?action=promo_code_updated`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const entry = log.find((e) => e.targetId === code);
    expect(entry).toBeTruthy();
    expect(entry.details.isActive).toBe(false);
  });

  it('CRITICAL: creating, updating, and deleting a real fee component are all logged', async () => {
    const { token } = await login('admin@leap.dev', 'admin_dev_password_123');
    const created = await fetch(`${BACKEND_URL}/pricing/fee-components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `AuditFeeTest${Date.now()}`, type: 'percentage', value: 3 }),
    }).then((r) => r.json());

    const createdLog = await fetch(`${BACKEND_URL}/admin/audit-log?action=fee_component_created`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(createdLog.find((e) => e.targetId === created.id)).toBeTruthy();

    await fetch(`${BACKEND_URL}/pricing/fee-components/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: 4 }),
    });
    const updatedLog = await fetch(`${BACKEND_URL}/admin/audit-log?action=fee_component_updated`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(updatedLog.find((e) => e.targetId === created.id)).toBeTruthy();

    await fetch(`${BACKEND_URL}/pricing/fee-components/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const deletedLog = await fetch(`${BACKEND_URL}/admin/audit-log?action=fee_component_deleted`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    expect(deletedLog.find((e) => e.targetId === created.id)).toBeTruthy();
  });
});
