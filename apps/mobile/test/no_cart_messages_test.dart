import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Removing a part from the basket shows no "... removed from cart" message any more (the line disappearing says it); a failure is still said. Reads the source text.
void main() {
  final cart = File('lib/features/cart/cart_screen.dart').readAsStringSync();
  test('no "removed from cart" message, and no Undo', () {
    expect(cart.contains("trRead(context, 'cart_removed_from_cart')"), isFalse);
    expect(cart.contains('SnackBarAction('), isFalse);
  });
  test('a failure to remove is still shown', () {
    expect(cart.contains('await cart.removeItem(item.productId);\n    } on ApiException catch (e) {'), isTrue);
  });
}
