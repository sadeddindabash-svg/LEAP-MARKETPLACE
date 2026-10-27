import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/cart_shipping.dart';

// The shipping fee answer the server sends with every cart (free shipping above a limit): how it is read, when shipping counts as free, the progress bar, and the total with the fee.
// The model is plain Dart, so these tests need no device. (The package name is leap_mobile, as in pubspec.yaml.)
Map<String, dynamic> _answer({Object? enabled = true, Object? threshold = 50, Object? fee = 5, Object? charged = 5, Object? remaining = 30, Object? qualifies = false, Object? waived = false}) => {
      'enabled': enabled,
      'thresholdUsd': threshold,
      'feeUsd': fee,
      'chargedUsd': charged,
      'remainingUsd': remaining,
      'qualifies': qualifies,
      'waivedByPromo': waived,
    };

void main() {
  group('reading the answer', () {
    test('a small basket: the fee to pay, the limit and how much more is needed', () {
      final s = CartShipping.fromJson(_answer());
      expect(s.enabled, isTrue);
      expect(s.thresholdUsd, equals(50.0));
      expect(s.feeUsd, equals(5.0));
      expect(s.chargedUsd, equals(5.0));
      expect(s.remainingUsd, equals(30.0));
      expect(s.qualifies, isFalse);
      expect(s.waivedByPromo, isFalse);
    });
    test('whole numbers, decimals and numbers sent as text are all understood', () {
      final s = CartShipping.fromJson(_answer(threshold: 49.5, fee: '4.25', charged: 4, remaining: '0.5'));
      expect(s.thresholdUsd, equals(49.5));
      expect(s.feeUsd, equals(4.25));
      expect(s.chargedUsd, equals(4.0));
      expect(s.remainingUsd, equals(0.5));
    });
    test('the rule is OFF, nothing sent, or something that is not an answer: no fee and nothing to show', () {
      for (final json in <Object?>[null, 'x', 5, <int>[], <String, dynamic>{}, _answer(enabled: false), _answer(enabled: 'true'), _answer(enabled: null)]) {
        final s = CartShipping.fromJson(json);
        expect(s.enabled, isFalse);
        expect(s.chargedUsd, equals(0.0));
        expect(s.isFree, isFalse);
        expect(s.totalWith(20), equals(20.0));
      }
    });
    test('an amount that is not a sensible number counts as 0 (never a crash, never a negative)', () {
      final s = CartShipping.fromJson(_answer(threshold: 'abc', fee: -5, charged: double.nan, remaining: double.infinity));
      expect(s.thresholdUsd, equals(0.0));
      expect(s.feeUsd, equals(0.0));
      expect(s.chargedUsd, equals(0.0));
      expect(s.remainingUsd, equals(0.0));
    });
  });

  group('when shipping is free', () {
    test('at or above the limit nothing is charged and the Free shipping icon shows', () {
      final s = CartShipping.fromJson(_answer(charged: 0, remaining: 0, qualifies: true));
      expect(s.isFree, isTrue);
    });
    test('a free-shipping promo code also makes it free', () {
      expect(CartShipping.fromJson(_answer(charged: 0, waived: true)).isFree, isTrue);
    });
    test('while a fee is charged it is not free', () {
      expect(CartShipping.fromJson(_answer()).isFree, isFalse);
    });
    test('nothing charged for another reason (an empty basket) is not announced as free shipping', () {
      expect(CartShipping.fromJson(_answer(charged: 0, remaining: 50)).isFree, isFalse);
    });
    test('off is never free', () {
      expect(CartShipping.off.isFree, isFalse);
    });
  });

  group('the progress bar', () {
    test('30 of 50 still missing is 40% of the way', () {
      expect(CartShipping.fromJson(_answer()).progress, equals(0.4));
    });
    test('never below 0 or above 1', () {
      expect(CartShipping.fromJson(_answer(remaining: 70)).progress, equals(0.0));
      expect(CartShipping.fromJson(_answer(remaining: 0)).progress, equals(1.0));
    });
    test('a limit of 0, or the rule off, gives an empty bar and not a crash', () {
      expect(CartShipping.fromJson(_answer(threshold: 0, remaining: 0)).progress, equals(0.0));
      expect(CartShipping.off.progress, equals(0.0));
    });
  });

  group('the total with the fee', () {
    test('goods of 20 with a fee of 5 come to 25', () {
      expect(CartShipping.fromJson(_answer()).totalWith(20), equals(25.0));
    });
    test('at the limit the total is just the goods', () {
      expect(CartShipping.fromJson(_answer(charged: 0, remaining: 0, qualifies: true)).totalWith(60), equals(60.0));
    });
    test('an empty basket is still 0', () {
      expect(CartShipping.fromJson(_answer(charged: 0)).totalWith(0), equals(0.0));
    });
  });
}
