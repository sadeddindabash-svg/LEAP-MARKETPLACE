import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';
import '../models/product.dart';
import '../models/cart_item.dart';
import '../models/vehicle.dart';

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

  Future<Product> fetchProductById(String productId) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load product (${response.statusCode})');
    }
    return Product.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  // ---------------- Fitment reference data (BUY-010) ----------------
  // This is the shared Year/Make/Model/Trim catalog — distinct from a
  // buyer's own saved vehicles (see "Garage" below). Used for the
  // "Add a vehicle" flow: pick a make, then pick a specific reference
  // vehicle, then save it to the garage.

  Future<List<String>> fetchMakes() async {
    final response = await _client.get(Uri.parse('$baseUrl/fitment/makes'));
    if (response.statusCode != 200) throw ApiException('Failed to load makes (${response.statusCode})');
    return (jsonDecode(response.body) as List).cast<String>();
  }

  Future<List<Vehicle>> fetchVehiclesByMake(String make) async {
    final response = await _client.get(Uri.parse('$baseUrl/fitment/vehicles?make=${Uri.encodeQueryComponent(make)}'));
    if (response.statusCode != 200) throw ApiException('Failed to load vehicles (${response.statusCode})');
    final list = jsonDecode(response.body) as List;
    return list.map((v) => Vehicle.fromJson(v as Map<String, dynamic>)).toList();
  }

  // ---------------- Garage — buyer's own saved vehicles (BUY-004/010-012) ----------------

  Future<List<Vehicle>> fetchMyGarage(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/garage/me'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to load your garage (${response.statusCode})');
    final list = jsonDecode(response.body) as List;
    return list.map((v) => Vehicle.fromJson(v as Map<String, dynamic>)).toList();
  }

  Future<List<Vehicle>> addVehicleToGarage(String token, String vehicleId) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/garage/me'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'vehicleId': vehicleId}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to save vehicle (${response.statusCode})');
    }
    return fetchMyGarage(token);
  }

  Future<List<Vehicle>> removeVehicleFromGarage(String token, String vehicleId) async {
    final response = await _client.delete(Uri.parse('$baseUrl/garage/me/$vehicleId'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to remove vehicle (${response.statusCode})');
    final list = jsonDecode(response.body) as List;
    return list.map((v) => Vehicle.fromJson(v as Map<String, dynamic>)).toList();
  }

  // ---------------- Password reset ----------------
  // NOTE: no real email is sent yet (no email provider is connected in
  // this backend) — the reset link is logged to the SERVER's console as
  // a stand-in. See services/api/src/modules/auth/routes.js for details.
  // The token/expiry/one-time-use logic itself is fully real.

  Future<void> forgotPassword(String email) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Request failed (${response.statusCode})');
    }
  }

  Future<void> resetPassword({required String token, required String newPassword}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'token': token, 'newPassword': newPassword}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Request failed (${response.statusCode})');
    }
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

  /// Fetches full detail for one order, including per-supplier sub-orders
  /// (needed to know which subOrderId to attach a return request to).
  /// Uses the real logged-in buyer's token — GET /order/:id is
  /// ownership-checked server-side (see services/api/src/modules/order/routes.js;
  /// this endpoint used to be a real security hole, fixed in a later pass).
  Future<Map<String, dynamic>> fetchOrderDetail(String token, String orderId) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/order/$orderId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw ApiException('Failed to load order (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ---------------- Cart (BUY-030–032) ----------------
  // All three cart endpoints below return the same full-item shape (see
  // services/api/src/modules/cart/routes.js header comment) — every
  // method here just decodes that shared shape into List<CartItem>.

  List<CartItem> _decodeCartItems(http.Response response) {
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Cart request failed (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final items = body['items'] as List;
    return items.map((e) => CartItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<CartItem>> fetchCart(String cartId) async {
    final response = await _client.get(Uri.parse('$baseUrl/cart/$cartId'));
    return _decodeCartItems(response);
  }

  /// Adds to whatever quantity is already in the cart for this product
  /// (the backend merges quantities on repeat adds — see that module).
  Future<List<CartItem>> addCartItem(String cartId, String productId, int quantity) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/cart/$cartId/items'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'productId': productId, 'quantity': quantity}),
    );
    return _decodeCartItems(response);
  }

  /// Sets the EXACT quantity (unlike addCartItem, which adds to the
  /// existing amount) — used by a +/- quantity stepper. quantity <= 0
  /// removes the item entirely.
  Future<List<CartItem>> setCartItemQuantity(String cartId, String productId, int quantity) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/cart/$cartId/items/$productId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'quantity': quantity}),
    );
    return _decodeCartItems(response);
  }

  Future<List<CartItem>> removeCartItem(String cartId, String productId) async {
    final response = await _client.delete(Uri.parse('$baseUrl/cart/$cartId/items/$productId'));
    return _decodeCartItems(response);
  }

  // ---------------- Order placement (BUY-031, guest checkout) ----------------

  /// Places an order for the given cart items. Exactly one of [userId] or
  /// [guestEmail] must be provided, matching the backend's guest-checkout
  /// rule (see services/api/src/modules/order/routes.js).
  Future<Map<String, dynamic>> placeOrder({
    required List<CartItem> items,
    String? userId,
    String? guestEmail,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/order'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'items': items.map((i) => {'productId': i.productId, 'quantity': i.quantity}).toList(),
        if (userId != null) 'userId': userId,
        if (guestEmail != null) 'guestEmail': guestEmail,
      }),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Failed to place order (${response.statusCode})');
    }
    return body;
  }

  // ---------------- Support tickets (BUY-060/061) ----------------

  Map<String, String> _authHeaders(String? token) =>
      token != null ? {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'} : {'Content-Type': 'application/json'};

  Map<String, dynamic> _decodeOrThrow(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Request failed (${response.statusCode})');
    }
    return body;
  }

  /// Creates a ticket. Works for both a logged-in buyer (send [token]) or
  /// a guest (send [guestEmail] instead) — matches guest checkout.
  Future<Map<String, dynamic>> createTicket({String? token, required String subject, required String message, String? guestEmail, String? orderId}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/support/tickets'),
      headers: _authHeaders(token),
      body: jsonEncode({'subject': subject, 'message': message, if (guestEmail != null) 'guestEmail': guestEmail, if (orderId != null) 'orderId': orderId}),
    );
    return _decodeOrThrow(response);
  }

  /// Only works for a logged-in buyer — guest tickets aren't listable
  /// without an account, same limitation as guest order history.
  Future<List<dynamic>> fetchMyTickets(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/support/my-tickets'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load tickets (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> fetchTicketDetail(String token, String ticketId) async {
    final response = await _client.get(Uri.parse('$baseUrl/support/my-tickets/$ticketId'), headers: _authHeaders(token));
    return _decodeOrThrow(response);
  }

  Future<Map<String, dynamic>> sendTicketMessage(String token, String ticketId, String message) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/support/my-tickets/$ticketId/messages'),
      headers: _authHeaders(token),
      body: jsonEncode({'message': message}),
    );
    return _decodeOrThrow(response);
  }

  // ---------------- Return/dispute cases (BUY-053) ----------------

  Future<Map<String, dynamic>> createReturnCase({String? token, required int subOrderId, required String reason, required String message, String? guestEmail}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/returns'),
      headers: _authHeaders(token),
      body: jsonEncode({'subOrderId': subOrderId, 'reason': reason, 'message': message, if (guestEmail != null) 'guestEmail': guestEmail}),
    );
    return _decodeOrThrow(response);
  }

  Future<List<dynamic>> fetchMyReturnCases(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/returns/my-cases'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load return cases (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> fetchReturnCaseDetail(String token, String caseId) async {
    final response = await _client.get(Uri.parse('$baseUrl/returns/my-cases/$caseId'), headers: _authHeaders(token));
    return _decodeOrThrow(response);
  }

  Future<Map<String, dynamic>> sendReturnCaseMessage(String token, String caseId, String message) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/returns/my-cases/$caseId/messages'),
      headers: _authHeaders(token),
      body: jsonEncode({'message': message}),
    );
    return _decodeOrThrow(response);
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => 'ApiException: $message';
}
