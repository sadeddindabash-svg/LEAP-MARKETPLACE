import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The buyer's order screen uses the rules: an order that is over offers no address check, no tracking and no receipt. This reads the source text, so it needs no device.
void main() {
  final src = File('lib/features/orders/order_detail_screen.dart').readAsStringSync();
  test('the screen imports the rules', () {
    expect(src.contains("import '../../models/order_rules.dart';"), isTrue);
  });
  test('the address check is not offered for an order that is over', () {
    expect(src.contains("english['source'] == 'auto' && !isOrderFullyCancelled(_order);"), isTrue);
  });
  test('tracking follows the rule, and the old condition (which counted a cancelled part as "not delivered") is gone', () {
    expect(src.contains('if (showsTrackingButton(_order, subOrders, _buyerFacingStage))'), isTrue);
    expect(src.contains("if (subOrders.isNotEmpty && !subOrders.every((so) => _buyerFacingStage(so) == 'delivered'))"), isFalse);
  });
  test('the receipt button is only built when the rule says so, and it is still there', () {
    expect(src.contains('if (showsReceiptButton(_order))\n          OutlinedButton.icon('), isTrue);
    expect(src.contains("/receipt?\$query"), isTrue);
  });
  test('the reorder button is still offered (the buyer may order the parts again)', () {
    expect(src.contains('_reorder'), isTrue);
  });
}
