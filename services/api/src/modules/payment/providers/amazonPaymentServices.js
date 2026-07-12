const crypto = require('crypto');
const { env } = require('../../../config/env');

/**
 * Amazon Payment Services (APS) — formerly PayFort before Amazon's
 * acquisition. Chosen as a provider because the business already uses it
 * successfully on their existing website, and it has strong native support
 * for MENA payment methods (Mada, meeza, local cards) that Stripe covers
 * less completely — a good fit given 7 of our 40 launch markets are
 * GCC/Jordan.
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
 * sandbox environment as the first next step.
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

function isConfigured() {
  return Boolean(env.apsMerchantIdentifier && env.apsAccessCode && env.apsShaRequestPhrase);
}

/**
 * Builds (but does not send — see caller) a purchase request payload.
 * Exported separately from the network call so the payload/signature
 * logic can be unit-tested without a live connection.
 */
function buildPurchaseRequest({ merchantReference, amount, currencyCode, customerEmail, returnUrl, language = 'en' }) {
  if (!isConfigured()) {
    throw new Error('Amazon Payment Services is not configured. Set APS_MERCHANT_IDENTIFIER, APS_ACCESS_CODE, and APS_SHA_REQUEST_PHRASE in .env');
  }
  const params = {
    command: 'PURCHASE',
    access_code: env.apsAccessCode,
    merchant_identifier: env.apsMerchantIdentifier,
    merchant_reference: merchantReference,
    amount: String(amount),
    currency: currencyCode.toUpperCase(),
    language,
    customer_email: customerEmail,
    return_url: returnUrl,
  };
  return {
    ...params,
    signature: buildSignature(params, env.apsShaRequestPhrase),
  };
}

/**
 * Sends the purchase request to APS. NOT NETWORK-TESTED — see file header.
 */
async function createPurchase(purchaseParams) {
  const payload = buildPurchaseRequest(purchaseParams);
  const baseUrl = env.apsApiBaseUrl; // TODO: confirm real sandbox/production URL
  if (!baseUrl) {
    throw new Error('APS_API_BASE_URL is not set — confirm the correct sandbox/production endpoint from your APS merchant dashboard before setting this.');
  }
  const response = await fetch(`${baseUrl}/FortAPI/paymentApi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  // Response signature verification — APS signs responses too, using the
  // separate SHA *response* phrase. Verify before trusting the response.
  if (env.apsShaResponsePhrase && data.signature) {
    const { signature: receivedSignature, ...rest } = data;
    const expectedSignature = buildSignature(rest, env.apsShaResponsePhrase);
    if (receivedSignature !== expectedSignature) {
      throw new Error('APS response signature mismatch — possible tampering or a phrase/config mismatch. Do not trust this response.');
    }
  }
  return data;
}

module.exports = { buildSignature, buildPurchaseRequest, createPurchase, isConfigured };
