// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { evaluate, summarize, urlProblem, KNOWN_DEFAULT_PASSWORDS } = require('../../../services/api/scripts/launchChecks.js');

const STRONG = 'Zq3x'.repeat(10);
const READY_ENV = {
  NODE_ENV: 'production', JWT_SECRET: STRONG, CREDENTIALS_ENCRYPTION_KEY: `${STRONG}k`,
  PUBLIC_API_URL: 'https://api.leapautoparts.com', STOREFRONT_URL: 'https://www.leapautoparts.com', SUPPLIER_PORTAL_URL: 'https://suppliers.leapautoparts.com',
  SMTP_HOST: 'smtp.resend.com', SMTP_PORT: '587', SMTP_USER: 'resend', SMTP_PASSWORD: 'secret', SMTP_FROM_EMAIL: 'noreply@leapautoparts.com',
  STRIPE_SECRET_KEY: 'sk_live_abc', TRACK17_WEBHOOK_SECRET: STRONG, TRACK17_API_KEY: 'k', FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
  S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's', GOOGLE_TRANSLATE_API_KEY: 'g',
};
const CLEAN_FACTS = { pendingMigrations: [], databaseName: 'leap_marketplace', defaultPasswordAccounts: [], testAdminAccounts: 0, testAccounts: 0,
  testData: { orders: 0, products: 0, categories: 0, hubs: 0 }, fakeReviewProducts: [], ownersWithoutTwoFactor: [], realHubs: 2 };

const run = (facts = {}, env = {}) => Object.fromEntries(evaluate({ ...CLEAN_FACTS, ...facts }, { ...READY_ENV, ...env }).map((r) => [r.id, r]));
const levelOf = (results, id) => results[id].level;

describe('the launch-readiness rules (pure)', () => {
  it('CRITICAL: a properly set up installation has no blockers and no warnings', () => {
    const results = evaluate(CLEAN_FACTS, READY_ENV);
    expect(summarize(results)).toMatchObject({ fail: 0, warn: 0 });
    expect(results.length).toBeGreaterThan(20);
  });

  it('CRITICAL: JWT secret: missing, the public default, or short is a BLOCKER; strong passes', () => {
    for (const bad of [undefined, '', 'dev-only-insecure-secret-change-me', 'short']) expect(levelOf(run({}, { JWT_SECRET: bad }), 'jwt'), String(bad)).toBe('fail');
    expect(levelOf(run(), 'jwt')).toBe('pass');
    for (const bad of [undefined, 'dev-only-insecure-encryption-key-change-me-32b', 'short']) expect(levelOf(run({}, { CREDENTIALS_ENCRYPTION_KEY: bad }), 'credentialsKey'), String(bad)).toBe('fail');
  });

  it('CRITICAL: accounts still using a password from the source code, and test admins, are BLOCKERS and are named; test buyers and test data are warnings', () => {
    const r = run({ defaultPasswordAccounts: [{ email: 'admin@leap.dev', role: 'admin' }, { email: 'hub@leap.dev', role: 'hub_staff' }], testAdminAccounts: 147, testAccounts: 5000, testData: { orders: 10, products: 5, categories: 2, hubs: 3 } });
    expect(levelOf(r, 'defaultPasswords')).toBe('fail');
    expect(r.defaultPasswords.title).toContain('admin@leap.dev (admin)');
    expect(r.defaultPasswords.title).toContain('hub@leap.dev (hub_staff)');
    expect(levelOf(r, 'testAdmins')).toBe('fail');
    expect(levelOf(r, 'testAccounts')).toBe('warn');
    expect(levelOf(r, 'testData')).toBe('warn');
    expect(r.testData.title).toContain('10 orders, 5 products, 2 categories, 3 hubs');
  });

  it('CRITICAL: public addresses must be https and not point at a private computer; the three addresses are each checked', () => {
    const cases = { 'http://api.leapautoparts.com': 'does not start with https://', 'https://localhost:4000': 'private address', 'https://192.168.0.210:4000': 'private address', 'https://10.0.0.5': 'private address',
      'https://172.20.1.1': 'private address', 'https://myserver.local': 'private address', 'not a url': 'not a valid address', '': 'is not set', undefined: 'is not set' };
    for (const [value, reason] of Object.entries(cases)) {
      expect(urlProblem(value === 'undefined' ? undefined : value), value).toContain(reason);
    }
    expect(urlProblem('https://api.leapautoparts.com')).toBeNull();
    expect(urlProblem('https://172.32.1.1')).toBeNull();                                // 172.32 is public (only 172.16 to 172.31 is private)
    for (const key of ['PUBLIC_API_URL', 'STOREFRONT_URL', 'SUPPLIER_PORTAL_URL']) {
      expect(levelOf(run({}, { [key]: 'http://localhost:4000' }), `url:${key}`), key).toBe('fail');
      expect(levelOf(run({}, { [key]: undefined }), `url:${key}`), key).toBe('fail');
    }
  });

  it('CRITICAL: email: not configured, or still the fake test inbox, is a BLOCKER', () => {
    expect(levelOf(run({}, { SMTP_HOST: undefined }), 'email')).toBe('fail');
    expect(run({}, { SMTP_HOST: undefined, SMTP_PASSWORD: undefined }).email.title).toContain('SMTP_HOST, SMTP_PASSWORD');
    for (const host of ['127.0.0.1', 'localhost', '::1']) expect(levelOf(run({}, { SMTP_HOST: host }), 'email'), host).toBe('fail');
    for (const from of ['noreply@leap.test', 'x@example.com']) expect(levelOf(run({}, { SMTP_FROM_EMAIL: from }), 'email'), from).toBe('fail');
    expect(levelOf(run(), 'email')).toBe('pass');
  });

  it('CRITICAL: payments: nothing, or only TEST keys, is a BLOCKER; any one LIVE provider passes', () => {
    const none = { STRIPE_SECRET_KEY: undefined, PAYPAL_CLIENT_ID: undefined, PAYPAL_CLIENT_SECRET: undefined, APS_MERCHANT_IDENTIFIER: undefined };
    expect(levelOf(run({}, none), 'payment')).toBe('fail');
    expect(run({}, none).payment.title).toContain('No payment provider');
    expect(levelOf(run({}, { STRIPE_SECRET_KEY: 'sk_test_abc' }), 'payment')).toBe('fail');
    expect(run({}, { STRIPE_SECRET_KEY: 'sk_test_abc' }).payment.title).toContain('TEST / sandbox');                       // the right reason, not just "a failure"
    expect(run({}, { ...none, PAYPAL_CLIENT_ID: 'a', PAYPAL_CLIENT_SECRET: 'b', PAYPAL_ENVIRONMENT: 'sandbox' }).payment.title).toContain('TEST / sandbox');
    expect(levelOf(run({}, { ...none, PAYPAL_CLIENT_ID: 'a', PAYPAL_CLIENT_SECRET: 'b', PAYPAL_ENVIRONMENT: 'production' }), 'payment')).toBe('pass');
    const aps = { ...none, APS_MERCHANT_IDENTIFIER: 'm', APS_ACCESS_CODE: 'c', APS_SHA_REQUEST_PHRASE: 'r', APS_SHA_RESPONSE_PHRASE: 'p' };
    expect(run({}, { ...aps, APS_API_BASE_URL: 'https://sbpaymentservices.payfort.com/FortAPI/paymentApi' }).payment.title).toContain('TEST / sandbox');
    expect(levelOf(run({}, { ...aps, APS_API_BASE_URL: 'https://paymentservices.payfort.com/FortAPI/paymentApi' }), 'payment')).toBe('pass');
    expect(levelOf(run(), 'payment')).toBe('pass');                                     // live Stripe key
    // the server's own rule: it will not start in production without a Stripe key, even when another provider is live
    expect(levelOf(run({}, { ...none, PAYPAL_CLIENT_ID: 'a', PAYPAL_CLIENT_SECRET: 'b', PAYPAL_ENVIRONMENT: 'production' }), 'stripeRequired')).toBe('warn');
  });

  it('the tracking secret, migrations, fake reviews, 2FA, hubs, push, storage and translation are judged as described', () => {
    expect(levelOf(run({}, { TRACK17_WEBHOOK_SECRET: 'test_webhook_secret_for_dev_only' }), 'trackingSecret')).toBe('fail');
    expect(levelOf(run({}, { TRACK17_WEBHOOK_SECRET: undefined }), 'trackingSecret')).toBe('fail');
    expect(levelOf(run({ pendingMigrations: ['102_x.sql'] }), 'migrations')).toBe('fail');
    expect(levelOf(run({ fakeReviewProducts: [{ id: 'p1', shown: 812, real: 51 }] }), 'fakeReviews')).toBe('warn');
    expect(run({ fakeReviewProducts: [{ id: 'p1', shown: 812, real: 51 }] }).fakeReviews.title).toContain('p1 shows 812, has 51');
    expect(levelOf(run({ ownersWithoutTwoFactor: ['admin@leap.dev'] }), 'twoFactor')).toBe('warn');
    expect(levelOf(run({ realHubs: 0 }), 'realHub')).toBe('warn');
    expect(levelOf(run({ databaseName: 'leap_marketplace_dev' }), 'database')).toBe('warn');
    for (const [id, key] of [['push', 'FIREBASE_SERVICE_ACCOUNT_JSON'], ['storage', 'S3_BUCKET'], ['translation', 'GOOGLE_TRANSLATE_API_KEY'], ['tracking', 'TRACK17_API_KEY']]) expect(levelOf(run({}, { [key]: undefined }), id), id).toBe('warn');
    expect(levelOf(run({}, { NODE_ENV: 'development' }), 'environment')).toBe('warn');
  });

  it('every blocker and warning says WHY and HOW to fix it, and the report never contains a password', () => {
    const all = evaluate({ ...CLEAN_FACTS, defaultPasswordAccounts: [{ email: 'admin@leap.dev', role: 'admin' }], testAdminAccounts: 1, pendingMigrations: ['x'], fakeReviewProducts: [{ id: 'p1', shown: 9, real: 1 }], ownersWithoutTwoFactor: ['a@b.c'], realHubs: 0, testAccounts: 1, testData: { orders: 1, products: 0, categories: 0, hubs: 0 } }, {});
    for (const r of all.filter((x) => x.level !== 'pass')) { expect(r.why, r.id).toBeTruthy(); expect(r.fix, r.id).toBeTruthy(); }
    const text = JSON.stringify(all);
    for (const password of KNOWN_DEFAULT_PASSWORDS) expect(text).not.toContain(password);
    expect(summarize(all).fail).toBeGreaterThan(5);
  });
});
