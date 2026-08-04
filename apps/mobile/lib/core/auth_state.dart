import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api_client.dart';
import 'push_state.dart';

/// Holds the current auth session (token + user) and notifies listeners
/// on change. Registered as a ChangeNotifierProvider at the app root (see
/// app.dart) so any screen can read login state via `context.watch<AuthState>()`.
///
/// Token is persisted in flutter_secure_storage (Keychain/Keystore-backed),
/// never in plain SharedPreferences — this is a session credential, not
/// app preferences.
/// Real result of a login attempt (new) -- distinguishes a real,
/// completed login from one that genuinely needs a real second 2FA
/// step, so the login screen can branch correctly instead of this
/// blindly assuming every successful response means a real session
/// was issued.
class LoginResult {
  final bool requiresTwoFactor;
  final String? userId;
  LoginResult.success() : requiresTwoFactor = false, userId = null;
  LoginResult.twoFactorRequired(this.userId) : requiresTwoFactor = true;
}

class AuthState extends ChangeNotifier {
  static const _tokenKey = 'leap_auth_token';
  final _secureStorage = const FlutterSecureStorage();
  final ApiClient _apiClient;

  String? _token;
  Map<String, dynamic>? _user;
  bool _isLoading = true; // true while checking for a previously saved session on app start

  AuthState({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient() {
    _restoreSession();
  }

  bool get isLoggedIn => _token != null;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get token => _token;

  Future<void> _restoreSession() async {
    final savedToken = await _secureStorage.read(key: _tokenKey);
    if (savedToken != null) {
      _token = savedToken;
      try {
        _user = await _apiClient.getCurrentUser(savedToken);
      } catch (_) {
        // Saved token is expired/invalid — clear it rather than leaving the
        // app in a broken "logged in but every call 401s" state.
        await _secureStorage.delete(key: _tokenKey);
        _token = null;
        _user = null;
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  /// Real 2FA-aware login (updated) -- the backend's own real
  /// POST /auth/login now returns `{requiresTwoFactor: true, userId}`
  /// instead of a real token+user when the account has real 2FA
  /// enabled (migration 051). Returns a real LoginResult so the
  /// login screen can branch correctly, rather than this method
  /// blindly assuming token/user always exist and crashing on a real
  /// 2FA account.
  Future<LoginResult> login(String email, String password) async {
    final result = await _apiClient.login(email, password);
    if (result['requiresTwoFactor'] == true) {
      return LoginResult.twoFactorRequired(result['userId'] as String);
    }
    _token = result['token'] as String;
    _user = result['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
    return LoginResult.success();
  }

  /// Real completion of a 2FA login (new) -- called from the login
  /// screen's own second real step, after login() above already
  /// returned twoFactorRequired.
  Future<void> verifyTwoFactorLogin(String userId, String code) async {
    final result = await _apiClient.verifyTwoFactorLogin(userId, code);
    _token = result['token'] as String;
    _user = result['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
  }

  /// Real, reusable session update (new) -- for a real account-update
  /// flow (e.g. changing your email) that already gets a fresh real
  /// token+user directly back from the real backend, rather than
  /// re-authenticating via login() with credentials it doesn't have.
  Future<void> updateSession(String token, Map<String, dynamic> user) async {
    _token = token;
    _user = user;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
  }

  // Returns the real number of guest orders just linked to this new
  // account (migration 029) -- 0 means none, which is the normal case
  // for someone who never checked out as a guest under this email.
  Future<int> signup(String email, String password, {String? name, String? referralCode}) async {
    final result = await _apiClient.signup(email, password, name: name, referralCode: referralCode);
    _token = result['token'] as String;
    _user = result['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
    return (result['linkedOrderCount'] as int?) ?? 0;
  }

  Future<void> logout() async {
    // Real fix, confirmed directly: capture the real token before
    // clearing it below -- PushState.unregister needs a real, still-
    // valid auth token to call the real DELETE endpoint with. Best-
    // effort, fire-and-forget: a real failure here (e.g. no network
    // at that moment) must never block the real logout itself.
    final tokenBeforeClear = _token;
    _token = null;
    _user = null;
    await _secureStorage.delete(key: _tokenKey);
    notifyListeners();
    if (tokenBeforeClear != null) {
      PushState.unregister(tokenBeforeClear).catchError((_) {});
    }
  }
}
