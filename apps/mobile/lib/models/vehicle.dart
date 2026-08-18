/// Corresponds to SRS "Vehicle Reference" entity (Section 7.1).
///
/// REAL BUG FOUND AND FIXED HERE (backend migration 044): this used to
/// represent a flat make/model/trim/yearsRange row (the Year/Make/
/// Model/Trim approach originally planned for Phase 1) -- but nothing
/// in the whole codebase ever wrote a row into the join table that
/// flat system would need to actually match real products. A saved
/// vehicle could never filter the catalog to a real product. Rebuilt
/// to represent a real, specific Brand->Model->Generation->Year
/// selection instead -- the same structured cascade real product
/// fitment actually uses (migration 010), and the same shape the
/// search vehicle filter (vehicle_filter_sheet.dart) already produces.
class Vehicle {
  final String generationId;
  final int year;
  final String brand;
  final String model;
  final String generation;
  final int yearStart;
  final int? yearEnd; // null means still in production
  // Real default-vehicle flag (new, migration 047) -- which single
  // saved vehicle drives automatic fitment filtering (the home feed)
  // when a buyer has more than one saved.
  final bool isDefault;
  // Real brand photo -- nullable, not every brand has one yet. Note
  // this is a photo of the real vehicle BRAND (e.g. a generic Honda
  // image), not a photo specific to this exact model/generation.
  final String? brandPhotoUrl;
  // Real model photo (new, migration 061) -- nullable, optional even
  // for new models (unlike brands' required photo). The real
  // "Shopping for" card prefers this over brandPhotoUrl when present,
  // since it's more specific to the buyer's actual saved vehicle.
  final String? modelPhotoUrl;

  const Vehicle({
    required this.generationId,
    required this.year,
    required this.brand,
    required this.model,
    required this.generation,
    required this.yearStart,
    this.yearEnd,
    this.isDefault = false,
    this.brandPhotoUrl,
    this.modelPhotoUrl,
  });

  // Kept as a synthetic id (not a real column) purely for Flutter
  // widget keys -- deletion always needs the real (generationId, year)
  // pair, not this string, since that composite is the real backend
  // primary key (migration 044).
  String get id => '$generationId-$year';

  String get label => '$brand $model';
  String get subLabel => '$generation · $year';

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        generationId: json['generationId'] as String,
        year: json['year'] as int,
        brand: json['brand'] as String,
        model: json['model'] as String,
        generation: json['generation'] as String,
        yearStart: json['yearStart'] as int,
        yearEnd: json['yearEnd'] as int?,
        isDefault: json['isDefault'] as bool? ?? false,
        brandPhotoUrl: json['brandPhotoUrl'] as String?,
        modelPhotoUrl: json['modelPhotoUrl'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'generationId': generationId,
        'year': year,
        'brand': brand,
        'model': model,
        'generation': generation,
        'yearStart': yearStart,
        'yearEnd': yearEnd,
        'isDefault': isDefault,
        'brandPhotoUrl': brandPhotoUrl,
        'modelPhotoUrl': modelPhotoUrl,
      };
}
