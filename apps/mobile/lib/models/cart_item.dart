/// Mirrors the item shape returned by every services/api/cart endpoint
/// (GET, POST, PATCH, DELETE all return this same shape — see that
/// module's header comment for why).
class CartItem {
  final String productId;
  final int quantity;
  final String name;
  final double price;
  final String currencyCode;
  final String? supplierName;
  // Real primary product image (new) -- closes a real gap: no image
  // at all was available for a cart item before, only its name as
  // plain text.
  final String? imageUrl;
  // Real, live stock quantity (new) -- lets the UI warn/clamp a buyer
  // before checkout, rather than the only real guard being order
  // placement's own atomic stock check. See services/api/src/modules/
  // cart/routes.js's own comment on why this is an early warning, not
  // a reservation (stock isn't held per-cart anywhere in this schema).
  final int stockQuantity;
  // Real weight (#23) -- null when a real product has no real weight
  // on file, never a fabricated default.
  final double? weightKg;

  const CartItem({
    required this.productId,
    required this.quantity,
    required this.name,
    required this.price,
    required this.currencyCode,
    required this.stockQuantity,
    this.supplierName,
    this.imageUrl,
    this.weightKg,
  });

  double get lineTotal => price * quantity;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        productId: json['productId'] as String,
        quantity: json['quantity'] as int,
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        currencyCode: json['currencyCode'] as String? ?? 'USD',
        stockQuantity: json['stockQuantity'] as int? ?? 0,
        supplierName: json['supplierName'] as String?,
        imageUrl: json['imageUrl'] as String?,
        weightKg: (json['weightKg'] as num?)?.toDouble(),
      );
}
