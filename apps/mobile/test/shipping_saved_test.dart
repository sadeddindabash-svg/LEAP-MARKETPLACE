import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/cart_shipping.dart';

// "You saved" in the checkout counts the shipping fee the buyer does not pay when shipping is free. Plain Dart: no device needed.
CartShipping _ship({bool enabled = true, double fee = 5, double charged = 0, bool qualifies = true, bool waived = false}) =>
    CartShipping.fromJson({'enabled': enabled, 'thresholdUsd': 50, 'feeUsd': fee, 'chargedUsd': charged, 'remainingUsd': qualifies ? 0 : 20, 'qualifies': qualifies, 'waivedByPromo': waived});

void main() {
  group('the shipping fee saved', () {
    test('free shipping reached: the fee that would have been charged below the limit', () {
      expect(_ship().savedUsd, equals(5.0));
      expect(_ship(fee: 7.5).savedUsd, equals(7.5));
    });
    test('a free-shipping promo code that waives the fee counts too, even below the limit', () {
      expect(_ship(qualifies: false, waived: true).savedUsd, equals(5.0));
    });
    test('a fee is CHARGED (under the limit): nothing is saved', () {
      expect(_ship(qualifies: false, charged: 5).savedUsd, equals(0.0));
    });
    test('the rule off, an answer from an older server, or a damaged one: nothing', () {
      expect(_ship(enabled: false).savedUsd, equals(0.0));
      expect(CartShipping.off.savedUsd, equals(0.0));
      expect(CartShipping.fromJson(null).savedUsd, equals(0.0));
      expect(CartShipping.fromJson({'enabled': true, 'feeUsd': 'abc', 'chargedUsd': 0, 'qualifies': true}).savedUsd, equals(0.0));
    });
    test('a fee of 0 saves nothing (there was nothing to pay)', () {
      expect(_ship(fee: 0).savedUsd, equals(0.0));
    });
    test('built directly (not through the server answer): a fee that is charged saves nothing even if the limit is marked reached, and a rule that is off saves nothing', () {
      const charged = CartShipping(enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 5, remainingUsd: 0, qualifies: true, waivedByPromo: false);
      expect(charged.savedUsd, equals(0.0));
      const off = CartShipping(enabled: false, thresholdUsd: 50, feeUsd: 5, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: true);
      expect(off.savedUsd, equals(0.0));
      const free = CartShipping(enabled: true, thresholdUsd: 50, feeUsd: 5, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: false);
      expect(free.savedUsd, equals(5.0));
    });
    test('free for no real reason (not reached, no promo) saves nothing', () {
      expect(_ship(qualifies: false).savedUsd, equals(0.0));
    });
  });
}
