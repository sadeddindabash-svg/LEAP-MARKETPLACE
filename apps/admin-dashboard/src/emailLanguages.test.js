// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { passwordResetEmail, orderConfirmationEmail, shippingNotificationEmail, deliveryNotificationEmail, welcomeEmail } = require('../../../services/api/src/modules/email/templates.js');
const { resolveEmailLang, emailSubject } = require('../../../services/api/src/modules/email/language.js');

const ARABIC = /[\u0600-\u06FF]/;
const CODE = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0a1b2';
const URL = `http://localhost:4000/reset-password?token=${CODE}`;
const ITEMS = [{ quantity: 2, name: 'Front Brake Disc', price: 39.99 }, { quantity: 1, name: 'Oil Filter', price: 12.5 }];

const ALL = {
  passwordReset: (lang) => passwordResetEmail({ recipientName: 'Sara', resetUrl: URL, expiryMinutes: 30, code: CODE, lang }),
  orderConfirmation: (lang) => orderConfirmationEmail({ recipientName: 'Sara', orderId: 'LP-200934', items: ITEMS, total: 92.48, currencyCode: 'USD', lang }),
  shipping: (lang) => shippingNotificationEmail({ recipientName: 'Sara', orderId: 'LP-200934', trackingNumber: 'HUB-777', lang }),
  delivery: (lang) => deliveryNotificationEmail({ recipientName: 'Sara', orderId: 'LP-200934', lang }),
  welcome: (lang) => welcomeEmail({ recipientName: 'Sara', lang }),
};

describe('buyer emails in English, Arabic, or both', () => {
  it.each(Object.keys(ALL))('CRITICAL: %s: English is English only, Arabic is Arabic and right-to-left, "both" carries each once', (name) => {
    const en = ALL[name]('en');
    expect(en.html).not.toMatch(ARABIC);
    expect(en.text).not.toMatch(ARABIC);
    expect(en.html).toContain('lang="en"');
    expect(en.html).not.toContain('dir="rtl"');

    const ar = ALL[name]('ar');
    expect(ar.html).toMatch(ARABIC);
    expect(ar.text).toMatch(ARABIC);
    expect(ar.html).toContain('lang="ar" dir="rtl"');
    expect(ar.html).toContain('text-align: right');
    expect(ar.html).not.toContain('Hi Sara');                              // no English greeting left in the Arabic email
    expect(ar.html).toContain('مرحبًا Sara،');

    const both = ALL[name]('both');
    expect(both.html).toContain('Hi Sara,');                              // English first...
    expect(both.html).toContain('مرحبًا Sara،');                           // ...then Arabic
    expect(both.html.indexOf('Hi Sara,')).toBeLessThan(both.html.indexOf('مرحبًا Sara،'));
    expect(both.html.match(/Hi Sara,/g)).toHaveLength(1);
    expect(both.html.match(/مرحبًا Sara،/g)).toHaveLength(1);
    expect(both.text).toContain('----------');                            // the plain-text version separates them clearly
  });

  it('with no language given an email is exactly the English one it always was', () => {
    expect(passwordResetEmail({ recipientName: null, resetUrl: URL, expiryMinutes: 45 }).html).toContain('Hi,');
    expect(deliveryNotificationEmail({ recipientName: null, orderId: 'LP-1' }).html).not.toMatch(ARABIC);
  });

  it('CRITICAL: the password reset email shows the CODE clearly, in every language, in the HTML and the plain text, beside the working link', () => {
    for (const lang of ['en', 'ar', 'both']) {
      const { html, text } = ALL.passwordReset(lang);
      expect(html).toContain(CODE);
      expect(text).toContain(CODE);
      expect(html).toContain(`href="${URL}"`);
      expect(text).toContain(URL);
      expect(html).toContain('30');                                       // the expiry, in minutes
    }
    expect(ALL.passwordReset('en').html).toContain('Or enter this code in the Leap app:');
    expect(ALL.passwordReset('ar').html).toContain('أو أدخل هذا الرمز في تطبيق Leap:');
    expect(ALL.passwordReset('ar').html).toContain('dir="ltr" style="font-family: Consolas');   // the code itself always reads left to right
  });

  it('the order confirmation keeps every amount and name right in Arabic, with no stray "undefined" or "null" anywhere', () => {
    for (const lang of ['en', 'ar', 'both']) {
      const { html, text } = ALL.orderConfirmation(lang);
      for (const fragment of ['LP-200934', 'Front Brake Disc', 'Oil Filter', '92.48 USD', '39.99 USD']) expect(html).toContain(fragment);
      expect(text).toContain('92.48 USD');
      for (const bad of ['undefined', 'null', 'NaN']) { expect(html).not.toContain(bad); expect(text).not.toContain(bad); }
    }
    expect(ALL.orderConfirmation('ar').html).toContain('تم تأكيد طلبك');
    expect(ALL.orderConfirmation('ar').html).toContain('الإجمالي: 92.48 USD');
  });

  it('the shipping email shows the tracking number (always left to right) only when there is one', () => {
    expect(ALL.shipping('ar').html).toContain('<strong dir="ltr">HUB-777</strong>');
    const without = shippingNotificationEmail({ recipientName: null, orderId: 'LP-1', trackingNumber: null, lang: 'ar' });
    expect(without.html).not.toContain('HUB');
    expect(without.html).not.toContain('null');
    expect(without.html).toContain('مرحبًا،');                             // no name: just "مرحبًا،"
  });

  it('subjects follow the language, and "both" joins them', () => {
    expect(emailSubject('orderDelivered', 'en', { orderId: 'LP-9' })).toBe('Your order has been delivered — LP-9');
    expect(emailSubject('orderDelivered', 'ar', { orderId: 'LP-9' })).toBe('تم تسليم طلبك — LP-9');
    expect(emailSubject('orderDelivered', 'both', { orderId: 'LP-9' })).toBe('Your order has been delivered — LP-9 · تم تسليم طلبك — LP-9');
    for (const kind of ['passwordReset', 'welcome', 'orderConfirmed', 'orderShipped', 'orderDelivered']) {
      expect(emailSubject(kind, 'ar', { orderId: 'LP-9' })).toMatch(ARABIC);
      expect(emailSubject(kind, 'en', { orderId: 'LP-9' })).not.toMatch(ARABIC);
    }
    expect(() => emailSubject('nonsense', 'en')).toThrow(/Unknown email kind/);
  });

  it('which language: the account\'s own, and BOTH for anyone we cannot know (a guest)', () => {
    expect(resolveEmailLang('ar')).toBe('ar');
    expect(resolveEmailLang('en')).toBe('en');
    for (const unknown of [undefined, null, '', 'fr']) expect(resolveEmailLang(unknown)).toBe('both');
  });
});
