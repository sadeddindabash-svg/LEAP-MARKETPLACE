/**
 * Real, single source of truth for which real credential fields each
 * known payment provider needs. Used both to validate what's saved
 * (server-side) and to let the admin portal's own real "set up" page
 * render the correct real form fields per provider dynamically,
 * rather than hardcoding each provider's own shape into the frontend
 * separately.
 *
 * `key`: the real field name stored in the encrypted JSON blob.
 * `label`: real, human-readable label for the admin form.
 * `secret`: true if this real field should be masked in the admin UI
 *   after saving (e.g. "••••1234"), false for non-secret identifiers
 *   that are safe to show in full (e.g. a Merchant Identifier).
 */
const PROVIDER_FIELD_SCHEMAS = {
  stripe: {
    label: 'Stripe',
    fields: [
      { key: 'secretKey', label: 'Secret Key', secret: true },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', secret: true },
    ],
  },
  paypal: {
    label: 'PayPal',
    fields: [
      { key: 'clientId', label: 'Client ID', secret: false },
      { key: 'clientSecret', label: 'Client Secret', secret: true },
    ],
  },
  amazon_payment_services: {
    label: 'Amazon Payment Services',
    fields: [
      { key: 'merchantIdentifier', label: 'Merchant Identifier', secret: false },
      { key: 'accessCode', label: 'Access Code', secret: false },
      { key: 'shaRequestPhrase', label: 'SHA Request Phrase', secret: true },
      { key: 'shaResponsePhrase', label: 'SHA Response Phrase', secret: true },
      { key: 'apiBaseUrl', label: 'API Base URL (sandbox or production, from your APS dashboard)', secret: false },
    ],
  },
  // Real, new -- not yet wired to an actual gateway call (Phase 3),
  // but the real credential storage/admin UI already supports it.
  alipay: {
    label: 'Alipay',
    fields: [
      { key: 'appId', label: 'App ID', secret: false },
      { key: 'privateKey', label: 'Merchant Private Key', secret: true },
      { key: 'alipayPublicKey', label: "Alipay's Public Key", secret: false },
    ],
  },
  wechat_pay: {
    label: 'WeChat Pay',
    fields: [
      { key: 'appId', label: 'App ID', secret: false },
      { key: 'mchId', label: 'Merchant ID', secret: false },
      { key: 'apiKey', label: 'API Key', secret: true },
    ],
  },
  tabby: {
    label: 'Tabby',
    fields: [
      { key: 'publicKey', label: 'Public Key', secret: false },
      { key: 'secretKey', label: 'Secret Key', secret: true },
    ],
  },
  tamara: {
    label: 'Tamara',
    fields: [
      { key: 'apiToken', label: 'API Token', secret: true },
    ],
  },
};

function getProviderSchema(providerId) {
  return PROVIDER_FIELD_SCHEMAS[providerId] || null;
}

module.exports = { PROVIDER_FIELD_SCHEMAS, getProviderSchema };
