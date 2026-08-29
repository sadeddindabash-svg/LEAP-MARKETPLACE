import 'package:flutter/material.dart';

/// Faithful port of the web hub portal's own real color palette
/// (apps/hub-portal/src/App.jsx's `C` constant) -- deliberately NOT
/// apps/mobile's buyer-app gold, since the web hub portal already
/// established its own distinct real brand identity (signal orange,
/// #E8622C) and this rebuild preserves it rather than silently
/// reusing a different app's colors.
///
/// Light-only, matching the web app exactly -- it has no dark mode of
/// its own to port, so this doesn't invent one that was never part of
/// the real, confirmed design.
class HubColors {
  HubColors._();
  static const ink = Color(0xFF14171C);
  static const canvas = Color(0xFFF5F6F8);
  static const card = Color(0xFFFFFFFF);
  static const line = Color(0xFFE4E6EA);
  static const signal = Color(0xFFE8622C);
  static const torque = Color(0xFF2A5FD9);
  static const gauge = Color(0xFF1E9D6B);
  static const amber = Color(0xFFB9791F);
  static const red = Color(0xFFC0362C);
  static const muted = Color(0xFF6B7280);
  static const gaugeBg = Color(0xFFE4F5EC);
  static const amberBg = Color(0xFFFCEFD8);
  static const torqueBg = Color(0xFFE9EFFC);
  static const redBg = Color(0xFFFBE7E5);
}

/// Status -> (foreground, background) color pair, matching the web
/// app's own STATUS_COLOR map exactly (App.jsx lines 129-134) -- the
/// same 8 shipment statuses, same color assignments.
const Map<String, List<Color>> kStatusColors = {
  'awaiting_receipt': [HubColors.amber, HubColors.amberBg],
  'received': [HubColors.torque, HubColors.torqueBg],
  'opened': [HubColors.torque, HubColors.torqueBg],
  'inspected': [HubColors.torque, HubColors.torqueBg],
  'packed': [HubColors.torque, HubColors.torqueBg],
  'shipped_to_buyer': [HubColors.gauge, HubColors.gaugeBg],
  'delivered': [HubColors.gauge, HubColors.gaugeBg],
  'flagged': [HubColors.red, HubColors.redBg],
};

ThemeData buildHubTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: HubColors.canvas,
    colorScheme: ColorScheme.fromSeed(
      seedColor: HubColors.signal,
      primary: HubColors.signal,
      surface: HubColors.card,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: HubColors.card,
      foregroundColor: HubColors.ink,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: HubColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: HubColors.line),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: HubColors.signal,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
      ),
    ),
  );
}
