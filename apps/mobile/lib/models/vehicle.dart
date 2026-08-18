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
  // Real Arabic brand name -- nullable, not every brand has one yet
  // (migration 046). Used by labelFor() when the app's own language
  // is Arabic, falling back to the English brand name if this
  // specific brand doesn't have one.
  final String? brandAr;
  final String model;
  // Real Arabic model name (new, migration 062) -- nullable, models
  // never required this field at all. Same fallback behavior as
  // brandAr above.
  final String? modelAr;
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
    this.brandAr,
    required this.model,
    this.modelAr,
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

  // Real, confirmed with the person -- brand/model names in Arabic
  // when the app's own language is Arabic, closing the real gap
  // where My Garage (and the Home screen's "Shopping for" card) always
  // showed English names regardless of app language. isArabic is
  // passed in explicitly (rather than this class reading it itself)
  // since Vehicle is a plain data model with no BuildContext access.
  // Each part falls back to English independently -- a brand with a
  // real Arabic name paired with a model that doesn't have one yet
  // still shows correctly, rather than the whole label falling back
  // to English just because one half is missing.
  String labelFor(bool isArabic) {
    final displayBrand = isArabic ? (brandAr ?? brand) : brand;
    final displayModel = isArabic ? (modelAr ?? model) : model;
    return '$displayBrand $displayModel';
  }

  // Real, deliberately unchanged -- generation names (e.g. "XV70") are
  // technical codes, not real translatable text, and vehicle_generations
  // has no real name_ar column at all. The year itself is already
  // language-neutral.
  String get subLabel => '$generation · $year';

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        generationId: json['generationId'] as String,
        year: json['year'] as int,
        brand: json['brand'] as String,
        brandAr: json['brandAr'] as String?,
        model: json['model'] as String,
        modelAr: json['modelAr'] as String?,
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
        'brandAr': brandAr,
        'model': model,
        'modelAr': modelAr,
        'generation': generation,
        'yearStart': yearStart,
        'yearEnd': yearEnd,
        'isDefault': isDefault,
        'brandPhotoUrl': brandPhotoUrl,
        'modelPhotoUrl': modelPhotoUrl,
      };
}
