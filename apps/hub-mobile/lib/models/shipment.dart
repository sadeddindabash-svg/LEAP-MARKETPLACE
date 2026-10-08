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
  // The order a free REPLACEMENT stands in for (null for a normal shipment), and how the platform closed a flag (null while it is still open).
  final String? replacementFor;
  final String? resolution;
  final DateTime? resolvedAt;

  ShipmentSummary({
    required this.id, required this.status, required this.createdAt, required this.updatedAt,
    required this.subOrderId, required this.orderId, required this.supplierName,
    this.replacementFor, this.resolution, this.resolvedAt,
  });

  factory ShipmentSummary.fromJson(Map<String, dynamic> json) => ShipmentSummary(
        id: json['id'].toString(),
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        subOrderId: json['subOrderId'].toString(),
        orderId: json['orderId'] as String,
        supplierName: json['supplierName'] as String,
        replacementFor: json['replacementFor'] as String?,
        resolution: json['resolution'] as String?,
        resolvedAt: json['resolvedAt'] == null ? null : DateTime.parse(json['resolvedAt'] as String),
      );

  /// A flag the platform has CLOSED keeps its "flagged" status but is no longer an open problem: it reads "closed".
  String get displayStatus => displayStatusOf(status, resolvedAt);
}

class ShipmentItem {
  final String productId;
  final String name;
  final int quantity;
  // Confirmed with the person: the real, actual quantity a hub
  // worker counted on arrival -- null means not yet checked, never
  // auto-flags a mismatch (the worker decides for themselves).
  final int? receivedQuantity;
  final String? part;
  final String? position;
  final String? oemNumber;
  // Confirmed with the person: a fully flexible attribute list,
  // since different real part types need different real specs.
  final List<ProductAttribute> attributes;

  ShipmentItem({
    required this.productId, required this.name, required this.quantity,
    this.receivedQuantity, this.part, this.position, this.oemNumber,
    this.attributes = const [],
  });

  factory ShipmentItem.fromJson(Map<String, dynamic> json) => ShipmentItem(
        productId: json['productId'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        receivedQuantity: json['receivedQuantity'] as int?,
        part: json['part'] as String?,
        position: json['position'] as String?,
        oemNumber: json['oemNumber'] as String?,
        attributes: (json['attributes'] as List<dynamic>? ?? [])
            .map((a) => ProductAttribute.fromJson(a as Map<String, dynamic>))
            .toList(),
      );
}

class ProductAttribute {
  final String name;
  final String value;

  ProductAttribute({required this.name, required this.value});

  factory ProductAttribute.fromJson(Map<String, dynamic> json) =>
      ProductAttribute(name: json['name'] as String, value: json['value'] as String);
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
  // Confirmed with the person: "shipment X of Y" real context -- lets
  // a hub worker see the full picture of a real multi-supplier order,
  // not just the piece in front of them.
  final int shipmentIndex;
  final int totalShipments;
  final List<SiblingShipment> otherShipments;
  final List<ShipmentItem> items;
  final List<ShipmentEvent> events;
  // Confirmed with the person via mockup: the real, permanent
  // delivery address snapshot for this order, shown once inspection
  // is done. Null when genuinely no address is on file.
  final DeliveryAddress? deliveryAddress;
  // A free replacement for a faulty unit (the order the buyer paid for); how the platform closed a flag (null while open); and, for a confirmed
  // fault, what the hub must do with the faulty unit.
  final String? replacementFor;
  final String? resolution;
  final DateTime? resolvedAt;
  final FaultCaseInfo? faultCase;

  ShipmentDetail({
    required this.id, required this.status, required this.createdAt, required this.updatedAt,
    required this.orderId, required this.supplierName,
    this.shipmentIndex = 1, this.totalShipments = 1, this.otherShipments = const [],
    required this.items, required this.events, this.deliveryAddress,
    this.replacementFor, this.resolution, this.resolvedAt, this.faultCase,
  });

  factory ShipmentDetail.fromJson(Map<String, dynamic> json) => ShipmentDetail(
        id: json['id'].toString(),
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        orderId: json['orderId'] as String,
        supplierName: json['supplierName'] as String,
        shipmentIndex: json['shipmentIndex'] as int? ?? 1,
        totalShipments: json['totalShipments'] as int? ?? 1,
        otherShipments: (json['otherShipments'] as List<dynamic>? ?? [])
            .map((s) => SiblingShipment.fromJson(s as Map<String, dynamic>))
            .toList(),
        items: (json['items'] as List<dynamic>).map((i) => ShipmentItem.fromJson(i as Map<String, dynamic>)).toList(),
        events: (json['events'] as List<dynamic>).map((e) => ShipmentEvent.fromJson(e as Map<String, dynamic>)).toList(),
        deliveryAddress: json['deliveryAddress'] == null ? null : DeliveryAddress.fromJson(json['deliveryAddress'] as Map<String, dynamic>),
        replacementFor: json['replacementFor'] as String?,
        resolution: json['resolution'] as String?,
        resolvedAt: json['resolvedAt'] == null ? null : DateTime.parse(json['resolvedAt'] as String),
        faultCase: json['faultCase'] == null ? null : FaultCaseInfo.fromJson(json['faultCase'] as Map<String, dynamic>),
      );

  /// A flag the platform has CLOSED keeps its "flagged" status but is no longer an open problem: it reads "closed".
  String get displayStatus => displayStatusOf(status, resolvedAt);

  /// A real fault was confirmed and the faulty unit is still at this hub: it must be sent back or discarded.
  bool get needsFaultReturn => status == 'flagged' && (faultCase?.needsReturn ?? false);
}

class DeliveryAddress {
  final String recipientName;
  final String phone;
  final String country;
  final String city;
  final String streetAddress;
  final String? postalCode;

  DeliveryAddress({
    required this.recipientName, required this.phone, required this.country,
    required this.city, required this.streetAddress, this.postalCode,
  });

  factory DeliveryAddress.fromJson(Map<String, dynamic> json) => DeliveryAddress(
        recipientName: json['recipientName'] as String,
        phone: json['phone'] as String,
        country: json['country'] as String,
        city: json['city'] as String,
        streetAddress: json['streetAddress'] as String,
        postalCode: json['postalCode'] as String?,
      );
}

class SiblingShipment {
  final String supplierName;
  final String status;

  SiblingShipment({required this.supplierName, required this.status});

  factory SiblingShipment.fromJson(Map<String, dynamic> json) =>
      SiblingShipment(supplierName: json['supplierName'] as String, status: json['status'] as String);
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


/// The statuses of a shipment the hub has flagged, from the flag until the unit has left.
const Set<String> kFlaggedStatuses = {'flagged', 'returned_to_supplier', 'discarded_at_hub'};

/// A flagged shipment whose flag the platform has CLOSED reads "closed" (it keeps the "flagged" status, only `resolvedAt` says it is over).
String displayStatusOf(String status, DateTime? resolvedAt) => status == 'flagged' && resolvedAt != null ? 'closed' : status;

/// Where to send a faulty unit back to: the supplier's return address (null when the supplier has not entered one).
class ReturnAddress {
  final String contactName;
  final String phone;
  final String address;

  ReturnAddress({required this.contactName, required this.phone, required this.address});

  factory ReturnAddress.fromJson(Map<String, dynamic> json) => ReturnAddress(
        contactName: json['contactName'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        address: json['address'] as String? ?? '',
      );
}

class FaultCaseItem {
  final String productId;
  final String name;
  final int quantity;

  FaultCaseItem({required this.productId, required this.name, required this.quantity});

  factory FaultCaseItem.fromJson(Map<String, dynamic> json) => FaultCaseItem(
        productId: json['productId'] as String,
        name: (json['name'] as String?) ?? (json['productId'] as String),
        quantity: json['quantity'] as int,
      );
}

/// What the HUB sees of a confirmed fault (GET /hub/me/shipments/:id -> faultCase): nothing about money or who decided what.
/// `platformStage`: reviewing / finalising / closed. `needsReturn` is true while the faulty unit is still at this hub and the case is not closed.
class FaultCaseInfo {
  final List<FaultCaseItem> items;
  final bool needsReturn;
  final String platformStage;
  final ReturnAddress? returnAddress;

  FaultCaseInfo({required this.items, required this.needsReturn, required this.platformStage, this.returnAddress});

  factory FaultCaseInfo.fromJson(Map<String, dynamic> json) => FaultCaseInfo(
        items: (json['items'] as List<dynamic>? ?? []).map((i) => FaultCaseItem.fromJson(i as Map<String, dynamic>)).toList(),
        needsReturn: json['needsReturn'] as bool? ?? false,
        platformStage: json['platformStage'] as String? ?? 'reviewing',
        returnAddress: json['returnAddress'] == null ? null : ReturnAddress.fromJson(json['returnAddress'] as Map<String, dynamic>),
      );
}
