import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The 2-item limit is wired into the wishlist: it uses the rule (no more hard-coded 4), a refused third item says why, and the message exists in English AND Arabic.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
String _read(String path) => File(path).readAsStringSync();

void main() {
  final wishlist = _read('lib/features/account/wishlist_screen.dart');
  final strings = _read('lib/core/app_strings.dart');

  group('the wishlist compare mode', () {
    test('uses the rule, not a number of its own', () {
      expect(wishlist.contains('canSelectForCompare(_selectedForCompare.length)'), isTrue);
      expect(wishlist.contains('_selectedForCompare.length < 4'), isFalse);
      expect(wishlist.contains("import '../../models/compare_limit.dart';"), isTrue);
    });
    test('a third item that is refused shows the message (a SnackBar) instead of doing nothing', () {
      expect(wishlist.contains("ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'compare_limit'))))"), isTrue);
    });
    test('the Compare button still needs at least 2 ticked', () {
      expect(wishlist.contains('_compareMode && _selectedForCompare.length >= 2'), isTrue);
    });
  });

  group('the message', () {
    String? entry(String key) => RegExp("    '$key': \\{(.*)\\},").firstMatch(strings)?.group(1);
    test('exists in English and in Arabic', () {
      final e = entry('compare_limit');
      expect(e != null, isTrue);
      expect(e!.contains("'en': 'You can compare 2 items at a time'"), isTrue);
      expect(RegExp(r'[\u0600-\u06FF]').hasMatch(e), isTrue);
    });
  });
}
