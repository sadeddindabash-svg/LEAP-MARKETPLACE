import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function clearSmtpEnv() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_FROM_EMAIL;
  delete process.env.SMTP_FROM_NAME;
}

async function freshClientModule() {
  vi.resetModules();
  return import('../../../services/api/src/modules/email/client.js');
}

beforeEach(() => { clearSmtpEnv(); });
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('real generic SMTP email client (services/api/src/modules/email/client.js)', () => {
  it('CRITICAL: isEmailConfigured() is false with no real SMTP env vars set', async () => {
    const { isEmailConfigured } = await freshClientModule();
    expect(isEmailConfigured()).toBe(false);
  });

  it('CRITICAL: isEmailConfigured() is false with only a partial real configuration', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    // Missing SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL -- genuinely incomplete.
    const { isEmailConfigured } = await freshClientModule();
    expect(isEmailConfigured()).toBe(false);
  });

  it('CRITICAL: isEmailConfigured() is true once all 5 real required env vars are set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'pass';
    process.env.SMTP_FROM_EMAIL = 'noreply@leap.dev';
    const { isEmailConfigured } = await freshClientModule();
    expect(isEmailConfigured()).toBe(true);
  });

  // NOTE: sendEmail()'s real transport-building and real SMTP send/
  // failure behavior are NOT re-tested here via a mocked nodemailer --
  // this test file lives in a genuinely SEPARATE npm package
  // (admin-dashboard) from services/api, with its own separate
  // node_modules/nodemailer, so mutating THIS file's imported
  // nodemailer instance does not affect the DIFFERENT nodemailer
  // instance client.js actually resolves internally (same real
  // cross-package boundary as the storage and translation modules).
  // That logic (transport config per port, real success/failure
  // handling) was instead verified directly via a standalone script
  // against the real client.js — see services/api/README.md's "Real
  // password reset email delivery" section for the honest, documented
  // detail of what was verified and how.
});

describe('real branded password reset email template (services/api/src/modules/email/templates.js)', () => {
  it('includes the real reset URL in both the HTML and plain-text versions', async () => {
    const { passwordResetEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const resetUrl = 'http://localhost:5173/reset-password?token=real-token-abc123';
    const { html, text } = passwordResetEmail({ recipientName: 'Dev Admin', resetUrl, expiryMinutes: 60 });

    expect(html).toContain(resetUrl);
    expect(text).toContain(resetUrl);
  });

  it('personalizes the greeting with a real recipient name when provided, and falls back gracefully without one', async () => {
    const { passwordResetEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const withName = passwordResetEmail({ recipientName: 'Wei Zhang', resetUrl: 'http://x', expiryMinutes: 60 });
    expect(withName.html).toContain('Hi Wei Zhang,');

    const withoutName = passwordResetEmail({ recipientName: null, resetUrl: 'http://x', expiryMinutes: 60 });
    expect(withoutName.html).toContain('Hi,');
    expect(withoutName.html).not.toContain('null');
  });

  it('shows the real configured expiry time, not a hardcoded number', async () => {
    const { passwordResetEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const { html, text } = passwordResetEmail({ recipientName: 'Test', resetUrl: 'http://x', expiryMinutes: 45 });
    expect(html).toContain('45 minutes');
    expect(text).toContain('45 minutes');
  });
});

describe('real transactional email templates (new) — order confirmation, shipping/delivery notifications, payout confirmation', () => {
  it('CRITICAL: order confirmation includes the real order id, every real item, and the real total — not a fabricated summary', async () => {
    const { orderConfirmationEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const { html, text } = orderConfirmationEmail({
      recipientName: 'Wei Zhang', orderId: 'LP-123456',
      items: [{ name: 'Front Brake Disc', quantity: 2, price: 39.99 }, { name: 'Oil Filter', quantity: 1, price: 12.5 }],
      total: 92.48, currencyCode: 'USD',
    });
    expect(html).toContain('LP-123456');
    expect(html).toContain('Front Brake Disc');
    expect(html).toContain('Oil Filter');
    expect(html).toContain('92.48');
    expect(text).toContain('LP-123456');
    expect(text).toContain('92.48');
  });

  it('shipping notification includes the real tracking number when provided, and omits it gracefully when not', async () => {
    const { shippingNotificationEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const withTracking = shippingNotificationEmail({ recipientName: 'Wei', orderId: 'LP-1', trackingNumber: 'TRACK-999' });
    expect(withTracking.html).toContain('TRACK-999');
    expect(withTracking.text).toContain('TRACK-999');

    const withoutTracking = shippingNotificationEmail({ recipientName: 'Wei', orderId: 'LP-1', trackingNumber: null });
    expect(withoutTracking.html).not.toContain('null');
    expect(withoutTracking.html).toContain('LP-1');
  });

  it('delivery notification includes the real order id', async () => {
    const { deliveryNotificationEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const { html, text } = deliveryNotificationEmail({ recipientName: 'Wei', orderId: 'LP-7777' });
    expect(html).toContain('LP-7777');
    expect(text).toContain('LP-7777');
  });

  it('CRITICAL: payout confirmation shows the real amount and real sub-order count, with correct real singular/plural wording', async () => {
    const { payoutConfirmationEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const single = payoutConfirmationEmail({ recipientName: 'Guangzhou AutoParts', amount: 70.38, currencyCode: 'USD', subOrderCount: 1 });
    expect(single.html).toContain('70.38');
    expect(single.html).toContain('1 order');
    expect(single.html).not.toContain('1 orders');

    const multiple = payoutConfirmationEmail({ recipientName: 'Guangzhou AutoParts', amount: 240.00, currencyCode: 'USD', subOrderCount: 3 });
    expect(multiple.html).toContain('3 orders');
  });

  it('all 4 new templates personalize the greeting with a real recipient name, and fall back gracefully without one', async () => {
    const { orderConfirmationEmail, shippingNotificationEmail, deliveryNotificationEmail, payoutConfirmationEmail } = await import('../../../services/api/src/modules/email/templates.js');
    const noName1 = orderConfirmationEmail({ recipientName: null, orderId: 'LP-1', items: [], total: 0, currencyCode: 'USD' });
    const noName2 = shippingNotificationEmail({ recipientName: null, orderId: 'LP-1', trackingNumber: null });
    const noName3 = deliveryNotificationEmail({ recipientName: null, orderId: 'LP-1' });
    const noName4 = payoutConfirmationEmail({ recipientName: null, amount: 10, currencyCode: 'USD', subOrderCount: 1 });
    for (const { html } of [noName1, noName2, noName3, noName4]) {
      expect(html).toContain('Hi,');
      expect(html).not.toContain('null');
    }
  });
});
