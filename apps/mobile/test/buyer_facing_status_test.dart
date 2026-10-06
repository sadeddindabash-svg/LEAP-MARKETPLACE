import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/widgets/order_status_timeline.dart';

/// A buyer is never shown "dispute": a shipment the inspection hub flagged is a quality check Leap is handling, and the buyer already
/// sees the return request opened for them on the order page. `buyerFacingStatus` turns 'dispute' into the ordinary in-progress stage
/// and leaves every other status exactly as it was.
///
/// NOTE: this was written without a Flutter SDK available, so it has been read carefully but NOT run -- please run `flutter test` once.
void main() {
  test("'dispute' is shown to the buyer as the ordinary in-progress stage", () {
    expect(buyerFacingStatus('dispute'), 'preparing');
  });

  test('every other status is left exactly as it was', () {
    for (final status in ['pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'returns', 'to_ship']) {
      expect(buyerFacingStatus(status), status);
    }
  });
}
