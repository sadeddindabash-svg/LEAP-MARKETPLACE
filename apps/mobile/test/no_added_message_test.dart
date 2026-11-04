import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Adding a part shows no "Added to cart" message any more (the photo flying to the cart says it); a failure is still said. Reads the source text.
void main() {
  final card = File('lib/widgets/product_card.dart').readAsStringSync();
  final product = File('lib/features/catalog/product_screen.dart').readAsStringSync();
  test('no "Added to cart" message from a product card or a product screen', () {
    expect(card.contains("trRead(context, 'added_to_cart')"), isFalse);
    expect(product.contains('to your basket'), isFalse);
    expect(product.contains('إلى السلة\''), isFalse);
  });
  test('a failure is still shown', () {
    expect(card.contains('} on ApiException catch (e) {'), isTrue);
    expect(product.contains('SnackBar(content: Text(apiErrorText(context, e)))'), isTrue);
  });
}
