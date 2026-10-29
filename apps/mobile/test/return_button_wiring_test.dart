import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The app's order details: no "Shipped by" heading, and "Request a return" only while a part can be returned. Reads the source text, so it needs no device.
void main() {
  final screen = File('lib/features/orders/order_detail_screen.dart').readAsStringSync();
  test('CRITICAL: the "Shipped by" heading is gone from the order details (the suppliers are still listed)', () {
    expect(screen.contains("tr(context, 'shipped_by')"), isFalse);
    expect(screen.contains('for (final so in subOrders) _SupplierSubOrderCard('), isTrue);
  });
  test('CRITICAL: each supplier card is told whether its part can still be returned (the shared rule, with the order)', () {
    expect(screen.contains('showReturnButton: isSubOrderReturnable(so, _order),'), isTrue);
    expect(screen.contains("import '../../models/order_rules.dart';"), isTrue);
  });
  test('CRITICAL: the return button is built ONLY when the card says so (it used to be built always), and the cancel button is untouched', () {
    expect(screen.contains('if (showReturnButton)\n              Align('), isTrue);
    expect(screen.contains('final bool showReturnButton;'), isTrue);
    expect(screen.contains('this.showReturnButton = true'), isTrue);
    expect(screen.contains('if (showCancelButton && onCancelSubOrder != null)'), isTrue);
    expect(screen.contains("onPressed: () => onRequestReturn(subOrder['subOrderId'] as int, supplierName),"), isTrue);
  });
}
