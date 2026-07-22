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

async function createBuyer() {
  const suffix = Date.now() + Math.random();
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `saved-search-test-${suffix}@example.com`, password: 'test_password_123' }),
  });
  return res.json();
}

async function createApprovedSupplierProduct(nameZh) {
  const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
  const suffix = Date.now() + Math.random();
  const createRes = await fetch(`${BACKEND_URL}/supplier/me/products`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
    body: JSON.stringify({
      nameZh, category: 'brake', part: 'Front Brake Disc', position: 'Front', oemNumber: `SAVEDSEARCHTEST-${suffix}`,
      price: 100, currencyCode: 'CNY', stockQuantity: 50,
      fitment: { generationId: 'gen_bmw_1_series_f20', year: 2018 },
      images: ['/uploads/p-a.jpg', '/uploads/p-b.jpg', '/uploads/p-c.jpg'],
      weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10,
    }),
  });
  const created = await createRes.json();

  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  await fetch(`${BACKEND_URL}/catalog/products/${created.id}/moderate`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', nameEn: nameZh, nameAr: 'اختبار' }),
  });
  return created.id;
}

async function triggerCheck() {
  const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
  return fetch(`${BACKEND_URL}/admin/saved-searches/check`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json());
}

describe.runIf(backendUp)('real saved searches with new-match notifications against a REAL running backend', () => {
  it('CRITICAL: the first real check on a saved search only records a real baseline, with no notification, even with zero matches', async () => {
    const buyer = await createBuyer();
    const term = `SavedSearchBaselineTest${Date.now()}`;
    await fetch(`${BACKEND_URL}/saved-searches/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ searchTerm: term, label: 'Baseline test' }),
    });

    const result = await triggerCheck();
    expect(result.notified).toBe(0);

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(notifications.filter((n) => n.type === 'saved_search_match').length).toBe(0);
  });

  it('CRITICAL: a real, genuinely new match after the baseline check correctly notifies -- confirms the fix for a real bug where a zero-match baseline incorrectly suppressed every future notification forever', async () => {
    const buyer = await createBuyer();
    const term = `SavedSearchRealMatch${Date.now()}`;
    const saved = await fetch(`${BACKEND_URL}/saved-searches/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ searchTerm: term, label: 'Real match test' }),
    }).then((r) => r.json());

    // Real baseline check -- genuinely zero matches exist yet.
    const baseline = await triggerCheck();
    expect(baseline.notified).toBe(0);

    // Now a real, genuinely new matching product appears.
    await createApprovedSupplierProduct(`${term} product`);

    const afterMatch = await triggerCheck();
    expect(afterMatch.notified).toBeGreaterThanOrEqual(1);

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    const matching = notifications.filter((n) => n.type === 'saved_search_match' && n.linkId === String(saved.id));
    expect(matching.length).toBe(1);
    expect(matching[0].body).toContain('1 new match');
  });

  it('a real, subsequent check with no further new matches does not re-notify', async () => {
    const buyer = await createBuyer();
    const term = `SavedSearchNoRepeat${Date.now()}`;
    await fetch(`${BACKEND_URL}/saved-searches/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
      body: JSON.stringify({ searchTerm: term, label: 'No repeat test' }),
    });
    await triggerCheck(); // baseline
    await createApprovedSupplierProduct(`${term} product`);
    await triggerCheck(); // first real match, notifies
    await triggerCheck(); // no further new matches, should NOT notify again

    const notifications = await fetch(`${BACKEND_URL}/notifications/me`, { headers: { Authorization: `Bearer ${buyer.token}` } }).then((r) => r.json());
    expect(notifications.filter((n) => n.type === 'saved_search_match' && n.body.includes(term)).length).toBe(1);
  }, 20000); // real, deliberately generous timeout -- three real full-sweep checks against a saved_searches table that has genuinely grown across this whole project's accumulated test history.

  it("a buyer can list and delete their own real saved searches, and cannot delete another buyer's", async () => {
    const buyer1 = await createBuyer();
    const buyer2 = await createBuyer();
    const saved = await fetch(`${BACKEND_URL}/saved-searches/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({ searchTerm: 'x', label: 'Ownership test' }),
    }).then((r) => r.json());

    const list = await fetch(`${BACKEND_URL}/saved-searches/me`, { headers: { Authorization: `Bearer ${buyer1.token}` } }).then((r) => r.json());
    expect(list.find((s) => s.id === saved.id)).toBeTruthy();

    const wrongDelete = await fetch(`${BACKEND_URL}/saved-searches/me/${saved.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${buyer2.token}` } });
    expect(wrongDelete.status).toBe(404);

    const rightDelete = await fetch(`${BACKEND_URL}/saved-searches/me/${saved.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${buyer1.token}` } });
    expect(rightDelete.status).toBe(204);
  });

  it('a non-admin cannot trigger a manual saved-search check', async () => {
    const buyer = await createBuyer();
    const res = await fetch(`${BACKEND_URL}/admin/saved-searches/check`, { method: 'POST', headers: { Authorization: `Bearer ${buyer.token}` } });
    expect(res.status).toBe(403);
  });
});
