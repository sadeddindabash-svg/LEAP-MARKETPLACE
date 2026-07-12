/// Corresponds to SRS "Vehicle Reference" entity (Section 7.1) and the
/// Year/Make/Model/Trim (YMMT) fitment approach used in Phase 1 (BUY-010).
class Vehicle {
  final String id;
  final String make;
  final String model;
  final String trim;
  final String yearsRange; // e.g. "2015–2019" — display only in Phase 1

  const Vehicle({
    required this.id,
    required this.make,
    required this.model,
    required this.trim,
    required this.yearsRange,
  });

  String get label => '$make $model';
  String get subLabel => '$trim · $yearsRange';

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        id: json['id'] as String,
        make: json['make'] as String,
        model: json['model'] as String,
        trim: json['trim'] as String,
        yearsRange: json['yearsRange'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'make': make,
        'model': model,
        'trim': trim,
        'yearsRange': yearsRange,
      };
}
