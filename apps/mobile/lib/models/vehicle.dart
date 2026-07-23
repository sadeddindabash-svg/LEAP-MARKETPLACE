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

  const Vehicle({
    required this.generationId,
    required this.year,
    required this.brand,
    required this.model,
    required this.generation,
    required this.yearStart,
    this.yearEnd,
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
      );

  Map<String, dynamic> toJson() => {
        'generationId': generationId,
        'year': year,
        'brand': brand,
        'model': model,
        'generation': generation,
        'yearStart': yearStart,
        'yearEnd': yearEnd,
      };
}
