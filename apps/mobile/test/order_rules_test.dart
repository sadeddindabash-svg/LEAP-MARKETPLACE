import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/order_rules.dart';

// An order that is OVER for good offers no address check, no tracking and no receipt; an order with a part still going keeps them. Plain Dart: no device needed.
Map<String, dynamic> _order({String status = 'to_ship', List<String> parts = const ['preparing'], bool autoAddress = true}) => {
      'status': status,
      'address': {'country': 'Oman'},
      'addressEnglish': {'source': autoAddress ? 'auto' : 'same'},
      'supplierSubOrders': [for (final p in parts) {'status': p}],
    };
String _stage(Map<String, dynamic> so) => so['status'] == 'delivered' ? 'delivered' : 'preparing';
List<Map<String, dynamic>> _subs(Map<String, dynamic> o) => (o['supplierSubOrders'] as List).cast<Map<String, dynamic>>();

void main() {
  group('when an order is over for good', () {
    test('cancelled, or every part cancelled; not when a part is still going; not with no parts or no order', () {
      expect(isOrderFullyCancelled(_order(status: 'cancelled')), isTrue);
      expect(isOrderFullyCancelled(_order(parts: ['cancelled', 'cancelled'])), isTrue, reason: 'the order status was not updated but every part is cancelled');
      expect(isOrderFullyCancelled(_order(parts: ['cancelled', 'preparing'])), isFalse);
      expect(isOrderFullyCancelled(_order(parts: [])), isFalse);
      expect(isOrderFullyCancelled(null), isFalse);
      expect(isOrderFullyCancelled({'supplierSubOrders': 'x'}), isFalse);
    });
    test('CRITICAL: no tracking, no receipt and no address check for it', () {
      final o = _order(status: 'cancelled', parts: ['cancelled']);
      expect(showsTrackingButton(o, _subs(o), _stage), isFalse);
      expect(showsReceiptButton(o), isFalse);
      expect(needsEnglishAddressCheckFor(o), isFalse);
      final cancelledButPartListed = _order(status: 'cancelled', parts: ['preparing']);      // the order is cancelled: whatever its parts say, nothing is going
      expect(showsTrackingButton(cancelledButPartListed, _subs(cancelledButPartListed), _stage), isFalse);
      expect(showsReceiptButton(cancelledButPartListed), isFalse);
      final inconsistent = _order(parts: ['cancelled', 'cancelled']);
      expect(showsTrackingButton(inconsistent, _subs(inconsistent), _stage), isFalse);
      expect(showsReceiptButton(inconsistent), isFalse);
      expect(needsEnglishAddressCheckFor(inconsistent), isFalse);
    });
  });
  group('when something is still going', () {
    test('CRITICAL: one part refused, another still going: tracking, receipt and the address check stay', () {
      final o = _order(parts: ['cancelled', 'preparing']);
      expect(showsTrackingButton(o, _subs(o), _stage), isTrue);
      expect(showsReceiptButton(o), isTrue);
      expect(needsEnglishAddressCheckFor(o), isTrue);
    });
    test('a cancelled part is not "still to deliver": only delivered and cancelled parts left means no tracking, but the receipt stays', () {
      final o = _order(parts: ['cancelled', 'delivered']);
      expect(showsTrackingButton(o, _subs(o), _stage), isFalse);
      expect(showsReceiptButton(o), isTrue);
    });
    test('every part delivered: a receipt but no tracking (as before); no parts at all: no tracking', () {
      final d = _order(parts: ['delivered']);
      expect(showsTrackingButton(d, _subs(d), _stage), isFalse);
      expect(showsReceiptButton(d), isTrue);
      final none = _order(parts: []);
      expect(showsTrackingButton(none, _subs(none), _stage), isFalse);
    });
  });
  group('the address check itself is unchanged', () {
    test('needed only for an automatic English address that nobody confirmed', () {
      expect(needsEnglishAddressCheckFor(_order()), isTrue);
      expect(needsEnglishAddressCheckFor(_order(autoAddress: false)), isFalse);
      expect(needsEnglishAddressCheckFor({'address': null, 'addressEnglish': {'source': 'auto'}}), isFalse);
      expect(needsEnglishAddressCheckFor(null), isFalse);
    });
  });
  group('"Request a return" follows one rule', () {
    Map<String, dynamic> part(String status, [bool? returnable]) => {'status': status, if (returnable != null) 'returnable': returnable};
    test('CRITICAL: never for a cancelled part or a part of a cancelled order, whatever the server says', () {
      expect(isSubOrderReturnable(part('cancelled', true), _order()), isFalse);
      expect(isSubOrderReturnable(part('preparing', true), _order(status: 'cancelled', parts: ['cancelled'])), isFalse);
      expect(isSubOrderReturnable(part('preparing', true), _order(parts: ['cancelled', 'cancelled'])), isFalse);
    });
    test('CRITICAL: the server decides for a part that is going: true shows, false (the return window has passed) hides', () {
      expect(isSubOrderReturnable(part('shipped', true), _order()), isTrue);
      expect(isSubOrderReturnable(part('shipped', false), _order()), isFalse);
    });
    test('an older server (no answer): returnable unless cancelled; a part still going in a partly cancelled order is returnable', () {
      expect(isSubOrderReturnable(part('preparing'), _order()), isTrue);
      expect(isSubOrderReturnable(part('cancelled'), _order()), isFalse);
      expect(isSubOrderReturnable(part('preparing', true), _order(parts: ['cancelled', 'preparing'])), isTrue);
      expect(isSubOrderReturnable(part('preparing'), null), isTrue);
    });
  });
}
