/// The category chips of the "Parts for your car" screen: the categories of the parts that fit the car, in the order they first appear, with how many parts each has; and the parts of one category.
/// Plain Dart (no Flutter), so it is tested without a device. It works on any list: `categoryOf` says which category an item is in.
List<MapEntry<String, int>> categoryCounts(Iterable<String> categories) {
  final counts = <String, int>{};
  for (final c in categories) {
    final key = c.trim();
    if (key.isEmpty) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts.entries.toList();
}

/// The items of [category]; with no category (null) all of them. A category nothing is in gives an empty list.
List<T> filterByCategory<T>(List<T> items, String? category, String Function(T item) categoryOf) {
  if (category == null) return items;
  return items.where((i) => categoryOf(i).trim() == category).toList();
}

/// A category as stored ("brake_system", "brake-pads") written for people: "Brake system". Already readable names are left as they are.
String prettyCategory(String raw) {
  final t = raw.trim().replaceAll(RegExp(r'[_-]+'), ' ');
  if (t.isEmpty) return t;
  return t[0].toUpperCase() + t.substring(1);
}
