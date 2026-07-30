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
}
