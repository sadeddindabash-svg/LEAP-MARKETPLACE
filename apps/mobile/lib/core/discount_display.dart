import 'package:flutter/material.dart';

/// Confirmed with the person via a full mockup of all 4 tiers in both
/// light and dark mode before implementing (see ProductCard's own
/// original commit): discount tag color is tiered by magnitude, not
/// fixed -- a bigger real discount stands out with a genuinely
/// distinct hue, not just a shade variation of one color. Extracted
/// here from product_card.dart so product_screen.dart can reuse this
/// exact same real logic rather than a second, separately-maintained
/// copy.
Color discountTagColor(int percent) {
  if (percent <= 10) return const Color(0xFF791F1F); // dark red
  if (percent <= 20) return const Color(0xFF0C447C); // dark blue
  if (percent <= 30) return const Color(0xFF27500A); // dark green
  return const Color(0xFFEF9F27); // golden yellow
}

Color discountTagTextColor(int percent) {
  // Real, confirmed contrast fix -- golden yellow is too light for
  // white text to read well against (the same real white-on-gold
  // issue already found and fixed elsewhere in this app's own
  // add-to-cart button), so this one tier alone uses dark text.
  return percent > 30 ? const Color(0xFF412402) : Colors.white;
}
