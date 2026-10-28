import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/price_filter.dart';

// The price range filter: what the buyer types (in the app's currency) as US dollars for the server, and back. Plain Dart: no device needed.
void main() {
  group('reading what was typed', () {
    test('plain numbers, with spaces and thousands separators ignored', () {
      expect(parsePriceInput('100'), equals(100.0));
      expect(parsePriceInput('  250.5 '), equals(250.5));
      expect(parsePriceInput('1,200'), equals(1200.0));
      expect(parsePriceInput('1 200'), equals(1200.0));
      expect(parsePriceInput('1٬200'), equals(1200.0));
    });
    test('Arabic-Indic digits and the Arabic decimal mark are understood (a phone keyboard in Arabic)', () {
      expect(parsePriceInput('١٠٠'), equals(100.0));
      expect(parsePriceInput('۱۵۰'), equals(150.0));
      expect(parsePriceInput('٢٥٫٥'), equals(25.5));
    });
    test('nothing, text, a negative or a half-typed number is no limit (null), never a crash', () {
      for (final bad in ['', '   ', 'abc', '-5', '1.2.3', '.5', '5.', '1e5', '١٢abc']) {
        expect(parsePriceInput(bad), isNull, reason: '"$bad"');
      }
    });
  });

  group('converting', () {
    test('typed riyals become dollars for the server, and a saved dollar value comes back as the same riyals', () {
      expect(usdFromDisplay(375, 3.75), equals(100.0));
      expect(displayFromUsd(100, 3.75), equals(375.0));
      expect(formatPriceInput(displayFromUsd(usdFromDisplay(100, 3.75), 3.75)), equals('100'));
    });
    test('null stays null; dollars need no rate', () {
      expect(usdFromDisplay(null, 3.75), isNull);
      expect(displayFromUsd(null, 3.75), isNull);
      expect(usdFromDisplay(50, 1), equals(50.0));
    });
    test('a missing or nonsense rate counts as dollars (never a division by zero or a negative price)', () {
      for (final r in [0.0, -3.0, double.nan, double.infinity]) {
        expect(usdFromDisplay(50, r), equals(50.0), reason: '$r');
        expect(displayFromUsd(50, r), equals(50.0), reason: '$r');
      }
    });
    test('the box shows whole units, like the prices in the app', () {
      expect(formatPriceInput(100.0), equals('100'));
      expect(formatPriceInput(99.9999), equals('100'));
      expect(formatPriceInput(null), equals(''));
    });
  });

  group('the range for the search', () {
    test('both limits are converted: 100 to 500 riyals at 3.75 per dollar', () {
      final r = priceRangeToUsd(minText: '100', maxText: '500', ratePerUsd: 3.75);
      expect(r.minUsd, equals(26.66));
      expect(r.maxUsd, equals(133.34));
    });
    test('the lower limit is rounded DOWN and the upper one UP to the cent: a part priced exactly at a limit is never left out', () {
      final r = priceRangeToUsd(minText: '100', maxText: '100', ratePerUsd: 3.75);
      expect(r.minUsd! <= 100 / 3.75, isTrue);
      expect(r.maxUsd! >= 100 / 3.75, isTrue);
    });
    test('an empty or invalid box is no limit on that side', () {
      final r = priceRangeToUsd(minText: '', maxText: '500', ratePerUsd: 3.75);
      expect(r.minUsd, isNull);
      expect(r.maxUsd, equals(133.34));
      final n = priceRangeToUsd(minText: 'x', maxText: '', ratePerUsd: 3.75);
      expect(n.minUsd, isNull);
      expect(n.maxUsd, isNull);
    });
    test('a Min above the Max are swapped', () {
      final r = priceRangeToUsd(minText: '500', maxText: '100', ratePerUsd: 3.75);
      expect(r.minUsd, equals(26.66));
      expect(r.maxUsd, equals(133.34));
    });
    test('in dollars the numbers go through unchanged', () {
      final r = priceRangeToUsd(minText: '10', maxText: '50', ratePerUsd: 1);
      expect(r.minUsd, equals(10.0));
      expect(r.maxUsd, equals(50.0));
    });
    test('typed in Arabic digits it is the same range', () {
      final a = priceRangeToUsd(minText: '١٠٠', maxText: '٥٠٠', ratePerUsd: 3.75);
      final e = priceRangeToUsd(minText: '100', maxText: '500', ratePerUsd: 3.75);
      expect(a.minUsd, equals(e.minUsd));
      expect(a.maxUsd, equals(e.maxUsd));
    });
  });
}
