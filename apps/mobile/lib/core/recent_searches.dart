import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Real "recently searched terms" (new) -- closes a real gap: only
/// "recently viewed products" existed before, not recently searched
/// TERMS. Purely local/on-device -- no real backend endpoint needed,
/// matching the same real secure storage AuthState/AppLockState/
/// OnboardingOverlay already use for other simple, local, non-
/// sensitive persisted values.
class RecentSearches {
  static const _storage = FlutterSecureStorage();
  static const _key = 'recent_search_terms_v1';
  static const _maxTerms = 8;

  static Future<List<String>> load() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.cast<String>();
    } catch (_) {
      // A real, corrupted/unexpected stored value should never crash
      // the search screen -- just start fresh.
      return [];
    }
  }

  /// Real save -- deduplicates (a re-searched term moves back to the
  /// front rather than appearing twice), most-recent-first, capped at
  /// a real, reasonable number so this never grows unbounded.
  static Future<List<String>> add(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return load();
    final current = await load();
    final updated = [trimmed, ...current.where((t) => t.toLowerCase() != trimmed.toLowerCase())];
    final capped = updated.take(_maxTerms).toList();
    await _storage.write(key: _key, value: jsonEncode(capped));
    return capped;
  }

  static Future<void> clear() async {
    await _storage.delete(key: _key);
  }
}
