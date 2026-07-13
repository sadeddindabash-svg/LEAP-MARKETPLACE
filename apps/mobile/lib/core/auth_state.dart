import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api_client.dart';

/// Holds the current auth session (token + user) and notifies listeners
/// on change. Registered as a ChangeNotifierProvider at the app root (see
/// app.dart) so any screen can read login state via `context.watch<AuthState>()`.
///
/// Token is persisted in flutter_secure_storage (Keychain/Keystore-backed),
/// never in plain SharedPreferences — this is a session credential, not
/// app preferences.
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

  Future<void> login(String email, String password) async {
    final result = await _apiClient.login(email, password);
    _token = result['token'] as String;
    _user = result['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
  }

  Future<void> signup(String email, String password, {String? name}) async {
    final result = await _apiClient.signup(email, password, name: name);
    _token = result['token'] as String;
    _user = result['user'] as Map<String, dynamic>;
    await _secureStorage.write(key: _tokenKey, value: _token);
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await _secureStorage.delete(key: _tokenKey);
    notifyListeners();
  }
}
