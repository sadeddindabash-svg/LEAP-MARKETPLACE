/// Does this part fit the buyer's saved car, using the car's VERSION only when the part is narrowed to some versions? Plain Dart (no Flutter), so it is tested without a device.
/// The part lists the cars it fits (fitsVehicleIds: by generation, the app's own rule); a car (generation and year) may be NARROWED to some versions (fitVersions: { "generationId|year": [version ids] }).
/// A car that is not in fitVersions fits EVERY version.
enum FitKind {
  fits, // on the list, and every version fits (or the part is not narrowed for this car)
  fitsVersions, // on the list, narrowed, and the buyer's version is one of them
  wrongVersion, // on the list, narrowed, and the buyer's version is NOT one of them
  needVersion, // on the list, narrowed, and the saved car has no version yet
  notListed, // not on the part's list
}

class FitVerdict {
  final FitKind kind;
  final List<String> versionIds; // the versions the part is for (empty unless narrowed)
  const FitVerdict(this.kind, [this.versionIds = const []]);

  /// The "CONFIRMED FIT" badge is for these two only.
  bool get confirmed => kind == FitKind.fits || kind == FitKind.fitsVersions;
}

FitVerdict fitVerdict({
  required String generationId,
  required int year,
  String? versionId,
  required List<String> fitsVehicleIds,
  Map<String, List<String>> fitVersions = const {},
}) {
  if (!fitsVehicleIds.contains(generationId)) return const FitVerdict(FitKind.notListed);
  final rule = fitVersions['$generationId|$year'];
  if (rule == null || rule.isEmpty) return const FitVerdict(FitKind.fits);
  if (versionId == null || versionId.isEmpty) return FitVerdict(FitKind.needVersion, rule);
  return rule.contains(versionId) ? FitVerdict(FitKind.fitsVersions, rule) : FitVerdict(FitKind.wrongVersion, rule);
}

/// The server's fitVersions ({ "generation|year": [ids] }) read safely: anything that is not that shape is ignored (an older server sends none).
Map<String, List<String>> parseFitVersions(dynamic json) {
  if (json is! Map) return const {};
  final out = <String, List<String>>{};
  json.forEach((key, value) {
    if (key is String && value is List) {
      final ids = value.whereType<String>().toList();
      if (ids.isNotEmpty) out[key] = ids;
    }
  });
  return out;
}

/// The server's fitVersionNames ({ versionId: { name, nameAr } }) read safely.
Map<String, Map<String, String?>> parseFitVersionNames(dynamic json) {
  if (json is! Map) return const {};
  final out = <String, Map<String, String?>>{};
  json.forEach((key, value) {
    if (key is String && value is Map) out[key] = {'name': value['name'] as String?, 'nameAr': value['nameAr'] as String?};
  });
  return out;
}

/// The name to show for a version: Arabic when the app is in Arabic and there is one, else the English name, else the id.
String versionNameOf(Map<String, Map<String, String?>> names, String id, bool arabic) {
  final n = names[id];
  if (n == null) return id;
  final ar = n['nameAr'];
  if (arabic && ar != null && ar.isNotEmpty) return ar;
  final en = n['name'];
  return (en != null && en.isNotEmpty) ? en : id;
}
