import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand tokens (updated) -- real design refresh, confirmed directly
/// against the real leapautoparts.com website's own real color
/// identity: a real gold/amber accent (#F2A71B) replacing the
/// original orange-red, with dark text on top of it (matching the
/// real site's own real contrast pattern -- its gold buttons/pills use
/// dark text, not white). The light background, Manrope typeface, and
/// fully pill-shaped buttons were each confirmed directly, one at a
/// time, via real rendered mockups before any of this was written --
/// not guessed.
class LeapColors {
  LeapColors._();

  static const ink = Color(0xFF14171C);
  static const chalk = Color(0xFFF5F6F8);
  static const line = Color(0xFFE4E6EA);
  static const signal = Color(0xFFF2A71B); // primary action -- real gold, matching the real leapautoparts.com site
  static const signalDark = Color(0xFFC4870D); // pressed/hover state for the real gold
  // Real, dark text-on-gold color (new) -- gold is too light for white
  // text to read well against, matching the real site's own real
  // contrast choice (dark text on every real gold button/pill there).
  static const onSignal = Color(0xFF241A05);
  static const torque = Color(0xFF2A5FD9); // links / info
  static const gauge = Color(0xFF1E9D6B); // success / in-stock
  static const amber = Color(0xFFB9791F); // pending / warning
  static const muted = Color(0xFF6B7280);
}

/// Real dark theme color tokens (new), confirmed directly against the
/// real "Precision Performance" design spec (DESIGN.md, exported
/// directly from Google Stitch) -- exact hex values taken from that
/// spec's own real color list, not approximated from the screenshot.
class LeapColorsDark {
  LeapColorsDark._();

  static const background = Color(0xFF131313); // surface / surface-dim
  static const surface = Color(0xFF1C1B1B); // surface-container-low
  static const surfaceHigh = Color(0xFF2A2A2A); // surface-container-high
  static const onSurface = Color(0xFFF2CA50); // primary text color in dark mode -- same real gold as LeapColorsDark.signal, per request (was 0xFFE5E2E1, a light gray)
  static const line = Color(0xFF4D4635); // outline-variant
  static const signal = Color(0xFFF2CA50); // real primary, per the real spec (D4AF37 is actually primary-container there, not primary)
  static const signalContainer = Color(0xFFD4AF37); // metallic-gold / primary-container, used for secondary gold accents
  static const onSignal = Color(0xFF3C2F00); // on-primary
  static const torque = Color(0xFFCECECE); // tertiary
  static const gauge = Color(0xFF28A745); // success-green
  static const muted = Color(0xFFD0C5AF); // on-surface-variant
}

/// Real, unified, context-aware palette (new) -- the real mechanism
/// individual screens use to become genuinely theme-aware, migrating
/// away from referencing LeapColors.* directly (which never adapts to
/// dark mode). Call LeapPalette.of(context) once per build method,
/// then use its own instance fields in place of the old static
/// LeapColors.* references -- same field names, so migrating a screen
/// is a mechanical find-and-replace, not a rewrite.
class LeapPalette {
  final Color ink;
  final Color chalk;
  final Color card;
  final Color line;
  final Color signal;
  final Color signalDark;
  final Color onSignal;
  final Color torque;
  final Color gauge;
  final Color amber;
  final Color muted;

  const LeapPalette({
    required this.ink,
    required this.chalk,
    required this.card,
    required this.line,
    required this.signal,
    required this.signalDark,
    required this.onSignal,
    required this.torque,
    required this.gauge,
    required this.amber,
    required this.muted,
  });

  static const light = LeapPalette(
    ink: LeapColors.ink,
    chalk: LeapColors.chalk,
    card: Colors.white,
    line: LeapColors.line,
    signal: LeapColors.signal,
    signalDark: LeapColors.signalDark,
    onSignal: LeapColors.onSignal,
    torque: LeapColors.torque,
    gauge: LeapColors.gauge,
    amber: LeapColors.amber,
    muted: LeapColors.muted,
  );

  static const dark = LeapPalette(
    ink: LeapColorsDark.onSurface,
    chalk: LeapColorsDark.background,
    card: LeapColorsDark.surface,
    line: LeapColorsDark.line,
    signal: LeapColorsDark.signal,
    signalDark: LeapColorsDark.signalContainer,
    onSignal: LeapColorsDark.onSignal,
    torque: LeapColorsDark.torque,
    gauge: LeapColorsDark.gauge,
    amber: LeapColorsDark.signalContainer,
    muted: LeapColorsDark.muted,
  );

  static LeapPalette of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}

class LeapTheme {
  LeapTheme._();

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    // Real Manrope typeface (new), confirmed directly against a real,
    // rendered side-by-side comparison of 5 real font options before
    // this was picked -- applied via the real, standard google_fonts
    // package (fetches and caches the real font at runtime; no manual
    // .ttf files to bundle).
    final manropeTextTheme = GoogleFonts.manropeTextTheme(base.textTheme);
    // Real, fully pill-shaped button shape (new), confirmed directly --
    // StadiumBorder adapts correctly to any real button height,
    // unlike a fixed large corner-radius value.
    const pillShape = StadiumBorder();

    return base.copyWith(
      scaffoldBackgroundColor: LeapColors.chalk,
      textTheme: manropeTextTheme,
      primaryTextTheme: manropeTextTheme,
      colorScheme: base.colorScheme.copyWith(
        primary: LeapColors.signal,
        onPrimary: LeapColors.onSignal,
        secondary: LeapColors.torque,
        surface: Colors.white,
        error: const Color(0xFFC0362C),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: LeapColors.ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColors.ink),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: LeapColors.signal,
          foregroundColor: LeapColors.onSignal,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: pillShape,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      // Real, matching pill shape for outlined (secondary) buttons too
      // (new) -- shape consistency across every real button in the
      // app, not just the primary/gold ones. Color deliberately stays
      // neutral (not gold) -- an outlined button is a real secondary
      // action, the gold accent is reserved for the one real primary
      // action per screen.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: LeapColors.ink,
          side: const BorderSide(color: LeapColors.line),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: pillShape,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: LeapColors.signalDark,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: LeapColors.line),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: LeapColors.signal,
        unselectedItemColor: LeapColors.muted,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.manrope(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.manrope(fontSize: 11, fontWeight: FontWeight.w500),
      ),
    );
  }

  /// Real dark theme (new) -- mirrors light()'s own structure with
  /// LeapColorsDark's tokens. See theme_state.dart's own header
  /// comment for the honest scope boundary: every themed element here
  /// (AppBar, buttons, bottom nav, scaffold background) switches
  /// correctly; screens referencing LeapColors.* directly for their
  /// own inline widgets need their own separate migration pass.
  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    final manropeTextTheme = GoogleFonts.manropeTextTheme(base.textTheme).apply(bodyColor: LeapColorsDark.onSurface, displayColor: LeapColorsDark.onSurface);
    const pillShape = StadiumBorder();

    return base.copyWith(
      scaffoldBackgroundColor: LeapColorsDark.background,
      textTheme: manropeTextTheme,
      primaryTextTheme: manropeTextTheme,
      colorScheme: base.colorScheme.copyWith(
        primary: LeapColorsDark.signal,
        onPrimary: LeapColorsDark.onSignal,
        secondary: LeapColorsDark.torque,
        surface: LeapColorsDark.surface,
        error: const Color(0xFFFFB4AB),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: LeapColorsDark.surface,
        foregroundColor: LeapColorsDark.onSurface,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: LeapColorsDark.onSurface),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: LeapColorsDark.signal,
          foregroundColor: LeapColorsDark.onSignal,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: pillShape,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: LeapColorsDark.onSurface,
          side: const BorderSide(color: LeapColorsDark.line),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: pillShape,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: LeapColorsDark.signal,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: LeapColorsDark.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: LeapColorsDark.line),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: LeapColorsDark.surface,
        selectedItemColor: LeapColorsDark.signal,
        unselectedItemColor: LeapColorsDark.muted,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.manrope(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.manrope(fontSize: 11, fontWeight: FontWeight.w500),
      ),
    );
  }
}
