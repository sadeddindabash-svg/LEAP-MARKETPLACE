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

  const CartItem({
    required this.productId,
    required this.quantity,
    required this.name,
    required this.price,
    required this.currencyCode,
    this.supplierName,
  });

  double get lineTotal => price * quantity;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        productId: json['productId'] as String,
        quantity: json['quantity'] as int,
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        currencyCode: json['currencyCode'] as String? ?? 'USD',
        supplierName: json['supplierName'] as String?,
      );
}
