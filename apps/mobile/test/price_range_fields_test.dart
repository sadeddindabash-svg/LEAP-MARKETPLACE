import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The price boxes take every colour from the app's palette (so they are readable in dark mode) and show the app's currency, not a fixed $. This reads the source text, so it needs no device.
void main() {
  final src = File('lib/widgets/price_range_fields.dart').readAsStringSync();
  test('no fixed colour: no Colors.x and no Color(0x...) (a fixed dark text colour is what made the letters unreadable in dark mode)', () {
    expect(RegExp(r'Colors\.').hasMatch(src), isFalse);
    expect(RegExp(r'Color\(0x').hasMatch(src), isFalse);
  });
  test('text, label, prefix, fill, border and cursor all come from the palette', () {
    for (final use in ['color: palette.ink', 'color: palette.muted', 'fillColor: palette.card', '_border(palette.line)', '_border(palette.signal, 1.6)', 'cursorColor: palette.signal']) {
      expect(src.contains(use), isTrue, reason: use);
    }
  });
  test('the currency before each amount is the one given, never a fixed dollar sign', () {
    expect(src.contains(r"prefixText: '$currencyLabel '"), isTrue);
    expect(src.contains(r"'\$'"), isFalse);
    expect(src.contains(r'"$"'), isFalse);
  });
  test('typing accepts Arabic digits too', () {
    expect(src.contains('٠-٩'), isTrue);
  });
}
