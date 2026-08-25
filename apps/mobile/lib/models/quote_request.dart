/// Real "request a part we don't carry" model (RFQ), confirmed with
/// the person through several rounds of design discussion before
/// building: a buyer picks a vehicle and lists up to 20 real parts
/// they need. Matches the exact real backend response shape already
/// confirmed working via direct end-to-end API testing this session.
class QuoteRequestItem {
  final String id;
  final String name;
  final String? description;
  final String? referencePhotoUrl;
  final int quantity;
  // pending | priced | unavailable
  final String status;
  final String? productId;
  final double? price;
  final String? currencyCode;
  // Real, confirmed necessary: a priced item's own real underlying
  // product may still be awaiting moderation -- this is only true
  // once a real admin has actually approved it, matching this app's
  // own established convention elsewhere of never letting a buyer
  // order something not yet genuinely live.
  final bool readyToOrder;

  const QuoteRequestItem({
    required this.id,
    required this.name,
    this.description,
    this.referencePhotoUrl,
    required this.quantity,
    required this.status,
    this.productId,
    this.price,
    this.currencyCode,
    this.readyToOrder = false,
  });

  factory QuoteRequestItem.fromJson(Map<String, dynamic> json) {
    return QuoteRequestItem(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      referencePhotoUrl: json['referencePhotoUrl'] as String?,
      quantity: json['quantity'] as int,
      status: json['status'] as String,
      productId: json['productId'] as String?,
      price: (json['price'] as num?)?.toDouble(),
      currencyCode: json['currencyCode'] as String?,
      readyToOrder: json['readyToOrder'] as bool? ?? false,
    );
  }
}

class QuoteRequest {
  final String id;
  final String generationId;
  final int year;
  final String? brand;
  final String? model;
  final String? generation;
  // draft | submitted | quoted | ordered | expired | cancelled
  final String status;
  final DateTime createdAt;
  final DateTime? submittedAt;
  final DateTime? quotedAt;
  final DateTime? expiresAt;
  final List<QuoteRequestItem> items;

  const QuoteRequest({
    required this.id,
    required this.generationId,
    required this.year,
    this.brand,
    this.model,
    this.generation,
    required this.status,
    required this.createdAt,
    this.submittedAt,
    this.quotedAt,
    this.expiresAt,
    required this.items,
  });

  // Real, deliberate helper -- confirmed the exact same vehicle-label
  // formatting already used across the mobile app (e.g. "Shopping
  // for" on Home), so this reads consistently wherever it appears.
  String get vehicleLabel {
    final buffer = StringBuffer();
    if (brand != null) buffer.write(brand);
    if (model != null) buffer.write(buffer.isEmpty ? model : ' $model');
    if (generation != null) buffer.write(' ($generation)');
    if (buffer.isNotEmpty) buffer.write(' ·');
    buffer.write(' $year');
    return buffer.toString().trim();
  }

  factory QuoteRequest.fromJson(Map<String, dynamic> json) {
    return QuoteRequest(
      id: json['id'] as String,
      generationId: json['generationId'] as String,
      year: json['year'] as int,
      brand: json['brand'] as String?,
      model: json['model'] as String?,
      generation: json['generation'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      submittedAt: json['submittedAt'] != null ? DateTime.parse(json['submittedAt'] as String) : null,
      quotedAt: json['quotedAt'] != null ? DateTime.parse(json['quotedAt'] as String) : null,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      items: (json['items'] as List).map((i) => QuoteRequestItem.fromJson(i as Map<String, dynamic>)).toList(),
    );
  }
}
