import 'package:flutter/material.dart';

/// Brand tokens carried over from the design system used in the clickable
/// prototypes (docs/prototypes/leap_mobile_prototype.jsx) so the real app
/// stays visually consistent with what stakeholders already reviewed.
class LeapColors {
  LeapColors._();

  static const ink = Color(0xFF14171C);
  static const chalk = Color(0xFFF5F6F8);
  static const line = Color(0xFFE4E6EA);
  static const signal = Color(0xFFE8622C); // primary action
  static const signalDark = Color(0xFFC94F1E);
  static const torque = Color(0xFF2A5FD9); // links / info
  static const gauge = Color(0xFF1E9D6B); // success / in-stock
  static const amber = Color(0xFFB9791F); // pending / warning
  static const muted = Color(0xFF6B7280);
}

class LeapTheme {
  LeapTheme._();

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: LeapColors.chalk,
      colorScheme: base.colorScheme.copyWith(
        primary: LeapColors.signal,
        secondary: LeapColors.torque,
        surface: Colors.white,
        error: const Color(0xFFC0362C),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: LeapColors.ink,
        elevation: 0,
        centerTitle: false,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: LeapColors.signal,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
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
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: LeapColors.signal,
        unselectedItemColor: LeapColors.muted,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}
