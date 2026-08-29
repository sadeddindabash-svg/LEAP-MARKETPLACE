import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Same real, proven pattern as apps/mobile's LanguageState -- a
/// persistent, secure-storage-backed ChangeNotifier -- adapted for
/// this app's own real language pair (Chinese/English, not
/// English/Arabic) and its own real default.
///
/// Default is Chinese ('zh'), matching the web hub portal's own
/// confirmed default exactly (see apps/hub-portal/src/App.jsx line
/// 600) -- the seeded real Guangzhou hub-staff account is the actual
/// real-world user this matters most for. Deliberately not defaulting
/// to English here.
class LanguageState extends ChangeNotifier {
  static const _languageKey = 'leap_hub_language';
  final _secureStorage = const FlutterSecureStorage();

  String _language = 'zh'; // 'zh' or 'en'
  bool _isLoading = true;

  LanguageState() {
    _init();
  }

  String get language => _language;
  bool get isChinese => _language == 'zh';
  bool get isLoading => _isLoading;

  Future<void> _init() async {
    final saved = await _secureStorage.read(key: _languageKey);
    if (saved == 'zh' || saved == 'en') {
      _language = saved!;
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> toggle() async {
    final next = _language == 'zh' ? 'en' : 'zh';
    _language = next;
    await _secureStorage.write(key: _languageKey, value: next);
    notifyListeners();
  }
}
