/// Corresponds to SRS "Product / SKU" entity (Section 7.1).
///
/// Deliberately does NOT include supplier identity anywhere — buyers
/// should never see who the supplier is; that's platform-internal
/// information (see services/api/src/modules/catalog/routes.js's
/// toBuyerProductDto, which never sends it in the first place — this
/// isn't a "hide it in the UI" choice, the data genuinely never arrives).
///
/// `name`/`description` are already resolved to whichever language was
/// requested (English or Arabic) by the backend — this model never sees
/// the raw name_zh/name_ar columns, just a single clean name/description
/// in the language that was asked for.
class Product {
  final String id;
  final String name;
  final String? description;
  final String category;
  final String? part;
  final String? oemNumber;
  final double price;
  final String currencyCode;
  final double rating;
  final int reviewCount;
  final int stockQuantity;
  final int estimatedDeliveryDays;
  final List<String> images;
  final String? brand;
  final String? model;
  final int? year;
  final double? weightKg;
  final double? lengthCm;
  final double? widthCm;
  final double? heightCm;
  final List<String> fitsVehicleIds; // BUY-013: fitment-confirmed vehicles

  const Product({
    required this.id,
    required this.name,
    this.description,
    required this.category,
    this.part,
    this.oemNumber,
    required this.price,
    required this.currencyCode,
    required this.rating,
    required this.reviewCount,
    required this.stockQuantity,
    required this.estimatedDeliveryDays,
    this.images = const [],
    this.brand,
    this.model,
    this.year,
    this.weightKg,
    this.lengthCm,
    this.widthCm,
    this.heightCm,
    required this.fitsVehicleIds,
  });

  bool fitsVehicle(String vehicleId) => fitsVehicleIds.contains(vehicleId);

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        category: json['category'] as String,
        part: json['part'] as String?,
        oemNumber: json['oemNumber'] as String?,
        price: (json['price'] as num).toDouble(),
        currencyCode: json['currencyCode'] as String? ?? 'USD',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewCount: json['reviewCount'] as int? ?? 0,
        stockQuantity: json['stockQuantity'] as int? ?? 0,
        estimatedDeliveryDays: json['estimatedDeliveryDays'] as int? ?? 7,
        images: (json['images'] as List?)?.cast<String>() ?? const [],
        brand: json['brand'] as String?,
        model: json['model'] as String?,
        year: json['year'] as int?,
        weightKg: (json['weightKg'] as num?)?.toDouble(),
        lengthCm: (json['lengthCm'] as num?)?.toDouble(),
        widthCm: (json['widthCm'] as num?)?.toDouble(),
        heightCm: (json['heightCm'] as num?)?.toDouble(),
        fitsVehicleIds: (json['fitsVehicleIds'] as List?)?.cast<String>() ?? const [],
      );
}
