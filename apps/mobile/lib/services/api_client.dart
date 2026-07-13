import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';
import '../models/product.dart';

/// Thin wrapper around services/api. Kept deliberately simple for the MVP —
/// swap in a generated client (e.g. from an OpenAPI spec) once the backend
/// contract stabilizes, rather than hand-maintaining this longer-term.
class ApiClient {
  final String baseUrl;
  final http.Client _client;

  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _client = client ?? http.Client();

  Future<List<Product>> fetchProductsByCategory(String categoryId, {String? vehicleId}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      'category': categoryId,
      if (vehicleId != null) 'vehicleId': vehicleId,
    });
    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw ApiException('Failed to load products (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> healthCheck() async {
    final response = await _client.get(Uri.parse('$baseUrl/health'));
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ---------------- Auth (BUY-001–003) ----------------

  Future<Map<String, dynamic>> signup(String email, String password, {String? name}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password, if (name != null) 'name': name}),
    );
    return _decodeAuthResponse(response);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    return _decodeAuthResponse(response);
  }

  Future<Map<String, dynamic>> getCurrentUser(String token) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw ApiException('Session expired or invalid (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Map<String, dynamic> _decodeAuthResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      // Surfaces the API's actual error message (e.g. "Invalid email or
      // password", "An account with this email already exists") rather
      // than a generic failure — these are meant to be shown to the user.
      throw ApiException(body['error'] as String? ?? 'Request failed (${response.statusCode})');
    }
    return body;
  }

  // ---------------- Orders (requires auth — see BUY-050) ----------------

  Future<List<dynamic>> fetchMyOrders(String token) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/order'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw ApiException('Failed to load orders (${response.statusCode})');
    }
    return jsonDecode(response.body) as List<dynamic>;
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => 'ApiException: $message';
}
