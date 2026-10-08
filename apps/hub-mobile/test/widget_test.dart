import 'package:flutter_test/flutter_test.dart';
import 'package:leap_hub_mobile/models/shipment.dart';

// The old content of this file was the default Flutter template (it referred to a `MyApp` that does not exist, so it could never pass). These tests
// check the logic behind the faulty-unit panel and closed flags: pure Dart, no screens.
Map<String, dynamic> detailJson({String status = 'flagged', Map<String, dynamic>? faultCase, String? resolution, String? resolvedAt, String? replacementFor}) => {
      'id': 7,
      'status': status,
      'createdAt': '2026-07-01T00:00:00.000Z',
      'updatedAt': '2026-07-02T00:00:00.000Z',
      'orderId': 'LP-100001',
      'supplierName': 'Guangzhou AutoParts Co.',
      'items': [],
      'events': [],
      'faultCase': faultCase,
      'resolution': resolution,
      'resolvedAt': resolvedAt,
      'replacementFor': replacementFor,
    };

Map<String, dynamic> faultJson({bool needsReturn = true}) => {
      'items': [
        {'productId': 'p1', 'name': 'RIDEX Front Brake Disc', 'quantity': 2},
        {'productId': 'p4', 'quantity': 1},
      ],
      'needsReturn': needsReturn,
      'platformStage': 'reviewing',
      'returnAddress': {'contactName': 'Wei Zhang', 'phone': '+86 20 1234 5678', 'address': '12 Industrial Road, Panyu, Guangzhou', 'updatedAt': '2026-07-01T00:00:00.000Z'},
    };

void main() {
  group('a flag the platform closed reads "closed"', () {
    test('only a flagged shipment that has a resolved time', () {
      expect(displayStatusOf('flagged', DateTime(2026, 7, 1)), 'closed');
      expect(displayStatusOf('flagged', null), 'flagged');
      expect(displayStatusOf('received', DateTime(2026, 7, 1)), 'received');
      expect(displayStatusOf('returned_to_supplier', DateTime(2026, 7, 1)), 'returned_to_supplier');
    });

    test('the flagged family is flagged, returned and discarded, and nothing else', () {
      expect(kFlaggedStatuses, {'flagged', 'returned_to_supplier', 'discarded_at_hub'});
      expect(kFlaggedStatuses.contains('delivered'), false);
    });
  });

  group('the shipment list item', () {
    test('reads the replacement, the resolution and the resolved time; a closed flag reads closed', () {
      final item = ShipmentSummary.fromJson({
        'id': 7, 'status': 'flagged', 'createdAt': '2026-07-01T00:00:00.000Z', 'updatedAt': '2026-07-02T00:00:00.000Z',
        'subOrderId': 11, 'orderId': 'LP-100001-R1', 'supplierName': 'Guangzhou AutoParts Co.',
        'replacementFor': 'LP-100001', 'resolution': 'fault_closed_manually', 'resolvedAt': '2026-07-03T00:00:00.000Z',
      });
      expect(item.replacementFor, 'LP-100001');
      expect(item.resolution, 'fault_closed_manually');
      expect(item.displayStatus, 'closed');
    });

    test('an open flag, and a reply from an older server without the new fields, still work', () {
      final open = ShipmentSummary.fromJson({
        'id': 8, 'status': 'flagged', 'createdAt': '2026-07-01T00:00:00.000Z', 'updatedAt': '2026-07-02T00:00:00.000Z',
        'subOrderId': 12, 'orderId': 'LP-100002', 'supplierName': 'x', 'replacementFor': null, 'resolution': null, 'resolvedAt': null,
      });
      expect(open.displayStatus, 'flagged');
      final older = ShipmentSummary.fromJson({
        'id': 9, 'status': 'packed', 'createdAt': '2026-07-01T00:00:00.000Z', 'updatedAt': '2026-07-02T00:00:00.000Z',
        'subOrderId': 13, 'orderId': 'LP-100003', 'supplierName': 'x',
      });
      expect(older.displayStatus, 'packed');
      expect(older.replacementFor, null);
    });
  });

  group('the shipment detail and the faulty-unit panel', () {
    test('a confirmed fault still at the hub needs the unit to be sent back or discarded, and carries the return address', () {
      final detail = ShipmentDetail.fromJson(detailJson(faultCase: faultJson()));
      expect(detail.needsFaultReturn, true);
      expect(detail.faultCase!.items.length, 2);
      expect(detail.faultCase!.items[0].name, 'RIDEX Front Brake Disc');
      expect(detail.faultCase!.items[1].name, 'p4'); // no name sent: the product id is shown instead
      expect(detail.faultCase!.returnAddress!.contactName, 'Wei Zhang');
      expect(detail.faultCase!.returnAddress!.address, '12 Industrial Road, Panyu, Guangzhou');
    });

    test('once the case is closed, or the unit has left, or there is no case, nothing is left for the hub', () {
      expect(ShipmentDetail.fromJson(detailJson(faultCase: faultJson(needsReturn: false))).needsFaultReturn, false);
      expect(ShipmentDetail.fromJson(detailJson(status: 'returned_to_supplier', faultCase: faultJson())).needsFaultReturn, false);
      expect(ShipmentDetail.fromJson(detailJson()).needsFaultReturn, false);
    });

    test('a supplier without a return address gives no address (the app then says to contact the platform)', () {
      final fault = faultJson()..['returnAddress'] = null;
      expect(ShipmentDetail.fromJson(detailJson(faultCase: fault)).faultCase!.returnAddress, null);
    });

    test('a replacement and a closed flag are read from the detail', () {
      final detail = ShipmentDetail.fromJson(detailJson(replacementFor: 'LP-100001', resolution: 'fault_closed_manually', resolvedAt: '2026-07-03T00:00:00.000Z'));
      expect(detail.replacementFor, 'LP-100001');
      expect(detail.displayStatus, 'closed');
      expect(detail.resolution, 'fault_closed_manually');
    });
  });
}
