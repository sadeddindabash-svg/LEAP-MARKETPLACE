require('dotenv').config();

/// Central place to read environment variables so the rest of the codebase
/// never calls process.env directly (easier to spot missing config, and
/// easier to validate at boot).
const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || 'sandbox', // 'sandbox' | 'production'
  // Amazon Payment Services (formerly PayFort) — see
  // src/modules/payment/providers/amazonPaymentServices.js for the
  // "verify before production" notes on this integration.
  apsMerchantIdentifier: process.env.APS_MERCHANT_IDENTIFIER || '',
  apsAccessCode: process.env.APS_ACCESS_CODE || '',
  apsShaRequestPhrase: process.env.APS_SHA_REQUEST_PHRASE || '',
  apsShaResponsePhrase: process.env.APS_SHA_RESPONSE_PHRASE || '',
  apsApiBaseUrl: process.env.APS_API_BASE_URL || '', // confirm sandbox vs production URL from your APS dashboard
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  // Real, new -- master key used to encrypt/decrypt real payment
  // provider credentials (migration 065) at rest in the database.
  // Must be a real, random 32-byte value in production (e.g.
  // `openssl rand -hex 32`) -- this dev-only fallback exists purely
  // so local development doesn't require generating one immediately.
  credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY || 'dev-only-insecure-encryption-key-change-me-32b',
};

function assertRequiredEnvInProduction() {
  if (env.nodeEnv !== 'production') return;
  const required = ['databaseUrl', 'stripeSecretKey', 'jwtSecret', 'credentialsEncryptionKey'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
  // Real, stronger check specifically for this one key -- it protects
  // real financial provider credentials at rest, so a silently-used
  // dev-default value here is a real security failure, not just a
  // missing-config one. A plain presence check above wouldn't catch
  // this, since the dev fallback itself is a real, truthy string.
  if (env.credentialsEncryptionKey === 'dev-only-insecure-encryption-key-change-me-32b') {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is still set to its insecure development default in production. Generate a real one (e.g. `openssl rand -hex 32`) before starting.');
  }
}

module.exports = { env, assertRequiredEnvInProduction };
