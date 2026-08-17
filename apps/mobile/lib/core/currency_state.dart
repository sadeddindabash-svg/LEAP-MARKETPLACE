import 'dart:ui' show PlatformDispatcher;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show BuildContext;
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'config/app_config.dart';
import '../services/api_client.dart';

/// Real, display-only currency conversion -- confirmed scope, discussed
/// before building: the actual charge always happens in USD regardless
/// of what's shown here (see services/api's order routes.js, which
/// hardcodes 'USD' as the buyer-facing charge currency). This state
/// exists purely to show an *estimated* local-currency price alongside
/// the real USD one, using the real, live-refreshed rates from
/// GET /pricing/display-rates (see services/api/src/modules/pricing/
/// fxRateRefresh.js's startScheduledDisplayCurrencyRefresh).
///
/// Currency is determined in this real order of precedence:
/// 1. A real, persisted manual choice (Account screen currency picker,
///    beside the language picker) -- always wins once set.
/// 2. Real GPS-based geolocation, reusing the exact same real
///    Geolocator + ApiClient().reverseGeocode() mechanism already
///    established in checkout_screen.dart's address suggestion (same
///    real permission prompt the person may already be familiar with
///    from that flow). Gracefully skipped if permission is denied or
///    location is unavailable -- never blocks app startup on this.
/// 3. The device's own locale/region setting, no permission needed.
/// 4. USD (no conversion) if none of the above match a real currency
///    in AppConfig.launchMarkets, or if the real rates haven't
///    loaded yet.
class CurrencyState extends ChangeNotifier {
  static const _currencyKey = 'leap_currency_override';
  final _secureStorage = const FlutterSecureStorage();

  String _currencyCode = 'USD';
  Map<String, double> _rates = {};
  bool _isLoading = true;
  bool _isManualOverride = false;

  CurrencyState() {
    _init();
  }

  String get currencyCode => _currencyCode;
  bool get isLoading => _isLoading;
  bool get isManualOverride => _isManualOverride;
  bool get hasConversion => _currencyCode != 'USD' && _rates.containsKey(_currencyCode);

  String? _currencyForCountryName(String countryName) {
    for (final market in AppConfig.launchMarkets) {
      if (market.countryName.toLowerCase() == countryName.toLowerCase()) return market.currencyCode;
    }
    return null;
  }

  String? _currencyForCountryCode(String countryCode) {
    for (final market in AppConfig.launchMarkets) {
      if (market.countryCode == countryCode) return market.currencyCode;
    }
    return null;
  }

  Future<void> _init() async {
    final saved = await _secureStorage.read(key: _currencyKey);
    if (saved != null && (saved == 'USD' || AppConfig.launchMarkets.any((m) => m.currencyCode == saved))) {
      _currencyCode = saved;
      _isManualOverride = true;
    } else {
      await _detectFromGeolocation();
    }
    try {
      final result = await ApiClient().fetchDisplayRates();
      _rates = result.map((key, value) => MapEntry(key, (value as num).toDouble()));
    } on ApiException {
      // Real, honest fallback -- a failed fetch just means no
      // conversion happens (prices show in USD only), never a crash
      // or a broken price display.
      _rates = {};
    }
    _isLoading = false;
    notifyListeners();
  }

  /// Real GPS-based detection, gracefully falling back to device
  /// locale on any failure (denied permission, disabled location
  /// services, no GPS fix, or a real network hiccup during reverse
  /// geocoding) -- never blocks or crashes on failure, matching the
  /// same real try/catch pattern already established for this exact
  /// same real Geolocator + reverseGeocode() combination in
  /// checkout_screen.dart.
  Future<void> _detectFromGeolocation() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission != LocationPermission.denied && permission != LocationPermission.deniedForever) {
        final serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 8)),
          );
          final geocoded = await ApiClient().reverseGeocode(position.latitude, position.longitude);
          final countryName = geocoded?['country'] as String?;
          if (countryName != null) {
            final matched = _currencyForCountryName(countryName);
            if (matched != null) {
              _currencyCode = matched;
              return;
            }
          }
        }
      }
    } catch (_) {
      // Real, honest fallback below -- device locale instead.
    }
    _detectFromLocale();
  }

  void _detectFromLocale() {
    final regionCode = PlatformDispatcher.instance.locale.countryCode;
    if (regionCode == null) return;
    final matched = _currencyForCountryCode(regionCode);
    if (matched != null) _currencyCode = matched;
  }

  /// Real, persisted manual override (new) -- set from the Account
  /// screen's currency picker, beside the language picker. Always
  /// wins over automatic detection once set; pass null to clear the
  /// override and re-run automatic detection instead.
  Future<void> setCurrencyCode(String? currencyCode) async {
    if (currencyCode == null) {
      await _secureStorage.delete(key: _currencyKey);
      _isManualOverride = false;
      await _detectFromGeolocation();
      notifyListeners();
      return;
    }
    if (currencyCode != 'USD' && !AppConfig.launchMarkets.any((m) => m.currencyCode == currencyCode)) return;
    _currencyCode = currencyCode;
    _isManualOverride = true;
    await _secureStorage.write(key: _currencyKey, value: currencyCode);
    notifyListeners();
  }

  /// Converts a real USD amount to the buyer's real display currency.
  /// Returns null when no real conversion is available (USD buyers,
  /// or the real rate for this currency hasn't loaded) -- callers
  /// should fall back to showing the plain USD amount in that case,
  /// never a fabricated or stale-looking number.
  double? convert(double usdAmount) {
    if (!hasConversion) return null;
    return usdAmount * _rates[_currencyCode]!;
  }
}

/// Real, display-only formatted price (new) -- shows the buyer's real
/// estimated local-currency price when a real conversion is available,
/// falling back to the plain USD amount otherwise. For general
/// browsing displays (product cards, product detail) where only one
/// price needs to be shown.
String formatPrice(BuildContext context, double usdAmount) {
  final currency = context.watch<CurrencyState>();
  final converted = currency.convert(usdAmount);
  if (converted == null) return '\$${usdAmount.toStringAsFixed(2)}';
  return '≈ ${converted.toStringAsFixed(2)} ${currency.currencyCode}';
}

/// Real, display-only formatted price that keeps the real USD charge
/// amount visible alongside the estimate (new) -- for checkout/cart/
/// payment-confirmation contexts specifically, where the buyer needs
/// to see what they're actually being charged, not just the estimate.
/// Never hides or replaces the real USD amount with the converted one.
String formatPriceWithUsd(BuildContext context, double usdAmount) {
  final currency = context.watch<CurrencyState>();
  final converted = currency.convert(usdAmount);
  final usdText = '\$${usdAmount.toStringAsFixed(2)}';
  if (converted == null) return usdText;
  return '≈ ${converted.toStringAsFixed(2)} ${currency.currencyCode} ($usdText USD)';
}
