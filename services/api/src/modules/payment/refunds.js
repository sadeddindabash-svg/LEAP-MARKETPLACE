const db = require('../../../db/pool');
const { getProviderCredentials } = require('../paymentProviders/routes');
const { toGatewayAmount } = require('./currency');
const aps = require('./providers/amazonPaymentServices');

/**
 * Gives money back for one cancelled part of an order, through the provider the buyer paid with (confirmed with the person via mockup:
 * Orders > Rules > Refund automatically). Returns { ok: true, reference, provider, note } or { ok: false, error }.
 *
 * Which payment: the order's successful row in payment_transactions. The part's share of it is refunded (the part's value / the order's
 * value, applied to what was actually paid, in the currency it was paid in).
 * No successful payment for the order = no money was taken, so there is nothing to give back: ok, reference 'no-payment-taken'.
 *
 * NOT TESTED AGAINST A REAL ACCOUNT (same as the payment code itself): Stripe refunds.create, PayPal refund of the order's capture,
 * Amazon Payment Services REFUND command. Try one refund with the sandbox keys from the Payment Providers page before relying on it.
 * Any error is returned (never thrown), so the caller can pass the refund to the admin.
 */
const PAID = ['succeeded', 'captured', 'completed', 'paid', 'success'];
const timeoutFetch = async (url, options, ms = 15000) => {
  const controller = new AbortController(); const id = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(id); }
};

async function paymentFor(orderId) {
  const { rows } = await db.query('SELECT * FROM payment_transactions WHERE order_id = $1 ORDER BY id DESC', [orderId]);
  return rows.find((r) => PAID.includes(String(r.status || '').toLowerCase())) || null;
}

async function shareOf(orderId, partUsd, paid) {
  const { rows } = await db.query('SELECT COALESCE(SUM(oli.unit_price * oli.quantity), 0) AS total FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1 AND (so.reassigned_to_sub_order_id IS NULL OR so.refund_needed_amount IS NOT NULL)', [orderId]);
  const totalUsd = Number(rows[0].total);
  const ratio = totalUsd > 0 ? Math.min(1, partUsd / totalUsd) : 1;
  return Number((Number(paid.amount) * ratio).toFixed(2));
}

async function stripeRefund(tx, amount) {
  const creds = await getProviderCredentials('stripe');
  if (!creds?.secretKey) return { ok: false, error: 'Stripe is not set up in Payment Providers.' };
  const Stripe = require('stripe');
  const stripe = new Stripe(creds.secretKey);
  const { amount: minor } = toGatewayAmount(amount, tx.currency_code);
  const refund = await stripe.refunds.create({ payment_intent: tx.gateway_reference, amount: minor });
  return { ok: refund.status === 'succeeded' || refund.status === 'pending', reference: refund.id, error: refund.status === 'failed' ? 'Stripe refused the refund.' : null };
}

async function paypalRefund(tx, amount) {
  const creds = await getProviderCredentials('paypal');
  if (!creds?.clientId || !creds?.clientSecret) return { ok: false, error: 'PayPal is not set up in Payment Providers.' };
  const sdk = require('@paypal/paypal-server-sdk');
  const { env } = require('../../config/env');
  const client = new sdk.Client({ clientCredentialsAuthCredentials: { oAuthClientId: creds.clientId, oAuthClientSecret: creds.clientSecret }, environment: env.paypalEnvironment === 'production' ? sdk.Environment.Production : sdk.Environment.Sandbox });
  const orders = new sdk.OrdersController(client);
  const getOrder = orders.getOrder ? (a) => orders.getOrder(a) : (a) => orders.ordersGet(a);      // the method's name differs between SDK versions
  const order = (await getOrder({ id: tx.gateway_reference })).result;
  const capture = order?.purchaseUnits?.[0]?.payments?.captures?.[0];
  if (!capture?.id) return { ok: false, error: 'PayPal: no captured payment found for this order.' };
  const payments = new sdk.PaymentsController(client);
  const refundCall = payments.refundCapturedPayment ? (a) => payments.refundCapturedPayment(a) : (a) => payments.capturesRefund(a);
  const value = ['HUF', 'JPY', 'TWD'].includes(String(tx.currency_code).toUpperCase()) ? String(Math.round(amount)) : amount.toFixed(2);
  const refund = (await refundCall({ captureId: capture.id, body: { amount: { currencyCode: tx.currency_code.toUpperCase(), value } } })).result;
  return { ok: ['COMPLETED', 'PENDING'].includes(refund?.status), reference: refund?.id || null, error: refund?.status ? `PayPal answered ${refund.status}.` : 'PayPal did not answer.' };
}

async function apsRefund(tx, amount) {
  const creds = await getProviderCredentials('amazon_payment_services');
  if (!creds?.merchantIdentifier || !creds?.accessCode || !creds?.shaRequestPhrase || !creds?.apiBaseUrl) return { ok: false, error: 'Amazon Payment Services is not fully set up in Payment Providers.' };
  const { amount: minor } = toGatewayAmount(amount, tx.currency_code);
  const params = { command: 'REFUND', access_code: creds.accessCode, merchant_identifier: creds.merchantIdentifier, merchant_reference: tx.gateway_reference, amount: String(minor), currency: tx.currency_code.toUpperCase(), language: 'en' };
  const response = await timeoutFetch(`${creds.apiBaseUrl}/FortAPI/paymentApi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, signature: aps.buildSignature(params, creds.shaRequestPhrase) }) });
  const data = await response.json();
  const ok = String(data.status) === '06' || /success/i.test(String(data.response_message || ''));      // APS: status 06 = refund success
  return { ok, reference: data.fort_id || null, error: ok ? null : `Amazon Payment Services: ${data.response_message || data.status || 'no answer'}` };
}

async function refundPart({ orderId, amountUsd }) {
  try {
    const tx = await paymentFor(orderId);
    if (!tx) return { ok: true, reference: 'no-payment-taken', provider: null, note: 'No payment was taken for this order, so nothing had to be given back.' };
    const amount = await shareOf(orderId, amountUsd, tx);
    const call = { stripe: stripeRefund, google_pay: stripeRefund, paypal: paypalRefund, amazon_payment_services: apsRefund }[tx.provider];
    if (!call) return { ok: false, error: `Automatic refunds are not available for ${tx.provider}.` };
    const r = await call(tx, amount);
    return r.ok ? { ok: true, reference: r.reference || `${tx.provider}-refund`, provider: tx.provider, note: `${amount.toFixed(2)} ${tx.currency_code} back through ${tx.provider}` } : { ok: false, error: r.error || 'The refund was not accepted.', provider: tx.provider };
  } catch (err) {
    return { ok: false, error: `The refund could not be sent: ${err.message}` };
  }
}

module.exports = { refundPart };
