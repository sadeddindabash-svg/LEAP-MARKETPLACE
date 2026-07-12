/// Corresponds to SRS "Product / SKU" entity (Section 7.1).
class Product {
  final String id;
  final String name;
  final String category;
  final double price;
  final String currencyCode;
  final String supplierName;
  final double rating;
  final int reviewCount;
  final int stockQuantity;
  final int estimatedDeliveryDays;
  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles

  const Product({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.currencyCode,
    required this.supplierName,
    required this.rating,
    required this.reviewCount,
    required this.stockQuantity,
    required this.estimatedDeliveryDays,
    required this.fitsVehicleIds,
  });

  bool fitsVehicle(String vehicleId) => fitsVehicleIds.contains(vehicleId);

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        category: json['category'] as String,
        price: (json['price'] as num).toDouble(),
        currencyCode: json['currencyCode'] as String? ?? 'USD',
        supplierName: json['supplierName'] as String,
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewCount: json['reviewCount'] as int? ?? 0,
        stockQuantity: json['stockQuantity'] as int? ?? 0,
        estimatedDeliveryDays: json['estimatedDeliveryDays'] as int? ?? 7,
        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],
      );
}
