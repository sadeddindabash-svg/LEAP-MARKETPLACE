import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The product cards' rows are as far apart as their columns (the grid's own 10 px): the card fills its grid cell,
// with no extra 12 px below it. Reads the source text, so it needs no device.
void main() {
  final card = File('lib/widgets/product_card.dart').readAsStringSync();
  test('the card fills its cell: no top-aligned box and no 12 px padding below it', () {
    expect(card.contains('return SizedBox.expand('), isTrue);
    expect(card.contains('padding: const EdgeInsets.only(bottom: 12),'), isFalse);
    expect(card.contains('constrainedAxis: Axis.horizontal,'), isFalse);
  });
  test('the cell height no longer reserves the 12 px', () {
    expect(card.contains('return imageHeight + 181;'), isTrue);
  });
  test('the card shows the real rating and count, "No reviews yet" only at 0', () {
    expect(card.contains("p.reviewCount > 0 ? '\${p.rating.toStringAsFixed(1)} (\${p.reviewCount})' : tr(context, 'no_reviews_yet')"), isTrue);
  });
}
