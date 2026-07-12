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
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 12, vertical: small ? 3 : 6),
      decoration: BoxDecoration(
        border: Border.all(color: LeapColors.ink, width: 1.5),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: 'monospace',
          fontWeight: FontWeight.w700,
          fontSize: small ? 10.5 : 12,
          letterSpacing: 0.6,
          color: LeapColors.ink,
        ),
      ),
    );
  }
}
