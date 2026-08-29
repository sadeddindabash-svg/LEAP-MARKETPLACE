class AppConfig {
  AppConfig._();

  /// Base URL for services/api. Point this at your local backend during
  /// development and at the deployed API in production via
  /// --dart-define=API_BASE_URL=... at build time -- same real pattern
  /// as apps/mobile's own AppConfig, for consistency across this
  /// monorepo's Flutter apps.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );
}
