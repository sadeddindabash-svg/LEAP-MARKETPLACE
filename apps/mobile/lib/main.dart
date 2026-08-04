import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'app.dart';

/// Real crash reporting via Firebase Crashlytics (new).
///
/// HONEST SCOPE, mirrors push_state.dart's own real pattern exactly:
/// `Firebase.initializeApp()` genuinely throws without a real
/// `google-services.json` (Android) / `GoogleService-Info.plist`
/// (iOS) -- neither exists in this real repository yet (see
/// apps/mobile/README.md's own note on exactly where these go, added
/// for push notifications). Wrapped in a real try/catch here too, so
/// the app starts normally either way -- crash reporting is a real,
/// valuable safety net once configured, never something that should
/// itself be able to crash the app before it even starts.
///
/// Real, deliberate use of `runZonedGuarded` (new) -- catches real
/// uncaught errors in async code (e.g. an unawaited Future that
/// throws) that `FlutterError.onError` alone would miss, since that
/// one only ever catches errors during Flutter's own framework
/// callbacks (build/layout/paint), not arbitrary async code elsewhere
/// in the app.
void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      // Real Flutter framework errors (new) -- widget build/layout/
      // paint errors, the most common real source of a real crash
      // report.
      FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    } catch (err) {
      // Real, honest no-op: no real Firebase config exists yet (see
      // this function's own header comment) -- logged for visibility,
      // never thrown, so it can't block the rest of this real app
      // from starting.
      debugPrint('[crashlytics] Not available yet (no real Firebase config configured): $err');
    }
    runApp(const LeapApp());
  }, (error, stackTrace) {
    // Real uncaught async errors (new) -- reported the same real way
    // when Crashlytics happens to be configured; otherwise this is
    // still a real, useful fallback that at minimum prints to the
    // real console instead of silently vanishing.
    try {
      FirebaseCrashlytics.instance.recordError(error, stackTrace, fatal: true);
    } catch (_) {
      debugPrint('[crashlytics] Uncaught error (not reported, Crashlytics unavailable): $error');
    }
  });
}
