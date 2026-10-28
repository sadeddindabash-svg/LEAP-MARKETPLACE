import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The checkout's "You saved" row counts the shipping fee saved, shows the split under it, and the wording exists in English AND Arabic. This reads the source text, so it needs no device.
String _read(String path) => File(path).readAsStringSync();

void main() {
  final checkout = _read('lib/features/checkout/checkout_screen.dart');
  final state = _read('lib/core/cart_state.dart');
  final strings = _read('lib/core/app_strings.dart');

  group('the cart state', () {
    test('says how much shipping fee was saved, from the shipping answer', () {
      expect(state.contains('double get shippingSaved => _shipping.savedUsd;'), isTrue);
    });
  });
  group('the checkout summary', () {
    test('shows the row when there is a discount OR a shipping saving, and the amount counts both', () {
      expect(checkout.contains('if (cart.totalSaved + cart.appliedDiscountUsd + cart.shippingSaved > 0) ...['), isTrue);
      expect(checkout.contains('formatPrice(context, cart.totalSaved + cart.appliedDiscountUsd + cart.shippingSaved)'), isTrue);
    });
    test('shows the split under the label only when shipping was saved: discount and shipping, or just Free shipping', () {
      expect(checkout.contains('if (cart.shippingSaved > 0)'), isTrue);
      expect(checkout.contains("tr(context, 'saved_breakdown')"), isTrue);
      expect(checkout.contains("tr(context, 'saved_free_shipping')"), isTrue);
      expect(checkout.contains("replaceAll('{discount}'"), isTrue);
      expect(checkout.contains("replaceAll('{shipping}'"), isTrue);
    });
  });
  group('the wording', () {
    String? entry(String key) => RegExp("    '$key': \\{(.*)\\},").firstMatch(strings)?.group(1);
    test('both keys exist in English and Arabic, and the split carries both amounts', () {
      for (final k in ['saved_breakdown', 'saved_free_shipping']) {
        final e = entry(k);
        expect(e != null, isTrue, reason: k);
        expect(e!.contains("'en': '"), isTrue, reason: k);
        expect(RegExp(r'[\u0600-\u06FF]').hasMatch(e), isTrue, reason: k);
      }
      expect('{discount}'.allMatches(entry('saved_breakdown')!).length, equals(2));
      expect('{shipping}'.allMatches(entry('saved_breakdown')!).length, equals(2));
    });
  });
}
