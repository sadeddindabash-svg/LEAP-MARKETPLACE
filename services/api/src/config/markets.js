/**
 * Confirmed Phase 1 launch-market list (40 countries), as given by the
 * business. This REPLACES the earlier 75-country / 5-wave draft — see git
 * history if that broader roadmap list is needed again later. Mirrors
 * apps/mobile/lib/core/config/app_config.dart — keep both in sync.
 *
 * Regions covered: GCC + Jordan, EU + United Kingdom, and a defined set of
 * Americas markets.
 *
 * SCALE FLAG: 40 countries / 26 currencies is a large first launch for a
 * 16-week / USD 40,000 budget — flagged to the business, who chose to
 * proceed anyway. Favor a payment-gateway and tax-service strategy that
 * scales by configuration rather than per-country branching logic.
 *
 * COMPLIANCE HOLD: do not enable checkout for Venezuela (VE) without legal
 * sign-off — payment-processor support and currency stability (VES) are
 * unresolved. Kept on the list at the business's direction; engineering
 * should not silently wire up payments there without confirmation.
 */

const LAUNCH_MARKETS = [
  { countryCode: 'SA', countryName: "Saudi Arabia", currencyCode: 'SAR', locale: 'ar_SA' },
  { countryCode: 'AE', countryName: "United Arab Emirates", currencyCode: 'AED', locale: 'ar_AE' },
  { countryCode: 'OM', countryName: "Oman", currencyCode: 'OMR', locale: 'ar_OM' },
  { countryCode: 'KW', countryName: "Kuwait", currencyCode: 'KWD', locale: 'ar_KW' },
  { countryCode: 'BH', countryName: "Bahrain", currencyCode: 'BHD', locale: 'ar_BH' },
  { countryCode: 'QA', countryName: "Qatar", currencyCode: 'QAR', locale: 'ar_QA' },
  { countryCode: 'JO', countryName: "Jordan", currencyCode: 'JOD', locale: 'ar_JO' },
  { countryCode: 'BE', countryName: "Belgium", currencyCode: 'EUR', locale: 'nl_BE' },
  { countryCode: 'BG', countryName: "Bulgaria", currencyCode: 'BGN', locale: 'bg_BG' },
  { countryCode: 'HR', countryName: "Croatia", currencyCode: 'EUR', locale: 'hr_HR' },
  { countryCode: 'CZ', countryName: "Czech Republic", currencyCode: 'CZK', locale: 'cs_CZ' },
  { countryCode: 'DK', countryName: "Denmark", currencyCode: 'DKK', locale: 'da_DK' },
  { countryCode: 'FI', countryName: "Finland", currencyCode: 'EUR', locale: 'fi_FI' },
  { countryCode: 'DE', countryName: "Germany", currencyCode: 'EUR', locale: 'de_DE' },
  { countryCode: 'HU', countryName: "Hungary", currencyCode: 'HUF', locale: 'hu_HU' },
  { countryCode: 'IE', countryName: "Ireland", currencyCode: 'EUR', locale: 'en_IE' },
  { countryCode: 'IT', countryName: "Italy", currencyCode: 'EUR', locale: 'it_IT' },
  { countryCode: 'LV', countryName: "Latvia", currencyCode: 'EUR', locale: 'lv_LV' },
  { countryCode: 'LT', countryName: "Lithuania", currencyCode: 'EUR', locale: 'lt_LT' },
  { countryCode: 'NL', countryName: "Netherlands", currencyCode: 'EUR', locale: 'nl_NL' },
  { countryCode: 'PL', countryName: "Poland", currencyCode: 'PLN', locale: 'pl_PL' },
  { countryCode: 'PT', countryName: "Portugal", currencyCode: 'EUR', locale: 'pt_PT' },
  { countryCode: 'RO', countryName: "Romania", currencyCode: 'RON', locale: 'ro_RO' },
  { countryCode: 'SK', countryName: "Slovakia", currencyCode: 'EUR', locale: 'sk_SK' },
  { countryCode: 'SI', countryName: "Slovenia", currencyCode: 'EUR', locale: 'sl_SI' },
  { countryCode: 'ES', countryName: "Spain", currencyCode: 'EUR', locale: 'es_ES' },
  { countryCode: 'SE', countryName: "Sweden", currencyCode: 'SEK', locale: 'sv_SE' },
  { countryCode: 'GB', countryName: "United Kingdom", currencyCode: 'GBP', locale: 'en_GB' },
  { countryCode: 'US', countryName: "United States", currencyCode: 'USD', locale: 'en_US' },
  { countryCode: 'MX', countryName: "Mexico", currencyCode: 'MXN', locale: 'es_MX' },
  { countryCode: 'PA', countryName: "Panama", currencyCode: 'USD', locale: 'es_PA' },
  { countryCode: 'DO', countryName: "Dominican Republic", currencyCode: 'DOP', locale: 'es_DO' },
  { countryCode: 'AR', countryName: "Argentina", currencyCode: 'ARS', locale: 'es_AR' },
  { countryCode: 'BR', countryName: "Brazil", currencyCode: 'BRL', locale: 'pt_BR' },
  { countryCode: 'CL', countryName: "Chile", currencyCode: 'CLP', locale: 'es_CL' },
  { countryCode: 'EC', countryName: "Ecuador", currencyCode: 'USD', locale: 'es_EC' },
  { countryCode: 'PY', countryName: "Paraguay", currencyCode: 'PYG', locale: 'es_PY' },
  { countryCode: 'PE', countryName: "Peru", currencyCode: 'PEN', locale: 'es_PE' },
  { countryCode: 'UY', countryName: "Uruguay", currencyCode: 'UYU', locale: 'es_UY' },
  { countryCode: 'VE', countryName: "Venezuela", currencyCode: 'VES', locale: 'es_VE' },
];

const COMPLIANCE_HOLD_COUNTRY_CODES = new Set(['VE']);

function getMarketByCountryCode(countryCode) {
  return LAUNCH_MARKETS.find((m) => m.countryCode === countryCode) || null;
}

module.exports = { LAUNCH_MARKETS, COMPLIANCE_HOLD_COUNTRY_CODES, getMarketByCountryCode };
