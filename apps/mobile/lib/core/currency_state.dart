import 'dart:ui' show PlatformDispatcher;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show BuildContext;
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'config/app_config.dart';
import 'language_state.dart';
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

/// Real, confirmed symbol for the 7 Arabic-country currencies (Saudi
/// Arabia, UAE, Oman, Kuwait, Bahrain, Qatar, Jordan) -- shown only
/// when the app's own language is Arabic; falls back to the plain
/// ISO code otherwise, since none of these has a recognized
/// Latin-script symbol the way "$" or "€" do.
const _arabicCountrySymbols = {
  'SAR': 'ر.س',
  'AED': 'د.إ',
  'OMR': 'ر.ع.',
  'KWD': 'د.ك',
  'BHD': '.د.ب',
  'QAR': 'ر.ق',
  'JOD': 'د.ا',
};

/// Real flag emoji for the currency picker, one per real currency --
/// confirmed with the person to use real flag emoji here, trusting
/// Android's native emoji font support (this couldn't be visually
/// confirmed from this sandbox or on a Windows preview, a known gap
/// in Windows browsers' own default emoji font, not expected to be a
/// real issue on the actual Android device this runs on). Mapped
/// directly from the real country-currency pairing in
/// services/api/src/config/markets.js. EUR and USD each cover several
/// real countries in the launch list -- used the EU flag and US flag
/// respectively as the single most sensible representative choice for
/// those two, rather than picking one arbitrary country for each.
const currencyFlags = {
  'USD': '🇺🇸',
  'SAR': '🇸🇦',
  'AED': '🇦🇪',
  'OMR': '🇴🇲',
  'KWD': '🇰🇼',
  'BHD': '🇧🇭',
  'QAR': '🇶🇦',
  'JOD': '🇯🇴',
  'EUR': '🇪🇺',
  'BGN': '🇧🇬',
  'CZK': '🇨🇿',
  'DKK': '🇩🇰',
  'HUF': '🇭🇺',
  'PLN': '🇵🇱',
  'RON': '🇷🇴',
  'SEK': '🇸🇪',
  'GBP': '🇬🇧',
  'MXN': '🇲🇽',
  'DOP': '🇩🇴',
  'ARS': '🇦🇷',
  'BRL': '🇧🇷',
  'CLP': '🇨🇱',
  'PYG': '🇵🇾',
  'PEN': '🇵🇪',
  'UYU': '🇺🇾',
  'VES': '🇻🇪',
};

/// Real, confirmed Latin-script symbol for every other real launch-
/// market currency (plus USD). Always used for these regardless of
/// the app's own language -- confirmed distinction from the 7
/// Arabic-country currencies above, which switch to Arabic-Indic
/// numerals and their own Arabic symbol only in an Arabic-language
/// app.
const _latinSymbols = {
  'USD': '\$',
  'ARS': '\$',
  'BGN': 'лв',
  'BRL': 'R\$',
  'CLP': '\$',
  'CZK': 'Kč',
  'DKK': 'kr',
  'DOP': 'RD\$',
  'EUR': '€',
  'GBP': '£',
  'HUF': 'Ft',
  'MXN': '\$',
  'PEN': 'S/',
  'PLN': 'zł',
  'PYG': '₲',
  'RON': 'lei',
  'SEK': 'kr',
  'UYU': '\$U',
  'VES': 'Bs.',
};

/// Real, confirmed formatting: no decimal places anywhere (round-
/// half-up -- Dart's own num.round() already rounds a real 0.5
/// fraction away from zero, matching the exact confirmed rule), and a
/// real thousands separator always. Currency-specific numeral/symbol
/// rule confirmed against several real rendered mockups before
/// writing this. Public (not the original underscore-prefixed name)
/// since orders_screen.dart's own count-up animation needs to format
/// each intermediate frame using this exact same logic, without
/// re-running the real currency conversion step on every frame.
String formatAmount(BuildContext context, double amount, String currencyCode) {
  final rounded = amount.round();
  final isArabicCountryCurrency = _arabicCountrySymbols.containsKey(currencyCode);
  final isAr = context.watch<LanguageState>().isArabic;
  if (isArabicCountryCurrency && isAr) {
    final formatted = NumberFormat('#,##0', 'ar').format(rounded);
    return '$formatted ${_arabicCountrySymbols[currencyCode]}';
  }
  final formatted = NumberFormat('#,##0', 'en_US').format(rounded);
  final symbol = _latinSymbols[currencyCode] ?? currencyCode;
  return '$symbol $formatted';
}

/// Real, display-only formatted price -- shows the buyer's real
/// estimated local-currency price when a real conversion is
/// available, falling back to the plain USD amount otherwise.
String formatPrice(BuildContext context, double usdAmount) {
  final currency = context.watch<CurrencyState>();
  final converted = currency.convert(usdAmount);
  if (converted == null) return formatAmount(context, usdAmount, 'USD');
  return formatAmount(context, converted, currency.currencyCode);
}

/// Real, display-only formatted price for cart/checkout contexts --
/// confirmed, per request, to show only the converted currency now,
/// same as formatPrice. Kept as a separate function (rather than
/// merged into formatPrice) since callers already reference it by
/// this name across cart_screen.dart and checkout_screen.dart, and a
/// future request to bring back the real USD amount at checkout
/// specifically would only need to change this one function again.
String formatPriceWithUsd(BuildContext context, double usdAmount) {
  return formatPrice(context, usdAmount);
}
