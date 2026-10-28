import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The "Sort & price" sheet shows the app's currency (not a fixed $), converts what is typed to US dollars for the search (and a saved filter back), and takes its colours from the palette so it is readable in dark mode.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
void main() {
  final sheet = File('lib/features/search/sort_and_price_sheet.dart').readAsStringSync();

  group('the currency', () {
    test('no price box has a fixed dollar sign: both use the currency of the app', () {
      expect(sheet.contains("prefixText: '\\\$'"), isFalse);
      expect('currencyLabelOf(context)'.allMatches(sheet).length, equals(3), reason: 'the Price range label and the two boxes');
      expect(sheet.contains("labelText: tr(context, 'min_field'), prefixText: '\${currencyLabelOf(context)} '"), isTrue);
      expect(sheet.contains("labelText: tr(context, 'max_field'), prefixText: '\${currencyLabelOf(context)} '"), isTrue);
    });
    test('the Price range label says which currency', () {
      expect(sheet.contains("Text('\${tr(context, 'price_range_label')} (\${currencyLabelOf(context)})'"), isTrue);
    });
    test('the summary chip (for example 100-500) writes the prices in the app currency, not with a fixed dollar sign', () {
      expect(sheet.contains("final min = formatPrice(context, (minPrice ?? 0).toDouble());"), isTrue);
      expect(sheet.contains("formatPrice(context, maxPrice!.toDouble())"), isTrue);
      expect(sheet.contains("'\\\$\$minPrice'"), isFalse);
      expect(sheet.contains("'\\\$\$maxPrice'"), isFalse);
    });
  });

  group('the conversion', () {
    test('typed amounts become dollars for the search (the server filters in dollars)', () {
      expect(sheet.contains('final range = priceRangeFromTyped(min, max, context.read<CurrencyState>().convert(1.0) ?? 1.0);'), isTrue);
      expect(sheet.contains('minPrice: range.minUsd, maxPrice: range.maxUsd'), isTrue);
      expect(sheet.contains('minPrice: min, maxPrice: max'), isFalse);
    });
    test('a saved filter (in dollars) is shown back in the app currency, in whole units', () {
      expect(sheet.contains('_minController.text = formatPriceInput(displayFromUsd(widget.initial!.minPrice, context.read<CurrencyState>().convert(1.0) ?? 1.0));'), isTrue);
      expect(sheet.contains('_maxController.text = formatPriceInput(displayFromUsd(widget.initial!.maxPrice, context.read<CurrencyState>().convert(1.0) ?? 1.0));'), isTrue);
    });
    test('the imports it needs are there', () {
      for (final i in ["import 'package:provider/provider.dart';", "import '../../core/currency_state.dart';", "import '../../models/price_filter.dart';", "import '../../widgets/currency_label.dart';"]) {
        expect(sheet.contains(i), isTrue, reason: i);
      }
    });
  });

  group('dark mode', () {
    test('no light-mode colour constant is left in the sheet: every colour comes from the palette that follows the mode', () {
      expect(sheet.contains('LeapColors.'), isFalse);
    });
    test('the section labels (Sort by, Price range, Delivery speed) and the chips take the palette colours', () {
      expect('LeapPalette.of(context).muted'.allMatches(sheet).length, equals(3));
      expect(sheet.contains('selectedColor: LeapPalette.of(context).signal.withValues(alpha: 0.15)'), isTrue);
      expect(sheet.contains('color: selected ? LeapPalette.of(context).signal : LeapPalette.of(context).ink'), isTrue);
    });
  });
}
