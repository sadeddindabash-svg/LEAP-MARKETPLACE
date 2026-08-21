const crypto = require('crypto');
const { getProviderCredentials } = require('../../paymentProviders/routes');

/**
 * Amazon Payment Services (APS) — formerly PayFort before Amazon's
 * acquisition. Chosen as a provider because the business already uses it
 * successfully on their existing website, and it has strong native support
 * for MENA payment methods (Mada, meeza, local cards) that Stripe covers
 * less completely — a good fit given 7 of our 40 launch markets are
 * GCC/Jordan.
 *
 * Real, updated (migration 065/066) -- credentials now come from the
 * real, encrypted, admin-editable payment_provider_credentials table
 * (see paymentProviders/routes.js's own getProviderCredentials),
 * not static environment variables. buildSignature and
 * buildPurchaseRequest stay pure, fully unit-testable functions --
 * credentials are passed in explicitly as a real parameter now,
 * rather than read from a global env object internally.
 *
 * ============================================================
 * VERIFY BEFORE PRODUCTION — read this before trusting this file:
 * ============================================================
 * This implements the request-signing scheme historically documented for
 * PayFort's API (sort parameters alphabetically, concatenate as key=value
 * pairs, wrap with a shared secret "SHA request phrase" on both ends, hash
 * with SHA-256, uppercase the hex digest). This scheme is well-established
 * and reasonably likely to still be accurate post-rebrand, but:
 *
 *   1. The exact API base URL/endpoint path below is NOT verified against
 *      current Amazon Payment Services documentation — confirm the real
 *      sandbox and production URLs from your APS merchant dashboard.
 *   2. Field names (merchant_reference, access_code, etc.) should be
 *      double-checked against the current official API reference.
 *   3. This sandbox has NO network access to Amazon's payment API, so no
 *      live request has been made with this code. Only the signature
 *      function itself (pure computation, no network) was tested.
 *   4. Currency minor-unit handling (whether an amount needs ×100, and for
 *      which currencies) has NOT been confirmed specifically for APS —
 *      don't assume it matches Stripe's zero-decimal-currency list without
 *      checking APS's own documentation.
 *
 * Treat this as a solid structural starting point, not a verified
 * integration. Run a real sandbox transaction against Amazon's actual
 * sandbox environment as the first next step, once real credentials are
 * saved via the admin portal's Payment Providers page.
 */

/**
 * Builds the request signature APS/PayFort-style APIs expect.
 * Pure function — no network, no side effects — so it's fully testable
 * without hitting Amazon's servers.
 */
function buildSignature(params, sharedPhrase) {
  if (!sharedPhrase) {
    throw new Error('A SHA phrase (request or response) is required to build a signature');
  }
  const sortedKeys = Object.keys(params).sort();
  const concatenated = sortedKeys.map((key) => `${key}=${params[key]}`).join('');
  const signedString = `${sharedPhrase}${concatenated}${sharedPhrase}`;
  return crypto.createHash('sha256').update(signedString).digest('hex').toUpperCase();
}

async function isConfigured() {
  const creds = await getProviderCredentials('amazon_payment_services');
  return Boolean(creds?.merchantIdentifier && creds?.accessCode && creds?.shaRequestPhrase);
}

/**
 * Builds (but does not send — see caller) a purchase request payload.
 * Pure, fully unit-testable -- credentials now passed in explicitly
 * (real, migration 065/066) rather than read from env internally.
 */
function buildPurchaseRequest({ merchantReference, amount, currencyCode, customerEmail, returnUrl, language = 'en' }, credentials) {
  const params = {
    command: 'PURCHASE',
    access_code: credentials.accessCode,
    merchant_identifier: credentials.merchantIdentifier,
    merchant_reference: merchantReference,
    amount: String(amount),
    currency: currencyCode.toUpperCase(),
    language,
    customer_email: customerEmail,
    return_url: returnUrl,
  };
  return {
    ...params,
    signature: buildSignature(params, credentials.shaRequestPhrase),
  };
}

/**
 * Sends the purchase request to APS. NOT NETWORK-TESTED — see file header.
 */
async function createPurchase(purchaseParams) {
  const credentials = await getProviderCredentials('amazon_payment_services');
  if (!credentials?.merchantIdentifier || !credentials?.accessCode || !credentials?.shaRequestPhrase) {
    throw new Error('Amazon Payment Services is not configured. Set it up in the admin portal\'s Payment Providers page.');
  }
  const payload = buildPurchaseRequest(purchaseParams, credentials);
  const baseUrl = credentials.apiBaseUrl;
  if (!baseUrl) {
    throw new Error('No API Base URL saved for Amazon Payment Services — confirm the correct sandbox/production endpoint from your APS merchant dashboard and add it in the admin portal.');
  }
  // REAL BUG FOUND AND FIXED HERE, same real bug class already found
  // and fixed for the SMTP email transport, the translation API, and
  // 17TRACK elsewhere this session -- genuinely important here
  // specifically, since a real buyer is actively waiting on checkout
  // for this to complete. A slow or unreachable payment gateway could
  // otherwise hang the real checkout request indefinitely.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${baseUrl}/FortAPI/paymentApi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const data = await response.json();

  // Response signature verification — APS signs responses too, using the
  // separate SHA *response* phrase. Verify before trusting the response.
  if (credentials.shaResponsePhrase && data.signature) {
    const { signature: receivedSignature, ...rest } = data;
    const expectedSignature = buildSignature(rest, credentials.shaResponsePhrase);
    if (receivedSignature !== expectedSignature) {
      throw new Error('APS response signature mismatch — possible tampering or a phrase/config mismatch. Do not trust this response.');
    }
  }
  return data;
}

module.exports = { buildSignature, buildPurchaseRequest, createPurchase, isConfigured };
