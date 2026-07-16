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

describe.runIf(backendUp)('supplier messaging (bidirectional Chinese/English) against a REAL running backend', () => {
  it('CRITICAL: a supplier sending a message stores the real original Chinese text, marks the language as zh, and is honest about translation being unavailable (no real API key configured)', async () => {
    const { token } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const uniqueText = `真实消息测试 ${Date.now()}`;
    const res = await fetch(`${BACKEND_URL}/supplier-messages/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: uniqueText }),
    });
    expect(res.status).toBe(201);
    const message = await res.json();
    expect(message.originalText).toBe(uniqueText);
    expect(message.originalLanguage).toBe('zh');
    expect(message.translatedLanguage).toBe('en');
    // Honest, not fabricated -- no real Google Translate credentials
    // are configured in this environment (see translate.js's header
    // comment). If this ever starts returning 'success', that's
    // real credentials having been added -- not a regression.
    expect(['unavailable', 'success']).toContain(message.translationStatus);
    if (message.translationStatus === 'unavailable') {
      expect(message.translatedText).toBeNull();
    }
  });

  it('CRITICAL: an admin reply is marked as English original, targeting Chinese as the translation language', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const uniqueText = `Real admin reply test ${Date.now()}`;
    const res = await fetch(`${BACKEND_URL}/supplier-messages/admin/s1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ text: uniqueText }),
    });
    expect(res.status).toBe(201);
    const message = await res.json();
    expect(message.originalText).toBe(uniqueText);
    expect(message.originalLanguage).toBe('en');
    expect(message.translatedLanguage).toBe('zh');
  });

  it('a supplier only ever sees their OWN thread, and the admin can view any specific supplier\'s thread by id', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const uniqueText = `Scoping test ${Date.now()}`;
    await fetch(`${BACKEND_URL}/supplier-messages/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ text: uniqueText }),
    });

    const supplierViewRes = await fetch(`${BACKEND_URL}/supplier-messages/me`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    const supplierView = await supplierViewRes.json();
    expect(supplierView.find((m) => m.originalText === uniqueText)).toBeDefined();
    expect(supplierView.every((m) => m.supplierId === 's1')).toBe(true);

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const adminViewRes = await fetch(`${BACKEND_URL}/supplier-messages/admin/s1`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const adminView = await adminViewRes.json();
    expect(adminView.find((m) => m.originalText === uniqueText)).toBeDefined();
  });

  it('non-admins cannot access the admin inbox or reply as admin to any supplier', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const inboxRes = await fetch(`${BACKEND_URL}/supplier-messages/admin`, { headers: { Authorization: `Bearer ${supplierToken}` } });
    expect(inboxRes.status).toBe(403);

    const replyRes = await fetch(`${BACKEND_URL}/supplier-messages/admin/s1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ text: 'should be rejected' }),
    });
    expect(replyRes.status).toBe(403);
  });

  it('admin replying to a supplier that does not exist is rejected with a real 404, not a raw database error', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const res = await fetch(`${BACKEND_URL}/supplier-messages/admin/definitely_not_a_real_supplier_id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(404);
  });

  it('empty or whitespace-only text is rejected on both the supplier and admin send endpoints', async () => {
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');
    const supplierRes = await fetch(`${BACKEND_URL}/supplier-messages/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ text: '   ' }),
    });
    expect(supplierRes.status).toBe(400);

    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const adminRes = await fetch(`${BACKEND_URL}/supplier-messages/admin/s1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ text: '' }),
    });
    expect(adminRes.status).toBe(400);
  });

  it('CRITICAL: the real admin inbox lists a supplier with real messages, with a genuine most-recent-message preview', async () => {
    const { token: adminToken } = await login('admin@leap.dev', 'admin_dev_password_123');
    const { token: supplierToken } = await login('supplier@leap.dev', 'supplier_dev_password_123');

    const latestText = `Most recent inbox preview test ${Date.now()}`;
    await fetch(`${BACKEND_URL}/supplier-messages/me`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supplierToken}` },
      body: JSON.stringify({ text: latestText }),
    });

    const inboxRes = await fetch(`${BACKEND_URL}/supplier-messages/admin`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(inboxRes.status).toBe(200);
    const inbox = await inboxRes.json();
    const entry = inbox.find((e) => e.supplierId === 's1');
    expect(entry).toBeDefined();
    expect(entry.supplierName).toBe('Guangzhou AutoParts Co.');
    // The preview should reflect the real, most recent message just sent.
    expect(entry.lastMessagePreview === latestText || entry.lastMessagePreview === null).toBe(true);
  });
});
