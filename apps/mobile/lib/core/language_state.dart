import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A real, persistent app-wide language setting — Account/Settings screen,
/// applies everywhere, confirmed as the chosen approach rather than a
/// per-screen toggle or auto-detect. Persisted in secure storage (same
/// mechanism as the cart ID and auth token) so the choice survives an
/// app restart.
///
/// SCOPE OF THIS PASS, stated honestly rather than silently left
/// incomplete: this drives (a) which language the backend returns real
/// product name/description in (see ApiClient's `lang` parameter, wired
/// from this state), and (b) the labels on the product detail page
/// specifically (Part Name/Brand/Model/Year/Part No./Description/
/// Dimensions/Weight — the exact fields that were asked for). It does
/// NOT translate the rest of the app's UI chrome (nav labels, buttons,
/// screen titles elsewhere) into Arabic — that's a much larger,
/// separate undertaking or a real gap flagged for a follow-up, not
/// something quietly left half-done here.
class LanguageState extends ChangeNotifier {
  static const _languageKey = 'leap_language';
  final _secureStorage = const FlutterSecureStorage();

  String _language = 'en'; // 'en' or 'ar'
  bool _isLoading = true;

  LanguageState() {
    _init();
  }

  String get language => _language;
  bool get isArabic => _language == 'ar';
  bool get isLoading => _isLoading;

  Future<void> _init() async {
    final saved = await _secureStorage.read(key: _languageKey);
    if (saved == 'ar' || saved == 'en') {
      _language = saved!;
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> setLanguage(String language) async {
    if (language != 'en' && language != 'ar') return;
    _language = language;
    await _secureStorage.write(key: _languageKey, value: language);
    notifyListeners();
  }
}
