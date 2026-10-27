import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Every wording key the free shipping widgets use exists in lib/core/app_strings.dart, in English AND Arabic (a missing key would show the raw key on screen), and the two sentences that carry an amount keep their {amount}.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
String _read(String path) => File(path).readAsStringSync();

void main() {
  final strings = _read('lib/core/app_strings.dart');
  final widgets = _read('lib/widgets/free_shipping.dart');
  final keys = RegExp(r"tr\(context, '(shipping_[a-z_]+)'\)|_withAmount\(context, '(shipping_[a-z_]+)'").allMatches(widgets).map((m) => (m.group(1) ?? m.group(2))!).toSet();

  String? entry(String key) {
    final m = RegExp("    '$key': \\{(.*)\\},").firstMatch(strings);
    return m?.group(1);
  }

  group('the wording of free shipping', () {
    test('the widgets use the six keys we expect', () {
      expect(keys.length, equals(6));
      for (final k in ['shipping_fees', 'shipping_free', 'shipping_add_more', 'shipping_reached', 'shipping_promo_free', 'shipping_free_badge']) {
        expect(keys.contains(k), isTrue, reason: k);
      }
    });
    test('every key the widgets use has an English and an Arabic text', () {
      for (final k in keys) {
        final e = entry(k);
        expect(e != null, isTrue, reason: 'missing key $k');
        expect(e!.contains("'en': '"), isTrue, reason: '$k has no English');
        expect(e.contains("'ar': '"), isTrue, reason: '$k has no Arabic');
        expect(RegExp(r'[\u0600-\u06FF]').hasMatch(e), isTrue, reason: '$k Arabic is not Arabic');
      }
    });
    test('the note and the reached sentence carry the amount in both languages', () {
      for (final k in ['shipping_add_more', 'shipping_reached']) {
        final e = entry(k)!;
        expect('{amount}'.allMatches(e).length, equals(2), reason: k);
      }
    });
  });
}
