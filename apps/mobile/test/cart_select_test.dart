import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The basket's tick boxes and the trash can, wired in. Reads the source text, so it needs no device.
void main() {
  final state = File('lib/core/cart_state.dart').readAsStringSync();
  final cart = File('lib/features/cart/cart_screen.dart').readAsStringSync();
  final checkout = File('lib/features/checkout/checkout_screen.dart').readAsStringSync();
  final trash = File('lib/core/fly_to_trash.dart').readAsStringSync();

  group('choosing what to order', () {
    test('CRITICAL: the unticked lines are kept on the phone, a part added again is ticked again', () {
      expect(state.contains("static const _unselectedKey = 'leap_cart_unselected';"), isTrue);
      expect(state.contains('if (_unselected.remove(productId)) _saveUnselected();'), isTrue);
    });
    test('CRITICAL: the checkout sees only the ticked lines, and after the order only those leave the basket', () {
      expect(checkout.contains('context.watch<CartState>().forCheckout'), isTrue);
      expect(checkout.contains('context.read<CartState>()\n') || checkout.contains('context.read<CartState>();'), isFalse);
      expect(state.contains("Future<void> clearAfterOrder() => _c.clearAfterOrder(only: items.map((i) => i.productId).toList());"), isTrue);
    });
    test('the discount and the shipping fee of the ticked lines follow the server rules', () {
      expect(state.contains("p.type == 'percentage'"), isTrue);
      expect(state.contains("p.type == 'flat'"), isTrue);
      expect(state.contains('chargedUsd: items.isNotEmpty && !qualifies && !s.waivedByPromo ? s.feeUsd : 0,'), isTrue);
    });
    test('the basket has Select all, a tick box per line, and Checkout follows the ticked lines (off when none)', () {
      expect(cart.contains("tr(context, 'cart_select_all')"), isTrue);
      expect(cart.contains('onChanged: (_) => cart.toggleSelected(item.productId),'), isTrue);
      expect(cart.contains("onPressed: chosen.isEmpty ? null : () => context.push('/checkout'),"), isTrue);
      expect(cart.contains('FreeShippingHint(shipping: chosen.shipping),'), isTrue);
    });
  });

  group('removing', () {
    test('CRITICAL: the photo flies into the trash can, then the line folds away, then it leaves the basket', () {
      expect(cart.contains('await FlyToTrash.fly(context, source: _photoKey'), isTrue);
      expect(cart.contains('await _fold.reverse();'), isTrue);
      expect(cart.indexOf('await _fold.reverse();') < cart.indexOf('await cart.removeItem(item.productId);'), isTrue);
    });
    test('"Remove animations" skips the flight', () {
      expect(trash.contains('MediaQuery.maybeOf(context)?.disableAnimations ?? false'), isTrue);
    });
  });
}
