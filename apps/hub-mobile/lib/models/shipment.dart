/// Matches GET /hub/me/shipments's real, confirmed response shape --
/// the queue's own list-item fields only, not the full detail.
class ShipmentSummary {
  final String id;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String subOrderId;
  final String orderId;
  final String supplierName;

  ShipmentSummary({
    required this.id, required this.status, required this.createdAt, required this.updatedAt,
    required this.subOrderId, required this.orderId, required this.supplierName,
  });

  factory ShipmentSummary.fromJson(Map<String, dynamic> json) => ShipmentSummary(
        id: json['id'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        subOrderId: json['subOrderId'] as String,
        orderId: json['orderId'] as String,
        supplierName: json['supplierName'] as String,
      );
}

class ShipmentItem {
  final String productId;
  final String name;
  final int quantity;

  ShipmentItem({required this.productId, required this.name, required this.quantity});

  factory ShipmentItem.fromJson(Map<String, dynamic> json) => ShipmentItem(
        productId: json['productId'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
      );
}

/// Matches attachEventsAndPhotos's real, confirmed shape exactly
/// (services/api/src/modules/hub/routes.js) -- performedBy is
/// genuinely an email address (performed_by_email), not a display
/// name, matching the backend's own real data.
class ShipmentEvent {
  final String id;
  final String step;
  final String? notes;
  final String? trackingNumber;
  final String? performedBy;
  final DateTime createdAt;
  final List<String> photos;

  ShipmentEvent({
    required this.id, required this.step, this.notes, this.trackingNumber,
    this.performedBy, required this.createdAt, required this.photos,
  });

  factory ShipmentEvent.fromJson(Map<String, dynamic> json) => ShipmentEvent(
        id: json['id'].toString(),
        step: json['step'] as String,
        notes: json['notes'] as String?,
        trackingNumber: json['trackingNumber'] as String?,
        performedBy: json['performedBy'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        photos: (json['photos'] as List<dynamic>).map((p) => p as String).toList(),
      );
}

/// Matches GET /hub/me/shipments/:id's real, confirmed full detail
/// shape.
class ShipmentDetail {
  final String id;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String orderId;
  final String supplierName;
  final List<ShipmentItem> items;
  final List<ShipmentEvent> events;

  ShipmentDetail({
    required this.id, required this.status, required this.createdAt, required this.updatedAt,
    required this.orderId, required this.supplierName, required this.items, required this.events,
  });

  factory ShipmentDetail.fromJson(Map<String, dynamic> json) => ShipmentDetail(
        id: json['id'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        orderId: json['orderId'] as String,
        supplierName: json['supplierName'] as String,
        items: (json['items'] as List<dynamic>).map((i) => ShipmentItem.fromJson(i as Map<String, dynamic>)).toList(),
        events: (json['events'] as List<dynamic>).map((e) => ShipmentEvent.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

/// The 6 real statuses a shipment moves through, in order -- matches
/// the backend's own STATUS_ORDER constant exactly (services/api/src/
/// modules/hub/routes.js line 26), plus the two real terminal states
/// reachable only via flagging or delivery confirmation.
const List<String> kStatusOrder = ['awaiting_receipt', 'received', 'opened', 'inspected', 'packed', 'shipped_to_buyer'];
const List<String> kInProgressStatuses = ['received', 'opened', 'inspected', 'packed'];

String? nextStatusFor(String currentStatus) {
  final idx = kStatusOrder.indexOf(currentStatus);
  if (idx < 0 || idx >= kStatusOrder.length - 1) return null;
  return kStatusOrder[idx + 1];
}
