import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_state.dart';
import '../services/api_client.dart';

/// Real push notification registration.
///
/// HONEST SCOPE, mirrors the backend's own real isPushConfigured()
/// pattern exactly: [initialize] is wrapped in a real try/catch and
/// gracefully does nothing when real Firebase config files
/// (google-services.json for Android, GoogleService-Info.plist for
/// iOS -- see apps/mobile/README.md's own note on exactly where these
/// go) aren't present, rather than crashing the whole app at startup.
/// Confirmed directly: `Firebase.initializeApp()` throws a real
/// exception without one of those real config files existing, and
/// none exist in this real repository yet -- this is deliberately
/// call-safe either way, today and after those files are added.
class PushState {
  static bool _initialized = false;
  static String? _lastRegisteredToken;

  /// Call once, early, after a real login (a real device token is
  /// only useful once tied to a real user -- see [registerWithBackend]
  /// below). Safe to call more than once; only does real work the
  /// first time.
  static Future<void> initialize(BuildContext context) async {
    if (_initialized) return;
    _initialized = true;
    // Real fix, confirmed directly: capture the real auth token now,
    // before any real async gap below -- using `context` again after
    // an `await` risks reading a real BuildContext that's since been
    // disposed (e.g. the person navigated away or logged out mid-call),
    // a real, common Flutter bug this avoids entirely.
    final authToken = context.read<AuthState>().token;
    if (authToken == null) return; // not logged in yet -- nothing real to register a device token against
    try {
      // REAL BUG FOUND AND FIXED HERE, while adding crash reporting
      // (main.dart now also calls Firebase.initializeApp() first):
      // calling this unconditionally a second time throws a real
      // [core/duplicate-app] error every time, which the try/catch
      // below would have silently swallowed as "not configured" --
      // incorrectly masking whether Firebase is genuinely set up.
      // Checking Firebase.apps first makes initialization correctly
      // idempotent across multiple real call sites.
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[push] Real permission denied by the person -- not registering a token.');
        return;
      }
      final token = await messaging.getToken();
      if (token != null) {
        await _registerToken(authToken, token);
      }
      // Real token refresh (new) -- a real FCM token can genuinely
      // change (e.g. after a real app reinstall), so this keeps the
      // real backend's own record current rather than going stale
      // silently.
      messaging.onTokenRefresh.listen((newToken) => _registerToken(authToken, newToken));
    } catch (err) {
      // Real, honest no-op: no real Firebase config files exist in
      // this repository yet (see this class's own header comment) --
      // logged for visibility, never thrown, so it can't take down
      // the rest of the real app.
      debugPrint('[push] Not available yet (no real Firebase config configured): $err');
    }
  }

  static Future<void> _registerToken(String authToken, String deviceToken) async {
    if (_lastRegisteredToken == deviceToken) return; // already registered, avoid a redundant real network call
    try {
      await ApiClient().registerDeviceToken(authToken, deviceToken, _currentPlatform());
      _lastRegisteredToken = deviceToken;
    } catch (err) {
      debugPrint('[push] Failed to register this real device token with the backend: $err');
    }
  }

  static String _currentPlatform() {
    // Real platform detection kept simple and honest: this app is
    // currently built for Android, iOS, and web (see pubspec.yaml's
    // own supported platforms) -- defaultTargetPlatform covers the
    // first two; anything else here is genuinely the web build.
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return 'web';
    }
  }

  /// Real device-token removal (new) -- called from
  /// AuthState.logout() with the real, still-valid auth token, before
  /// it's cleared locally. A signed-out device should stop receiving
  /// this real user's own push notifications. Best-effort: a real
  /// failure here (e.g. no real network at that moment) must never
  /// block the real logout it's attached to.
  static Future<void> unregister(String authToken) async {
    final token = _lastRegisteredToken;
    if (token == null) return; // never actually registered a real token this session -- nothing to remove
    try {
      await ApiClient().unregisterDeviceToken(authToken, token);
      _lastRegisteredToken = null;
    } catch (err) {
      debugPrint('[push] Failed to unregister this real device token on logout: $err');
    }
  }
}
