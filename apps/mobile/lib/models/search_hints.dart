/// The suggestions that slide through the home search bar, the SAME four (and the same words) as the website's search box, in English and in Arabic. Plain Dart, so it is tested without a device.
/// Each one stays 3 seconds; the slide to the next takes half a second.
const int searchHintShowMs = 3000;
const int searchHintSlideMs = 500;

const List<String> searchHintsEn = [
  'Search “brake pads”',
  'Search “oil filter”',
  'Search by OEM number, e.g. 12345-67890',
  'Search by VIN or by car, e.g. BYD Seal',
];
const List<String> searchHintsAr = [
  'ابحث عن «تيل فرامل»',
  'ابحث عن «فلتر زيت»',
  'ابحث برقم OEM، مثل 12345-67890',
  'ابحث برقم الهيكل (VIN) أو بالسيارة، مثل BYD Seal',
];

List<String> searchHints(bool isArabic) => isArabic ? searchHintsAr : searchHintsEn;

/// The suggestion to show at step [tick] (0, 1, 2, ...): they go round and round in order; a negative tick is treated like its place in the circle.
String searchHintAt(bool isArabic, int tick) {
  final list = searchHints(isArabic);
  return list[((tick % list.length) + list.length) % list.length];
}
