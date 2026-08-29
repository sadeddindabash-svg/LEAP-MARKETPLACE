import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api_client.dart';

/// Same real, proven persistence pattern as apps/mobile's AuthState
/// (secure-storage-backed token, ChangeNotifier), simplified: this
/// app has no 2FA at all, since the web hub portal it replaces never
/// had one either -- not omitted by oversight.
///
/// Role rejection ported exactly from the web app's own confirmed
/// logic (apps/hub-portal/src/App.jsx lines 606-625): a successfully
/// authenticated account that isn't `role: 'hub_staff'` is rejected
/// client-side and the token is cleared -- this app should never show
/// a supplier or buyer their own account "logged in successfully"
/// only to display an empty, meaningless queue.
class AuthState extends ChangeNotifier {
  static const _tokenKey = 'leap_hub_auth_token';
  final _secureStorage = const FlutterSecureStorage();
  final ApiClient _apiClient;

  String? _token;
  Map<String, dynamic>? _user;
  bool _isLoading = true;
  String? _rejectionReason; // set when a real, valid login succeeded but the account isn't hub_staff

  AuthState({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient() {
    _restoreSession();
  }

  bool get isLoggedIn => _token != null;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get token => _token;
  String? get rejectionReason => _rejectionReason;

  Future<void> _restoreSession() async {
    final savedToken = await _secureStorage.read(key: _tokenKey);
    if (savedToken != null) {
      try {
        final user = await _apiClient.getCurrentUser(savedToken);
        if (user['role'] != 'hub_staff') {
          await _secureStorage.delete(key: _tokenKey);
        } else {
          _token = savedToken;
          _user = user;
        }
      } catch (_) {
        // Saved token is expired/invalid -- clear it rather than leaving
        // the app in a broken "logged in but every call 401s" state.
        await _secureStorage.delete(key: _tokenKey);
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  /// Returns true on a genuine, accepted hub-staff login. On a
  /// successful auth against the backend for a non-hub_staff account,
  /// returns false and sets rejectionReason -- the caller (login
  /// screen) shows this instead of proceeding, matching the web app's
  /// own real behavior exactly.
  Future<bool> login(String email, String password) async {
    _rejectionReason = null;
    final result = await _apiClient.login(email, password);
    final token = result['token'] as String;
    final user = result['user'] as Map<String, dynamic>;
    if (user['role'] != 'hub_staff') {
      _rejectionReason = 'noAccess';
      notifyListeners();
      return false;
    }
    _token = token;
    _user = user;
    await _secureStorage.write(key: _tokenKey, value: token);
    notifyListeners();
    return true;
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await _secureStorage.delete(key: _tokenKey);
    notifyListeners();
  }

  /// Called by any screen that catches a real SessionExpiredError from
  /// the API client -- clears the session so the app returns to login
  /// rather than silently continuing to show stale, now-inaccessible
  /// data.
  void handleSessionExpired() {
    _token = null;
    _user = null;
    _secureStorage.delete(key: _tokenKey);
    notifyListeners();
  }
}
