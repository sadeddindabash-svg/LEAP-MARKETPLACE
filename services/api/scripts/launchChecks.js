/**
 * The launch-readiness rules, as PURE functions: given the facts found in the database and the settings (environment variables), say what is
 * fine, what is a warning and what BLOCKS going live. check-launch-readiness.js gathers the facts and prints the result.
 *
 *   fail = do not go live until this is fixed (a security hole, or something that will visibly break for customers)
 *   warn = should be dealt with, but will not by itself hurt on day one
 *   pass = fine
 */
const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';
const DEV_CREDENTIALS_KEY = 'dev-only-insecure-encryption-key-change-me-32b';
const DEV_WEBHOOK_SECRET = 'test_webhook_secret_for_dev_only';

// Passwords the project ships with or its tests use: they are in the source code, so anyone can try them.
const KNOWN_DEFAULT_PASSWORDS = ['admin_dev_password_123', 'supplier_dev_password_123', 'hub_dev_password_123', 'test_password_123', 'limited_pass_123', 'LeapSupplier2026!'];

const isSet = (value) => typeof value === 'string' && value.trim() !== '';

// Why an address cannot be used by the public, or null when it can.
function urlProblem(value) {
  if (!isSet(value)) return 'is not set';
  let url;
  try { url = new URL(value); } catch { return 'is not a valid address'; }
  if (url.protocol !== 'https:') return 'does not start with https://';
  const host = url.hostname;
  if (host === 'localhost' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /\.local$/.test(host)) return `points at a private address (${host})`;
  return null;
}

function evaluate(facts, env) {
  const results = [];
  const add = (level, id, title, why, fix) => results.push({ id, level, title, why: why || null, fix: fix || null });
  const secretFix = 'Generate a random value and set it on the server, e.g.: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';

  // ---------- the running environment ----------
  if (env.NODE_ENV === 'production') add('pass', 'environment', 'NODE_ENV is production');
  else add('warn', 'environment', `NODE_ENV is "${env.NODE_ENV || 'development'}" on this machine`, 'The server must run with NODE_ENV=production: that switches on the start-up safety checks.', 'Set NODE_ENV=production in the server\'s environment.');

  // ---------- secrets ----------
  if (!isSet(env.JWT_SECRET) || env.JWT_SECRET === DEV_JWT_SECRET) add('fail', 'jwt', 'JWT_SECRET is missing or is the public development default', 'It signs every login. The default is in the source code, so anyone could forge a login for ANY account, including the admin\'s.', secretFix);
  else if (env.JWT_SECRET.length < 32) add('fail', 'jwt', 'JWT_SECRET is too short (under 32 characters)', 'A short secret can be guessed.', secretFix);
  else add('pass', 'jwt', 'JWT_SECRET is set and strong');

  if (!isSet(env.CREDENTIALS_ENCRYPTION_KEY) || env.CREDENTIALS_ENCRYPTION_KEY === DEV_CREDENTIALS_KEY) add('fail', 'credentialsKey', 'CREDENTIALS_ENCRYPTION_KEY is missing or is the public development default', 'It protects the payment provider credentials stored in the database.', 'Generate one: openssl rand -hex 32');
  else if (env.CREDENTIALS_ENCRYPTION_KEY.length < 32) add('fail', 'credentialsKey', 'CREDENTIALS_ENCRYPTION_KEY is too short (under 32 characters)', null, 'Generate one: openssl rand -hex 32');
  else add('pass', 'credentialsKey', 'CREDENTIALS_ENCRYPTION_KEY is set and strong');

  // ---------- accounts ----------
  if (facts.defaultPasswordAccounts.length > 0) {
    add('fail', 'defaultPasswords', `${facts.defaultPasswordAccounts.length} account(s) still use a password from the source code: ${facts.defaultPasswordAccounts.map((a) => `${a.email} (${a.role})`).join(', ')}`,
      'These passwords are public (they are written in the project files and its tests). Anyone could sign in as an admin, supplier or hub worker.', 'Change each one (admin portal: Hub staff / Admin users, or "forgot password"), or remove the account.');
  } else add('pass', 'defaultPasswords', 'No admin, supplier or hub account uses a known default password');

  if (facts.testAdminAccounts > 0) add('fail', 'testAdmins', `${facts.testAdminAccounts} admin account(s) were created by the automated tests`, 'Their passwords are known (they are written in the test files in the project).', 'node scripts/remove-test-data.js (preview), then --apply.');
  else add('pass', 'testAdmins', 'No admin accounts left over from the tests');

  if (facts.testAccounts > 0) add('warn', 'testAccounts', `${facts.testAccounts} buyer / staff account(s) with an @example.com address (test accounts)`, 'Clutter, and test hub staff have known passwords.', 'node scripts/remove-test-data.js (preview), then --apply.');
  else add('pass', 'testAccounts', 'No @example.com test accounts');

  const td = facts.testData;
  const tdTotal = td.orders + td.products + td.categories + td.hubs;
  if (tdTotal > 0) add('warn', 'testData', `Test data is still in the database: ${td.orders} orders, ${td.products} products, ${td.categories} categories, ${td.hubs} hubs`, 'Customers would see test products and the admin\'s numbers are inflated.', 'node scripts/remove-test-data.js (preview), then --apply. Take a backup first.');
  else add('pass', 'testData', 'No test orders, products, categories or hubs');

  if (facts.fakeReviewProducts.length > 0) add('warn', 'fakeReviews', `${facts.fakeReviewProducts.length} product(s) show review counts that are not real: ${facts.fakeReviewProducts.slice(0, 4).map((p) => `${p.id} shows ${p.shown}, has ${p.real}`).join('; ')}`, 'The seed products carry invented ratings ("4.6 stars, 812 reviews"). Buyers would be told something untrue.', 'Set rating and review_count of these products to their real values (or 0).');
  else add('pass', 'fakeReviews', 'Product review counts match the real reviews');

  if (facts.unpriceableProducts.length > 0) add('warn', 'unpriceableProducts', `${facts.unpriceableProducts.length} active product(s) cannot be priced, so buyers cannot see them: ${facts.unpriceableProducts.slice(0, 4).map((p) => `${p.id} (${p.category} / ${p.part})`).join('; ')}`, 'A product needs a weight and a size to work out its shipping fee: its own, or its part\'s. With neither, it is left out of every product list and its page says "not found".', 'In the admin portal open Categories, the category, and set the weight and size of the part (or give the product its own).');
  else add('pass', 'unpriceableProducts', 'Every active product can be priced');

  if (facts.ownersWithoutTwoFactor.length > 0) add('warn', 'twoFactor', `The owner account(s) without two-factor sign-in: ${facts.ownersWithoutTwoFactor.join(', ')}`, 'The owner can do everything, so a stolen password is a total loss.', 'Sign in to the admin portal and turn two-factor on.');
  else add('pass', 'twoFactor', 'Every owner account has two-factor sign-in');

  if (facts.realHubs === 0) add('warn', 'realHub', 'There is no real inspection hub in the database', 'Orders cannot be assigned to a hub.', 'Add your hub(s) in the admin portal.');
  else add('pass', 'realHub', `${facts.realHubs} real hub(s) set up`);

  // ---------- database ----------
  if (facts.pendingMigrations.length > 0) add('fail', 'migrations', `${facts.pendingMigrations.length} database migration(s) have not been applied: ${facts.pendingMigrations.slice(0, 3).join(', ')}`, 'The code expects tables and columns that are not there yet.', 'node db/migrate.js (the start script does this).');
  else add('pass', 'migrations', 'The database is up to date');

  if (/_(dev|test)$/i.test(facts.databaseName || '')) add('warn', 'database', `The database is named "${facts.databaseName}" (a development name)`, 'Not wrong by itself, but easy to confuse with a test database.', 'Use a database named for production, e.g. leap_marketplace.');
  else add('pass', 'database', 'The database name is not a development name');

  // ---------- public addresses ----------
  for (const [key, label, why] of [
    ['PUBLIC_API_URL', 'PUBLIC_API_URL', 'The password-reset button and the courier QR codes use it: a phone cannot open an address that points at your own computer.'],
    ['STOREFRONT_URL', 'STOREFRONT_URL', 'The buyer welcome email links here.'],
    ['SUPPLIER_PORTAL_URL', 'SUPPLIER_PORTAL_URL', 'Supplier emails link here.'],
  ]) {
    const problem = urlProblem(env[key]);
    if (problem) add('fail', `url:${key}`, `${label} ${problem}`, why, `Set ${key} to your public https:// address.`);
    else add('pass', `url:${key}`, `${label} is a public https address`);
  }

  // ---------- email ----------
  const smtpMissing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL'].filter((k) => !isSet(env[k]));
  const smtpLocal = isSet(env.SMTP_HOST) && /^(localhost|127\.|::1|0\.0\.0\.0)/.test(env.SMTP_HOST);
  const fakeFrom = isSet(env.SMTP_FROM_EMAIL) && /@(leap\.test|example\.(com|org|net)|localhost)$/i.test(env.SMTP_FROM_EMAIL);
  if (smtpMissing.length > 0) add('fail', 'email', `Email is not configured (missing ${smtpMissing.join(', ')})`, 'Password reset, order confirmations and every other email would only be printed in the server log. Buyers could not recover their accounts.', 'Set the SMTP_* settings from your email provider (see .env.example) and verify your domain (SPF/DKIM).');
  else if (smtpLocal || fakeFrom) add('fail', 'email', 'Email still points at the fake test inbox (Mailpit / a test address)', 'Nothing would reach a real mailbox.', 'Use your real provider\'s SMTP details and a sender address on your own domain.');
  else add('pass', 'email', 'Email is configured with a real provider');

  // ---------- payments ----------
  const stripeLive = isSet(env.STRIPE_SECRET_KEY) && /^sk_live_/.test(env.STRIPE_SECRET_KEY);
  const stripeTest = isSet(env.STRIPE_SECRET_KEY) && !stripeLive;
  const paypalSet = isSet(env.PAYPAL_CLIENT_ID) && isSet(env.PAYPAL_CLIENT_SECRET);
  const paypalLive = paypalSet && env.PAYPAL_ENVIRONMENT === 'production';
  const apsSet = ['APS_MERCHANT_IDENTIFIER', 'APS_ACCESS_CODE', 'APS_SHA_REQUEST_PHRASE', 'APS_SHA_RESPONSE_PHRASE', 'APS_API_BASE_URL'].every((k) => isSet(env[k]));
  const apsSandbox = apsSet && /sandbox|sbcheckout|sbpaymentservices/i.test(env.APS_API_BASE_URL);
  if (stripeLive || paypalLive || (apsSet && !apsSandbox)) {
    add('pass', 'payment', `A live payment provider is configured (${[stripeLive && 'Stripe', paypalLive && 'PayPal', apsSet && !apsSandbox && 'Amazon Payment Services'].filter(Boolean).join(', ')})`);
  } else if (stripeTest || (paypalSet && !paypalLive) || apsSandbox) {
    add('fail', 'payment', 'Only TEST / sandbox payment keys are configured', 'Customers could not really pay (or nothing real would be charged).', 'Put the live keys on the server: Stripe sk_live_..., PayPal with PAYPAL_ENVIRONMENT=production, or the production APS URL.');
  } else add('fail', 'payment', 'No payment provider is configured', 'Customers could not pay.', 'Set the live keys of at least one provider (STRIPE_SECRET_KEY, PAYPAL_*, or APS_*).');
  if (!isSet(env.STRIPE_SECRET_KEY)) add('warn', 'stripeRequired', 'STRIPE_SECRET_KEY is empty, but the server REFUSES to start in production without it', 'The start-up check lists Stripe as required even if you only use another provider, so the server would not start.', 'Either set it, or ask for that rule to change to "at least one provider".');

  // ---------- tracking, push, files, translation ----------
  if (!isSet(env.TRACK17_WEBHOOK_SECRET) || env.TRACK17_WEBHOOK_SECRET === DEV_WEBHOOK_SECRET) add('fail', 'trackingSecret', 'TRACK17_WEBHOOK_SECRET is missing or the test value', 'Anyone could send fake "delivered" updates to your server.', secretFix);
  else add('pass', 'trackingSecret', 'The tracking webhook secret is set');
  if (!isSet(env.TRACK17_API_KEY)) add('warn', 'tracking', 'TRACK17_API_KEY is not set', 'No live courier tracking: the timeline shows only the hub\'s own steps.', 'Add your 17TRACK API key.');
  else add('pass', 'tracking', 'Live courier tracking is configured');
  if (!isSet(env.FIREBASE_SERVICE_ACCOUNT_JSON)) add('warn', 'push', 'Push notifications are not configured (FIREBASE_SERVICE_ACCOUNT_JSON)', 'Buyers get in-app notices only, no phone alerts.', 'Add your Firebase service account.');
  else add('pass', 'push', 'Push notifications are configured');
  const s3Missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((k) => !isSet(env[k]));
  if (s3Missing.length > 0) add('warn', 'storage', 'Uploaded photos are kept on the server\'s own disk (no S3 storage configured)', 'Product, evidence and proof-of-delivery photos would be lost if the server is replaced, and are not backed up.', 'Configure S3 (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION) or back up the uploads folder.');
  else add('pass', 'storage', 'Uploaded photos go to S3');
  if (!isSet(env.GOOGLE_TRANSLATE_API_KEY)) add('warn', 'translation', 'GOOGLE_TRANSLATE_API_KEY is not set', 'Supplier products would not be translated automatically.', 'Add the key, or translate products by hand.');
  else add('pass', 'translation', 'Automatic translation is configured');

  return results;
}

function summarize(results) {
  return { fail: results.filter((r) => r.level === 'fail').length, warn: results.filter((r) => r.level === 'warn').length, pass: results.filter((r) => r.level === 'pass').length };
}

module.exports = { evaluate, summarize, urlProblem, KNOWN_DEFAULT_PASSWORDS, DEV_JWT_SECRET, DEV_CREDENTIALS_KEY, DEV_WEBHOOK_SECRET };
