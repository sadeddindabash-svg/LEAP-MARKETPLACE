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
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
};

function assertRequiredEnvInProduction() {
  if (env.nodeEnv !== 'production') return;
  const required = ['databaseUrl', 'stripeSecretKey', 'jwtSecret'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
}

module.exports = { env, assertRequiredEnvInProduction };
