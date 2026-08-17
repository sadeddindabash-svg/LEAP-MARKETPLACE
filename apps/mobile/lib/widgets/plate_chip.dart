import 'package:flutter/material.dart';
import '../core/theme.dart';

/// The "plate chip" — a license-plate-styled tag used for the active
/// vehicle filter, order IDs, and tracking numbers. This is the signature
/// visual element carried over from docs/prototypes/leap_mobile_prototype.jsx
/// — keep it consistent rather than reskinning per-screen.
class PlateChip extends StatelessWidget {
  final String text;
  final bool small;

  const PlateChip({super.key, required this.text, this.small = false});

  @override
  Widget build(BuildContext context) {
    // Real, deliberate mode-specific color (new) -- LeapColors.ink was
    // previously hardcoded regardless of theme, which read fine in
    // light mode but appeared dim/hard-to-read in dark mode (this
    // widget is shared for the active vehicle chip, order IDs, and
    // tracking numbers alike). Gold in dark mode only, matching the
    // same pattern already established elsewhere this session; light
    // mode's existing appearance is untouched.
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = isDark ? LeapPalette.of(context).signal : LeapColors.ink;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 12, vertical: small ? 3 : 6),
      decoration: BoxDecoration(
        border: Border.all(color: color, width: 1.5),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: 'monospace',
          fontWeight: FontWeight.w700,
          fontSize: small ? 10.5 : 12,
          letterSpacing: 0.6,
          color: color,
        ),
      ),
    );
  }
}
