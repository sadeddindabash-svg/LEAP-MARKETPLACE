import 'dart:math' as math;

/// One MODEL a part fits, as the server sends it in `fitGroups` (the same list the website shows): its brand and model in English and Arabic, and its years as ranges ([[2022, 2024], [2026, 2026]]).
/// Plain Dart (no Flutter), so it is tested without a device. An older server sends no `fitGroups` at all: [listFromJson] then returns null and the screen keeps its old Brand / Model / Year rows.
class FitGroup {
  final String brand;
  final String? brandAr;
  final String model;
  final String? modelAr;
  final List<List<int>> ranges;
  final int vehicleCount;

  const FitGroup({required this.brand, this.brandAr, required this.model, this.modelAr, required this.ranges, this.vehicleCount = 0});

  /// One group from the server's JSON; null when it is not one (a damaged entry is skipped, never a crash).
  static FitGroup? tryParse(Object? json) {
    if (json is! Map) return null;
    final brand = json['brand'];
    final model = json['model'];
    if (brand is! String || model is! String || (brand.trim().isEmpty && model.trim().isEmpty)) return null;
    final ranges = <List<int>>[];
    final raw = json['ranges'];
    if (raw is List) {
      for (final r in raw) {
        if (r is List && r.length == 2 && r[0] is num && r[1] is num) {
          final from = (r[0] as num).toInt();
          final to = (r[1] as num).toInt();
          if (from <= to) ranges.add([from, to]);
        }
      }
    }
    String? text(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
    final count = json['vehicleCount'];
    return FitGroup(brand: brand, brandAr: text(json['brandAr']), model: model, modelAr: text(json['modelAr']), ranges: ranges, vehicleCount: count is num ? count.toInt() : 0);
  }

  /// null when the server sent no list (an older server, or the fitment could not be read: the screen must NOT say "universal"); an empty list when the part really has no fitment (universal).
  static List<FitGroup>? listFromJson(Object? json) {
    if (json is! List) return null;
    return [for (final e in json) if (tryParse(e) != null) tryParse(e)!];
  }

  /// "BYD Seal", in Arabic when asked and the Arabic names exist.
  String name(bool isArabic) {
    final b = isArabic && brandAr != null ? brandAr! : brand;
    final m = isArabic && modelAr != null ? modelAr! : model;
    return [b, m].where((s) => s.trim().isNotEmpty).join(' ');
  }

  /// "2022–2024, 2026".
  String get years => formatRanges(ranges);
}

/// [[2022, 2024], [2026, 2026]] reads "2022–2024, 2026" (a single year is just the year).
String formatRanges(List<List<int>> ranges) => ranges.map((r) => r[0] == r[1] ? '${r[0]}' : '${r[0]}–${r[1]}').join(', ');

/// How many models are shown before "+N more models".
const int fitCollapsedLines = 3;

/// What the "Fits" row shows now: [shown] models; whether there is a "+N more" link ([collapsible]); how many models are behind it ([hiddenModels]); how many the server did not send at all ([unlisted], when a part fits more than the cap).
class FitsView {
  final List<FitGroup> shown;
  final bool collapsible;
  final int hiddenModels;
  final int unlisted;
  const FitsView({required this.shown, required this.collapsible, required this.hiddenModels, required this.unlisted});
}

FitsView fitsView(List<FitGroup> groups, int? groupCount, {required bool expanded}) {
  final total = math.max(groupCount ?? groups.length, groups.length);
  final collapsible = groups.length > fitCollapsedLines;
  final shown = expanded || !collapsible ? groups : groups.sublist(0, fitCollapsedLines);
  return FitsView(shown: shown, collapsible: collapsible, hiddenModels: total - fitCollapsedLines, unlisted: total - groups.length);
}
