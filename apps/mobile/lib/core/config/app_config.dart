/// Confirmed Phase 1 launch-market list (40 countries), as given by the
/// business. This REPLACES the earlier 75-country / 5-wave draft — see
/// git history if you need that broader roadmap list again later.
///
/// Regions covered: GCC + Jordan, EU + United Kingdom, and a defined set of
/// Americas markets (North America, Panama, Dominican Republic, and a
/// cluster of South American countries).
///
/// SCALE FLAG (still worth knowing): 40 countries spanning 26 distinct
/// currencies is a large first launch for a 16-week / USD 40,000 budget —
/// flagged to the business, and the decision was made to proceed anyway.
/// Prioritize a payment-gateway and tax-service strategy that scales by
/// configuration (see services/api/src/config/markets.js) rather than
/// hand-rolling logic per country.
///
/// COMPLIANCE FLAG — do not enable checkout for Venezuela (VE) without
/// legal sign-off. Payment-processor support and currency stability (VES)
/// are unresolved; this was flagged to the business and kept on the list
/// at their direction, but engineering should not silently wire up
/// payments there without confirmation.
class LaunchMarket {
  final String countryCode; // ISO 3166-1 alpha-2
  final String countryName;
  final String currencyCode; // ISO 4217
  final String locale;

  const LaunchMarket({
    required this.countryCode,
    required this.countryName,
    required this.currencyCode,
    required this.locale,
  });
}

class AppConfig {
  AppConfig._();

  static const List<LaunchMarket> launchMarkets = [
    LaunchMarket(countryCode: 'SA', countryName: 'Saudi Arabia', currencyCode: 'SAR', locale: 'ar_SA'),
    LaunchMarket(countryCode: 'AE', countryName: 'United Arab Emirates', currencyCode: 'AED', locale: 'ar_AE'),
    LaunchMarket(countryCode: 'OM', countryName: 'Oman', currencyCode: 'OMR', locale: 'ar_OM'),
    LaunchMarket(countryCode: 'KW', countryName: 'Kuwait', currencyCode: 'KWD', locale: 'ar_KW'),
    LaunchMarket(countryCode: 'BH', countryName: 'Bahrain', currencyCode: 'BHD', locale: 'ar_BH'),
    LaunchMarket(countryCode: 'QA', countryName: 'Qatar', currencyCode: 'QAR', locale: 'ar_QA'),
    LaunchMarket(countryCode: 'JO', countryName: 'Jordan', currencyCode: 'JOD', locale: 'ar_JO'),
    LaunchMarket(countryCode: 'BE', countryName: 'Belgium', currencyCode: 'EUR', locale: 'nl_BE'),
    LaunchMarket(countryCode: 'BG', countryName: 'Bulgaria', currencyCode: 'BGN', locale: 'bg_BG'),
    LaunchMarket(countryCode: 'HR', countryName: 'Croatia', currencyCode: 'EUR', locale: 'hr_HR'),
    LaunchMarket(countryCode: 'CZ', countryName: 'Czech Republic', currencyCode: 'CZK', locale: 'cs_CZ'),
    LaunchMarket(countryCode: 'DK', countryName: 'Denmark', currencyCode: 'DKK', locale: 'da_DK'),
    LaunchMarket(countryCode: 'FI', countryName: 'Finland', currencyCode: 'EUR', locale: 'fi_FI'),
    LaunchMarket(countryCode: 'DE', countryName: 'Germany', currencyCode: 'EUR', locale: 'de_DE'),
    LaunchMarket(countryCode: 'HU', countryName: 'Hungary', currencyCode: 'HUF', locale: 'hu_HU'),
    LaunchMarket(countryCode: 'IE', countryName: 'Ireland', currencyCode: 'EUR', locale: 'en_IE'),
    LaunchMarket(countryCode: 'IT', countryName: 'Italy', currencyCode: 'EUR', locale: 'it_IT'),
    LaunchMarket(countryCode: 'LV', countryName: 'Latvia', currencyCode: 'EUR', locale: 'lv_LV'),
    LaunchMarket(countryCode: 'LT', countryName: 'Lithuania', currencyCode: 'EUR', locale: 'lt_LT'),
    LaunchMarket(countryCode: 'NL', countryName: 'Netherlands', currencyCode: 'EUR', locale: 'nl_NL'),
    LaunchMarket(countryCode: 'PL', countryName: 'Poland', currencyCode: 'PLN', locale: 'pl_PL'),
    LaunchMarket(countryCode: 'PT', countryName: 'Portugal', currencyCode: 'EUR', locale: 'pt_PT'),
    LaunchMarket(countryCode: 'RO', countryName: 'Romania', currencyCode: 'RON', locale: 'ro_RO'),
    LaunchMarket(countryCode: 'SK', countryName: 'Slovakia', currencyCode: 'EUR', locale: 'sk_SK'),
    LaunchMarket(countryCode: 'SI', countryName: 'Slovenia', currencyCode: 'EUR', locale: 'sl_SI'),
    LaunchMarket(countryCode: 'ES', countryName: 'Spain', currencyCode: 'EUR', locale: 'es_ES'),
    LaunchMarket(countryCode: 'SE', countryName: 'Sweden', currencyCode: 'SEK', locale: 'sv_SE'),
    LaunchMarket(countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', locale: 'en_GB'),
    LaunchMarket(countryCode: 'US', countryName: 'United States', currencyCode: 'USD', locale: 'en_US'),
    LaunchMarket(countryCode: 'MX', countryName: 'Mexico', currencyCode: 'MXN', locale: 'es_MX'),
    LaunchMarket(countryCode: 'PA', countryName: 'Panama', currencyCode: 'USD', locale: 'es_PA'),
    LaunchMarket(countryCode: 'DO', countryName: 'Dominican Republic', currencyCode: 'DOP', locale: 'es_DO'),
    LaunchMarket(countryCode: 'AR', countryName: 'Argentina', currencyCode: 'ARS', locale: 'es_AR'),
    LaunchMarket(countryCode: 'BR', countryName: 'Brazil', currencyCode: 'BRL', locale: 'pt_BR'),
    LaunchMarket(countryCode: 'CL', countryName: 'Chile', currencyCode: 'CLP', locale: 'es_CL'),
    LaunchMarket(countryCode: 'EC', countryName: 'Ecuador', currencyCode: 'USD', locale: 'es_EC'),
    LaunchMarket(countryCode: 'PY', countryName: 'Paraguay', currencyCode: 'PYG', locale: 'es_PY'),
    LaunchMarket(countryCode: 'PE', countryName: 'Peru', currencyCode: 'PEN', locale: 'es_PE'),
    LaunchMarket(countryCode: 'UY', countryName: 'Uruguay', currencyCode: 'UYU', locale: 'es_UY'),
    LaunchMarket(countryCode: 'VE', countryName: 'Venezuela', currencyCode: 'VES', locale: 'es_VE'),
  ];

  /// Countries requiring legal/compliance sign-off before enabling
  /// checkout — see class doc comment above.
  static const Set<String> complianceHoldCountryCodes = {'VE'};

  static LaunchMarket get defaultMarket => launchMarkets.first;

  /// Base URL for services/api. Point this at your local backend during
  /// development (see services/api/README.md) and at the deployed API in
  /// production via --dart-define=API_BASE_URL=... at build time.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  /// REAL BUG FOUND AND FIXED HERE: product sharing used to hardcode
  /// `https://leapautoparts.com/...`, a domain that has never existed
  /// -- there was no real web page to share at the time this was
  /// written. apps/web-storefront now has a genuinely real product
  /// page at `/products/:id` (see that app's own README), so this
  /// points there instead. Configurable the same way apiBaseUrl is,
  /// via --dart-define=STOREFRONT_URL=... at build time; the default
  /// matches web-storefront's own .env.example NEXT_PUBLIC_SITE_URL.
  static const String storefrontUrl = String.fromEnvironment(
    'STOREFRONT_URL',
    defaultValue: 'http://localhost:3001',
  );

  /// Guest checkout is allowed by default — see the product decision in
  /// docs/Leap_Project_Kickoff_Charter.docx. Buyers are prompted to create
  /// an account on the order confirmation screen, not blocked before
  /// checkout.
  static const bool guestCheckoutEnabled = true;
}
