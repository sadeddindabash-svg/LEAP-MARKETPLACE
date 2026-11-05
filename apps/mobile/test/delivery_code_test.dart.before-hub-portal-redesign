import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Proof of delivery for the buyer (migration 120): the code for the driver, the attempt notice, "This isn't my parcel". Reads the source text.
void main() {
  test('the order page and Track your package show the delivery code and the proof', () {
    final widgets = File('lib/widgets/delivery_confirm.dart').readAsStringSync();
    expect(widgets.contains('class DeliveryCodeCard extends StatelessWidget'), isTrue);
    expect(widgets.contains('class DeliveryProofSummary extends StatefulWidget'), isTrue);
    expect(widgets.contains("'رمز التسليم'"), isTrue);
    final order = File('lib/features/orders/order_detail_screen.dart').readAsStringSync();
    expect(order.contains('DeliveryCodeCard(code: deliveryCode)'), isTrue);
    expect(order.contains('DeliveryProofSummary(proof: deliveryProof!'), isTrue);
    final tracking = File('lib/features/orders/tracking_screen.dart').readAsStringSync();
    expect(tracking.contains("DeliveryCodeCard(code: so['deliveryCode'] as String)"), isTrue);
  });
}
