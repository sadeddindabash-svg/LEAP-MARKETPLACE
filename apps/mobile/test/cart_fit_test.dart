import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The basket's fit ribbon: green "✓ FIT" / red "✕ NOT FIT" on each photo (Arabic: متوافقة / غير متوافقة), and one line under the name. Reads the source text.
void main() {
  final fit = File('lib/core/cart_fit.dart').readAsStringSync();
  final cart = File('lib/features/cart/cart_screen.dart').readAsStringSync();
  final strings = File('lib/core/app_strings.dart').readAsStringSync();
  test('CRITICAL: the ribbon words in both languages, green when it fits and red when it does not, in the start corner (it mirrors in Arabic)', () {
    expect(fit.contains("f.fits ? (arabic ? '✓ متوافقة' : '✓ FIT') : (arabic ? '✕ غير متوافقة' : '✕ NOT FIT')"), isTrue);
    expect(fit.contains('location: BannerLocation.topStart,'), isTrue);
    expect(fit.contains('f.fits ? const Color(0xFF1E9D6B) : const Color(0xFFC62F26)'), isTrue);
  });
  test('the same fit rule as the product screen; nothing when there is no car or the part fits any car', () {
    expect(fit.contains('fitVerdict(generationId: car.generationId'), isTrue);
    expect(fit.contains('if (p == null || p.fitsVehicleIds.isEmpty) return null;'), isTrue);
  });
  test('the basket line shows the ribbon on the photo and the line under the name, with "Find it for my car"', () {
    expect(cart.contains('child: FitRibbon('), isTrue);
    expect(cart.contains("tr(context, 'cart_fit_for')"), isTrue);
    expect(cart.contains("context.push('/search', extra: {'initialQuery': _fit!.searchText})"), isTrue);
    for (final k in ['cart_fit_ok', 'cart_fit_for', 'cart_fit_find']) {
      expect(strings.contains("    '$k': {'en': "), isTrue, reason: k);
    }
  });
}
