import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BACKEND_URL = 'http://localhost:4000';
async function isBackendUp() { try { return (await fetch(`${BACKEND_URL}/health`)).ok; } catch { return false; } }
const backendUp = await isBackendUp();

const login = async (email, password) => (await (await fetch(`${BACKEND_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const read = async () => (await fetch(`${BACKEND_URL}/platform-settings/announcements`)).json();
const save = (token, announcements) => fetch(`${BACKEND_URL}/platform-settings/announcements`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ announcements }) });

describe.runIf(backendUp)('home page announcements: the admin saves them, the public reads them, against a REAL running backend', () => {
  let admin, original;
  beforeAll(async () => { admin = await login('admin@leap.dev', 'admin_dev_password_123'); original = (await read()).announcements; });
  afterAll(async () => { await save(admin, original); });                                  // leave the development database as it was

  it('CRITICAL: reading is public (no sign-in) and says the limit', async () => {
    const res = await fetch(`${BACKEND_URL}/platform-settings/announcements`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.announcements)).toBe(true);
    expect(body.max).toBe(5);
  });

  it('CRITICAL: only an admin can change it: nobody signed in, and a buyer, are refused, and nothing changes', async () => {
    const before = await read();
    expect((await save(null, [{ en: 'Hacked', ar: '' }])).status).toBe(401);
    const signup = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `announce-buyer-${Date.now()}@leap.dev`, password: 'announce_pw_123' }) });
    const buyer = (await signup.json()).token;
    expect((await save(buyer, [{ en: 'Hacked', ar: '' }])).status).toBe(403);
    expect(await read()).toEqual(before);
  });

  it('CRITICAL: what the admin saves is what the public reads, in the same order, tidied; up to 5', async () => {
    const res = await save(admin, [{ en: '  First   line ', ar: ' السطر الأول ' }, { en: 'Second', ar: '' }, { en: 'Third\n line', ar: 'الثالث' }, { en: 'Fourth', ar: '' }, { en: 'Fifth', ar: '' }]);
    expect(res.status).toBe(200);
    const { announcements } = await read();
    expect(announcements).toEqual([{ en: 'First line', ar: 'السطر الأول' }, { en: 'Second', ar: '' }, { en: 'Third line', ar: 'الثالث' }, { en: 'Fourth', ar: '' }, { en: 'Fifth', ar: '' }]);
  });

  it('CRITICAL: a sixth, a line with no English, an over-long line and a non-list are refused with a reason, and the saved list is unchanged', async () => {
    await save(admin, [{ en: 'Keep me', ar: '' }]);
    const attempts = [
      [Array.from({ length: 6 }, (_, i) => ({ en: `L${i}`, ar: '' })), /up to 5/],
      [[{ en: '', ar: 'مرحبا' }], /English text/],
      [[{ en: 'x'.repeat(151), ar: '' }], /150 characters/],
      ['not a list', /must be a list/],
    ];
    for (const [body, reason] of attempts) {
      const res = await save(admin, body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(reason);
    }
    expect((await read()).announcements).toEqual([{ en: 'Keep me', ar: '' }]);
  });

  it('an empty list is accepted and switches the bar off', async () => {
    expect((await save(admin, [])).status).toBe(200);
    expect((await read()).announcements).toEqual([]);
  });

  it('CRITICAL: every change is recorded in the audit log with who did it and what the list became', async () => {
    await save(admin, [{ en: 'Audited line', ar: 'سطر' }]);
    const body = await (await fetch(`${BACKEND_URL}/admin/audit-log?action=announcements_changed`, { headers: { Authorization: `Bearer ${admin}` } })).json();
    const entries = Array.isArray(body) ? body : (body.entries || body.items || body.rows || body.log || []);
    expect(entries.length).toBeGreaterThan(0);
    const latest = entries[0];
    expect(latest.action).toBe('announcements_changed');
    expect(latest.adminEmail || latest.admin_email).toBe('admin@leap.dev');
    expect(JSON.stringify(latest.details)).toContain('Audited line');
  });
});
