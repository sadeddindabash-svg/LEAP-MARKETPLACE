/// Placeholder launch-market configuration.
///
/// TODO(product): replace with the real Phase 1 launch countries once
/// confirmed (see docs/Leap_Project_Kickoff_Charter.docx, Section 1 —
/// "Phase 1 launch countries"). Everything downstream (currency formatting,
/// payment method priority, tax display) should read from this list rather
/// than hardcoding a single country, so adding/removing a launch market is a
/// config change, not a code change.
class LaunchMarket {
  final String countryCode; // ISO 3166-1 alpha-2, e.g. "US"
  final String countryName;
  final String currencyCode; // ISO 4217, e.g. "USD"
  final String locale; // e.g. "en_US"

  const LaunchMarket({
    required this.countryCode,
    required this.countryName,
    required this.currencyCode,
    required this.locale,
  });
}

class AppConfig {
  AppConfig._();

  /// EXAMPLE placeholder values — swap for the real Phase 1 country list.
  static const List<LaunchMarket> launchMarkets = [
    LaunchMarket(countryCode: 'US', countryName: 'United States', currencyCode: 'USD', locale: 'en_US'),
    LaunchMarket(countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', locale: 'en_GB'),
    LaunchMarket(countryCode: 'SA', countryName: 'Saudi Arabia', currencyCode: 'SAR', locale: 'ar_SA'),
  ];

  static LaunchMarket get defaultMarket => launchMarkets.first;

  /// Base URL for services/api. Point this at your local backend during
  /// development (see services/api/README.md) and at the deployed API in
  /// production via --dart-define=API_BASE_URL=... at build time.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  /// Guest checkout is allowed by default — see the product decision in
  /// docs/Leap_Project_Kickoff_Charter.docx. Buyers are prompted to create
  /// an account on the order confirmation screen, not blocked before
  /// checkout.
  static const bool guestCheckoutEnabled = true;
}
