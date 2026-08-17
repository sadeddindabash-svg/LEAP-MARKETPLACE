import 'dart:ui' show PlatformDispatcher;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show BuildContext;
import 'package:provider/provider.dart';
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
/// SCOPE OF THIS PASS, stated honestly: currency is determined from the
/// device's own locale/region setting (no location permission needed,
/// works identically for guests and logged-in buyers alike). It does
/// NOT yet use a logged-in buyer's saved delivery address country --
/// that would need to react to login/logout and address changes, a
/// real, separate piece of complexity intentionally left as a
/// follow-up rather than rushed into this first pass. Falls back to
/// USD (i.e. no conversion at all) if the device's region doesn't
/// match a real currency in AppConfig.launchMarkets, or if the real
/// rates haven't loaded yet.
class CurrencyState extends ChangeNotifier {
  String _currencyCode = 'USD';
  Map<String, double> _rates = {};
  bool _isLoading = true;

  CurrencyState() {
    _init();
  }

  String get currencyCode => _currencyCode;
  bool get isLoading => _isLoading;
  bool get hasConversion => _currencyCode != 'USD' && _rates.containsKey(_currencyCode);

  Future<void> _init() async {
    final regionCode = PlatformDispatcher.instance.locale.countryCode;
    if (regionCode != null) {
      // Dependency-free null-safe "first match" -- deliberately not
      // .firstOrNull, matching the exact same real fix already
      // established in vehicle_filter_sheet.dart for this same
      // real issue (package:collection not confirmed available here).
      for (final market in AppConfig.launchMarkets) {
        if (market.countryCode == regionCode) {
          _currencyCode = market.currencyCode;
          break;
        }
      }
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
