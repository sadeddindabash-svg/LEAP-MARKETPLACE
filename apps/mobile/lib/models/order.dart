/// Corresponds to SRS "Order" and "Supplier Sub-Order" entities (Section 7.1).
/// Note: a single buyer order can split into multiple supplier sub-orders
/// (BUY-031) — the buyer always sees one order with one total, regardless.
enum OrderStatus { toPay, toShip, shipped, toReview, delivered, returns }

class OrderItem {
  final String productName;
  final int quantity;
  final String supplierName;

  const OrderItem({required this.productName, required this.quantity, required this.supplierName});
}

class Order {
  final String id; // e.g. "LP-208841"
  final DateTime placedAt;
  final OrderStatus status;
  final double total;
  final String currencyCode;
  final List<OrderItem> items;
  final String? trackingNumber;

  const Order({
    required this.id,
    required this.placedAt,
    required this.status,
    required this.total,
    required this.currencyCode,
    required this.items,
    this.trackingNumber,
  });
}
