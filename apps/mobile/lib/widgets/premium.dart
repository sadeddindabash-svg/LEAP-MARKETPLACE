import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Style B "Premium 3D" (confirmed with the person via mockup): cards lit from above (a light top edge, a soft deep shadow), raised gold, and a
/// press that makes a card sink a little. Light and dark mode.
class Premium {
  Premium._();

  static const gold = Color(0xFFF9B317);

  /// A raised card: white to a faint grey from top to bottom, a white top edge, a near shadow and a deep soft one.
  static BoxDecoration card(BuildContext context, {double radius = 14, Color? ring}) => cardFor(LeapPalette.of(context), radius: radius, ring: ring);

  /// The same raised card from a palette (where the screen already has one); [ring] gives it a coloured edge (the chosen or default one).
  static BoxDecoration cardFor(LeapPalette p, {double radius = 14, Color? ring}) {
    final edge = ring == null ? null : Border.all(color: ring, width: 2);
    if (identical(p, LeapPalette.dark)) {
      return BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(radius),
        border: edge ?? Border.all(color: Colors.white.withValues(alpha: 0.06)),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 18, offset: Offset(0, 8))],
      );
    }
    return BoxDecoration(
      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFF7F9FB)]),
      borderRadius: BorderRadius.circular(radius),
      border: edge ?? Border.all(color: Colors.white),
      boxShadow: const [
        BoxShadow(color: Color(0x140B3146), blurRadius: 4, offset: Offset(0, 2)),
        BoxShadow(color: Color(0x290B3146), blurRadius: 22, spreadRadius: -4, offset: Offset(0, 10)),
      ],
    );
  }

  /// Raised gold (an icon tile, the chosen tab): a light-to-deep gold gradient and a warm shadow.
  static BoxDecoration goldRaised({double radius = 9}) => BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFD567), gold, Color(0xFFE39F0C)], stops: [0, 0.55, 1]),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [BoxShadow(color: Color(0x73E39F0C), blurRadius: 10, offset: Offset(0, 4))],
      );

  /// A raised round button (a section icon on Home): a white rim, lit from above.
  static BoxDecoration round(BuildContext context) {
    if (Theme.of(context).brightness == Brightness.dark) {
      return BoxDecoration(
        color: LeapPalette.of(context).card,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 6))],
      );
    }
    return BoxDecoration(
      shape: BoxShape.circle,
      gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFEEF2F6)]),
      boxShadow: const [
        BoxShadow(color: Color(0x1A0B3146), blurRadius: 5, offset: Offset(0, 3)),
        BoxShadow(color: Color(0x290B3146), blurRadius: 18, spreadRadius: -2, offset: Offset(0, 10)),
      ],
    );
  }

  /// Raised navy (Leap's own boxes: the account header, Leap's messages, a quotation's status): a deep navy gradient, a soft light edge,
  /// a deep shadow. Use [gloss] as a foregroundDecoration for the shine across its top.
  static BoxDecoration navyRaised({double radius = 16}) => BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0B3146), Color(0xFF215A78)]),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0x24FFFFFF)),
        boxShadow: const [
          BoxShadow(color: Color(0x400B3146), blurRadius: 6, offset: Offset(0, 2)),
          BoxShadow(color: Color(0x590B3146), blurRadius: 30, spreadRadius: -4, offset: Offset(0, 14)),
        ],
      );

  /// The soft shine across the top of a raised navy box.
  static BoxDecoration gloss({double radius = 16}) => BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.center, colors: [Color(0x33FFFFFF), Color(0x00FFFFFF)]),
      );

  /// Raised green (resolved, free shipping).
  static BoxDecoration greenRaised({double radius = 999}) => BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF34C785), Color(0xFF0F6B49)]),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [BoxShadow(color: Color(0x660F6B49), blurRadius: 10, offset: Offset(0, 4))],
      );

  /// A small floating pill (a tab that is not chosen).
  static BoxDecoration pill(BuildContext context, {double radius = 20}) {
    final p = LeapPalette.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return BoxDecoration(
      color: p.card,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: dark ? p.line : const Color(0xFFEEF1F5)),
      boxShadow: [BoxShadow(color: dark ? const Color(0x4D000000) : const Color(0x1A0B3146), blurRadius: 6, offset: const Offset(0, 2))],
    );
  }
}

/// A box of a screen as a raised card (Account: the header, Appearance, App lock, Log out, Delete account). Taps and ink still work inside it.
class PremiumBox extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry margin;
  const PremiumBox({super.key, required this.child, this.radius = 14, this.margin = const EdgeInsets.fromLTRB(16, 6, 16, 6)});

  @override
  Widget build(BuildContext context) => Padding(
        padding: margin,
        child: DecoratedBox(
          decoration: Premium.card(context, radius: radius),
          child: ClipRRect(borderRadius: BorderRadius.circular(radius), child: Material(type: MaterialType.transparency, child: child)),
        ),
      );
}

/// A text field set into the page (Add address, Checkout ...): a sunken well, darker at its top edge like an inner shadow, with a thin light
/// edge under it. The field inside keeps its label, icon and gold edge while typing; only its flat fill is taken away.
class PremiumWell extends StatelessWidget {
  final Widget child;
  final double radius;
  const PremiumWell({super.key, required this.child, this.radius = 11});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0, 0.22, 1],
          colors: dark ? const [Color(0xFF041520), Color(0xFF0A2433), Color(0xFF0C2B3D)] : const [Color(0xFFD5DDE4), Color(0xFFEAEEF2), Color(0xFFF4F7F9)],
        ),
        border: Border.all(color: dark ? const Color(0x40000000) : const Color(0x170B3146)),
        boxShadow: [BoxShadow(color: dark ? const Color(0x14FFFFFF) : Colors.white, offset: const Offset(0, 1))],
      ),
      child: Theme(data: theme.copyWith(inputDecorationTheme: theme.inputDecorationTheme.copyWith(fillColor: Colors.transparent)), child: child),
    );
  }
}

/// Makes its child sink a little while a finger is on it (it does not take the tap: the InkWell or button inside still gets it).
class PressDown extends StatefulWidget {
  final Widget child;
  const PressDown({super.key, required this.child});

  @override
  State<PressDown> createState() => _PressDownState();
}

class _PressDownState extends State<PressDown> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final d = Duration(milliseconds: MediaQuery.of(context).disableAnimations ? 0 : 120);
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedSlide(
        duration: d,
        offset: Offset(0, _down ? 0.015 : 0),
        child: AnimatedScale(duration: d, scale: _down ? 0.985 : 1, child: widget.child),
      ),
    );
  }
}
