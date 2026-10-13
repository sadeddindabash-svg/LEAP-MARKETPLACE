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
  // Brand photo: nullable. It used to be required for a new brand; since backend migration 102 a brand needs none (the photo moved to the vehicle
  // YEAR), and old brands may not have one either. A photo of the BRAND, not of this exact vehicle.
  final String? brandPhotoUrl;
  // Model photo (migration 061): nullable, optional.
  final String? modelPhotoUrl;
  // Photo of this exact vehicle YEAR (generation; backend migration 102): required for every year added since, but nullable because years that existed
  // before then have none. The most specific picture of the buyer's saved vehicle, so it comes first (see heroPhotoUrl).
  final String? generationPhotoUrl;

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
    this.generationPhotoUrl,
  });

  /// The picture of this vehicle: the YEAR photo first (a photo of this exact vehicle), then the BRAND's; null when there is none (callers then show a
  /// generic car icon). The model's photo is no longer used: models do not take a photo in Vehicle Data. Empty text counts as no photo.
  String? get heroPhotoUrl {
    for (final url in [generationPhotoUrl, brandPhotoUrl]) {
      if (url != null && url.isNotEmpty) return url;
    }
    return null;
  }

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
  // A year added through Vehicle Data is a one-year entry named by the year (generation "2021", year 2021): show just "2021", not "2021 · 2021".
  String get subLabel => generation.trim() == '$year' ? '$year' : '$generation · $year';

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
        generationPhotoUrl: json['generationPhotoUrl'] as String?,
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
        'generationPhotoUrl': generationPhotoUrl,
      };
}

/// How a vehicle year ENTRY is written in lists: a one-year entry named by its year (name "2021", 2021 to 2021) is just "2021"; an older entry (a name like
/// "F20" with a range of years) keeps its range: "F20 (2015–2019)".
String generationDisplay(String name, int yearStart, int? yearEnd) {
  if (yearEnd == yearStart && name.trim() == '$yearStart') return name;
  final years = yearEnd == null ? '$yearStart–present' : '$yearStart–$yearEnd';
  return '$name ($years)';
}
