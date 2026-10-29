/// A reviewer's name as other buyers see it, the same rule as the website: the first 2 letters in capitals, ***, the last 2
/// ("michael" -> "MI***el"). 4 letters or fewer: the first and *** ("Ali" -> "A***"). Spaces are ignored. Empty -> null (the screen shows "Buyer").
String? maskReviewerName(String? name) {
  if (name == null) return null;
  final chars = name.replaceAll(RegExp(r'\s+'), '').runes.map(String.fromCharCode).toList();
  if (chars.isEmpty) return null;
  if (chars.length <= 4) return '${chars.first.toUpperCase()}***';
  return '${chars[0].toUpperCase()}${chars[1].toUpperCase()}***${chars[chars.length - 2]}${chars[chars.length - 1]}';
}
