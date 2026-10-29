import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/cart_merge.dart';

// ONE CART PER ACCOUNT: reading what the server says when it combined this device's basket with the account basket. Plain Dart: no device needed.
void main() {
  test('CRITICAL: the whole answer is read: lines added, lines combined, quantities lowered, lines dropped', () {
    final m = CartMerge.fromJson({
      'itemsAdded': 2,
      'itemsCombined': 1,
      'reduced': [
        {'productId': 'p2', 'name': 'Oil Filter', 'from': 3, 'to': 2}
      ],
      'dropped': [
        {'productId': 'p4', 'name': 'Air Filter'}
      ],
    })!;
    expect(m.itemsAdded, 2);
    expect(m.itemsCombined, 1);
    expect(m.reduced.length, 1);
    expect(m.reduced.first.productId, 'p2');
    expect(m.reduced.first.name, 'Oil Filter');
    expect(m.reduced.first.from, 3);
    expect(m.reduced.first.to, 2);
    expect(m.dropped.length, 1);
    expect(m.dropped.first.name, 'Air Filter');
  });
  test('CRITICAL: no merge in the answer (the usual case, and an older server) is null: nothing to show', () {
    expect(CartMerge.fromJson(null), isNull);
    expect(CartMerge.fromJson('x'), isNull);
    expect(CartMerge.fromJson(5), isNull);
    expect(CartMerge.fromJson([1]), isNull);
  });
  test('a half-filled or wrong-shaped answer is read safely: missing numbers are 0, bad lines are skipped, names default to empty', () {
    final m = CartMerge.fromJson({
      'itemsAdded': 'x',
      'reduced': [
        {'name': 'no id'},
        5,
        {'productId': 'p1', 'from': 4.0}
      ],
      'dropped': 'nope',
    })!;
    expect(m.itemsAdded, 0);
    expect(m.itemsCombined, 0);
    expect(m.reduced.length, 1);
    expect(m.reduced.first.name, '');
    expect(m.reduced.first.from, 4);
    expect(m.reduced.first.to, 0);
    expect(m.dropped, isEmpty);
  });
  test('an empty object is a merge with nothing in it (the screen decides what to say)', () {
    final m = CartMerge.fromJson({})!;
    expect(m.itemsAdded + m.itemsCombined, 0);
    expect(m.reduced, isEmpty);
    expect(m.dropped, isEmpty);
  });
}
