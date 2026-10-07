// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import { Pool } from 'pg';

/**
 * Proves the emails that REALLY ARRIVE are right. Runs only when (1) the backend has email configured and (2) Mailpit (a local fake mail server with an
 * inbox) is listening on localhost:8025, otherwise it skips itself. To run it:
 *   Mailpit:  .\mailpit.exe --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 --smtp-auth-accept-any --smtp-auth-allow-insecure
 *   backend:  SMTP_HOST=127.0.0.1  SMTP_PORT=1025  SMTP_USER=dev  SMTP_PASSWORD=dev  SMTP_FROM_EMAIL=noreply@leap.test  (in services/api/.env)
 */
const BACKEND_URL = 'http://localhost:4000';
const MAILPIT_URL = 'http://localhost:8025';
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const ADDRESS = { recipientName: 'John Smith', phone: '555-0100', country: 'USA', city: 'Springfield', streetAddress: '123 Test St' };

async function emailLooksReady() {
  try {
    const health = await (await fetch(`${BACKEND_URL}/health`)).json();
    if (!health.email || !health.email.configured) return false;
    return (await fetch(`${MAILPIT_URL}/api/v1/info`)).ok;
  } catch { return false; }
}
const ready = await emailLooksReady();

const json = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...json, Authorization: `Bearer ${token}` });
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const ARABIC = /[\u0600-\u06FF]/;
const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });

// Waits for the email to the address (they are sent just after the response, so give them a moment), then returns its full content.
async function emailTo(address, { subjectIncludes } = {}) {
  for (let i = 0; i < 40; i += 1) {
    const found = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`).then((r) => r.json());
    const match = (found.messages || []).find((m) => !subjectIncludes || m.Subject.includes(subjectIncludes));
    if (match) return fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email to ${address}${subjectIncludes ? ` with "${subjectIncludes}"` : ''} arrived in the inbox`);
}
async function signedUpBuyer(language) {
  const email = `mail.${stamp()}@example.com`;
  const res = await (await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'test_password_123' }) })).json();
  if (language) await fetch(`${BACKEND_URL}/notifications/me?lang=${language}`, { headers: auth(res.token) }); // the app reports its language this way
  return { email, token: res.token, id: res.user.id };
}
const placeOrder = (body) => fetch(`${BACKEND_URL}/order`, { method: 'POST', headers: json, body: JSON.stringify({ items: [{ productId: 'p1', quantity: 1 }], address: ADDRESS, ...body }) }).then((r) => r.json());

describe.runIf(ready)('the emails that really arrive (real backend + Mailpit)', () => {
  it('CRITICAL: the password reset email holds the code AND a working link, in the person\'s own language', async () => {
    for (const [language, expectArabic] of [['ar', true], ['en', false]]) {
      const buyer = await signedUpBuyer(language);
      await fetch(`${BACKEND_URL}/auth/forgot-password`, { method: 'POST', headers: json, body: JSON.stringify({ email: buyer.email.toUpperCase().replace('@EXAMPLE.COM', '@example.com') }) });
      const mail = await emailTo(buyer.email, { subjectIncludes: language === 'ar' ? 'إعادة تعيين' : 'Reset your Leap password' });
      const code = (await pool.query('SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [buyer.id])).rows[0].token;
      expect(mail.HTML).toContain(code);
      expect(mail.Text).toContain(code);
      expect(Boolean(ARABIC.test(mail.Subject))).toBe(expectArabic);
      expect(Boolean(ARABIC.test(mail.Text))).toBe(expectArabic);
      const link = mail.Text.match(/https?:\/\/\S+\/reset-password\?token=[a-f0-9]{64}/)[0];
      expect(link).toContain(code);
      expect(link.startsWith('http://localhost:4000/reset-password')).toBe(true);          // the backend's own address, not the admin portal's
      expect((await fetch(link)).status).toBe(200);                                         // and the page really opens
    }
  }, 90000);

  it('CRITICAL: an order confirmation comes in Arabic for an Arabic account, in English for an English one, and in BOTH for a guest', async () => {
    const arabic = await signedUpBuyer('ar');
    const english = await signedUpBuyer('en');
    const guestEmail = `guest.${stamp()}@example.com`;
    const orders = await Promise.all([placeOrder({ userId: arabic.id }), placeOrder({ userId: english.id }), placeOrder({ guestEmail })]);
    orders.forEach((o) => expect(o.id).toBeTruthy());

    const forArabic = await emailTo(arabic.email, { subjectIncludes: orders[0].id });
    expect(forArabic.Subject).toBe(`تم تأكيد الطلب — ${orders[0].id}`);
    expect(forArabic.HTML).toContain('lang="ar" dir="rtl"');
    expect(forArabic.HTML).toContain('تم تأكيد طلبك');
    expect(forArabic.HTML).not.toContain('Order confirmed');

    const forEnglish = await emailTo(english.email, { subjectIncludes: orders[1].id });
    expect(forEnglish.Subject).toBe(`Order confirmed — ${orders[1].id}`);
    expect(forEnglish.HTML).not.toMatch(ARABIC);

    const forGuest = await emailTo(guestEmail, { subjectIncludes: orders[2].id });
    expect(forGuest.Subject).toBe(`Order confirmed — ${orders[2].id} · تم تأكيد الطلب — ${orders[2].id}`);
    expect(forGuest.HTML).toContain('Order confirmed');
    expect(forGuest.HTML).toContain('تم تأكيد طلبك');
    expect(forGuest.HTML.indexOf('Order confirmed')).toBeLessThan(forGuest.HTML.indexOf('تم تأكيد طلبك'));
  }, 90000);

  it('the welcome email follows the same rule (a new account starts in English until its app reports Arabic)', async () => {
    const buyer = await signedUpBuyer();
    const mail = await emailTo(buyer.email, { subjectIncludes: 'Welcome to Leap' });
    expect(mail.Subject).toBe('Welcome to Leap');
    expect(mail.HTML).not.toMatch(ARABIC);
  }, 60000);
});
