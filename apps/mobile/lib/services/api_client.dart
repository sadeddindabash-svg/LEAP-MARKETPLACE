import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import '../core/config/app_config.dart';
import '../models/product.dart';
import '../models/category.dart';
import '../models/cart_item.dart';
import '../models/vehicle.dart';
import '../models/review.dart';
import '../models/saved_search.dart';

/// Thin wrapper around services/api. Kept deliberately simple for the MVP —
/// swap in a generated client (e.g. from an OpenAPI spec) once the backend
/// contract stabilizes, rather than hand-maintaining this longer-term.
class ApiClient {
  final String baseUrl;
  final http.Client _client;

  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _client = client ?? http.Client();

  /// REAL BUG FOUND AND FIXED HERE (second real bug in this exact spot,
  /// found right after fixing the first): the backend's upload endpoint
  /// (services/api/src/modules/uploads/routes.js) validates the
  /// REQUEST's mimetype against an allow-list (image/jpeg, image/png,
  /// image/webp) -- MultipartFile.fromBytes with no explicit
  /// contentType defaults to application/octet-stream, which that
  /// allow-list correctly rejects. fromPath used to infer this from the
  /// file extension automatically; fromBytes does not, so it has to be
  /// set explicitly here. Prefers the real XFile.mimeType (reliably
  /// populated on web, from the browser's own File.type), falling back
  /// to a real extension-based guess on platforms where that's null.
  static MediaType _mediaTypeFor(XFile file) {
    final reported = file.mimeType;
    if (reported != null && reported.startsWith('image/')) {
      return MediaType.parse(reported);
    }
    final name = file.name.toLowerCase();
    if (name.endsWith('.png')) return MediaType('image', 'png');
    if (name.endsWith('.webp')) return MediaType('image', 'webp');
    return MediaType('image', 'jpeg'); // matches pickImage's own default output format
  }

  /// Turns a relative media path (e.g. "/uploads/abc123.jpg", as returned
  /// by product.images) into a real, fully-qualified URL the app can
  /// actually load — the backend returns relative paths since it doesn't
  /// know its own public hostname at the time it serves the JSON (see
  /// services/api/src/modules/uploads/routes.js).
  static String resolveMediaUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '${AppConfig.apiBaseUrl}$path';
  }

  /// Real, admin-managed categories — replaces what used to be a
  /// hardcoded list in home_screen.dart. Fetched once; which language's
  /// name is shown is resolved locally (see ProductCategory.displayName),
  /// not via a ?lang= param, since the raw list itself doesn't change.
  Future<List<ProductCategory>> fetchCategories() async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/categories'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load categories (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => ProductCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ProductCategory>> fetchPartsForCategory(String categoryId) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/categories/$categoryId/parts'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load parts (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => ProductCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Product>> fetchProductsByCategory(String categoryId, {String? part, String? vehicleId, String lang = 'en'}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      'category': categoryId,
      if (part != null) 'part': part,
      if (vehicleId != null) 'vehicleId': vehicleId,
      'lang': lang,
    });
    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw ApiException('Failed to load products (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// The home feed's real "Newest" / "My car" filter — no category
  /// scoping, browses across everything. `sort: 'newest'` orders by
  /// real creation time (see services/api/README.md's "Product
  /// search" section for why this endpoint previously had no explicit
  /// ordering at all).
  ///
  /// REAL BUG FOUND AND FIXED HERE (backend migration 044): "My car"
  /// used to pass `vehicleId`, joining a table nothing in this
  /// codebase ever wrote a real row into -- it silently returned
  /// nothing meaningful this whole time. Now takes generationId/year,
  /// the same real, populated filter the search vehicle picker uses.
  Future<List<Product>> fetchProducts({String? sort, String? generationId, int? year, String lang = 'en'}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      if (sort != null) 'sort': sort,
      if (generationId != null) 'generationId': generationId,
      if (year != null) 'year': '$year',
      'lang': lang,
    });
    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw ApiException('Failed to load products (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Real product search — matches part name, OEM number, category, or
  /// the vehicle brand/model this product fits (see
  /// services/api/src/modules/catalog/routes.js's GET /catalog/products
  /// for the full multi-word matching logic). Empty/whitespace-only
  /// queries are the caller's responsibility to avoid; this method
  /// doesn't special-case that.
  Future<List<Product>> searchProducts(String query, {String lang = 'en', String? generationId, int? year, String? sort, num? minPrice, num? maxPrice}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      if (query.isNotEmpty) 'search': query,
      'lang': lang,
      if (generationId != null) 'generationId': generationId,
      if (year != null) 'year': '$year',
      if (sort != null) 'sort': sort,
      if (minPrice != null) 'minPrice': '$minPrice',
      if (maxPrice != null) 'maxPrice': '$maxPrice',
    });
    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw ApiException('Search failed (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ---------------- Structured Brand -> Model -> Generation cascade
  // (migration 010) -- the SAME reference data the supplier portal uses
  // to submit real fitment claims, now also exposed here for the
  // buyer-facing search filter (see search_screen.dart). Deliberately
  // NOT the flat GET /fitment/makes|vehicles pair used by My Garage --
  // that flat table is never actually referenced by any real product's
  // fitment (confirmed directly), so a Garage-style filter here would
  // silently match nothing real. Raw maps, not a typed model, matching
  // the same lightweight pattern already used for orders/notifications.

  Future<List<dynamic>> fetchVehicleBrands() async {
    final response = await _client.get(Uri.parse('$baseUrl/fitment/brands'));
    if (response.statusCode != 200) throw ApiException('Failed to load brands (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<List<dynamic>> fetchModelsForBrand(String brandId) async {
    final response = await _client.get(Uri.parse('$baseUrl/fitment/brands/$brandId/models'));
    if (response.statusCode != 200) throw ApiException('Failed to load models (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<List<dynamic>> fetchGenerationsForModel(String modelId) async {
    final response = await _client.get(Uri.parse('$baseUrl/fitment/models/$modelId/generations'));
    if (response.statusCode != 200) throw ApiException('Failed to load generations (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Product> fetchProductById(String productId, {String lang = 'en'}) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId?lang=$lang'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load product (${response.statusCode})');
    }
    return Product.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  // ---------------- Garage — buyer's own saved vehicles (BUY-004/010-012) ----------------
  // REAL BUG FOUND AND FIXED HERE (backend migration 044): this used
  // to also expose fetchMakes()/fetchVehiclesByMake() for the old
  // add_vehicle_screen.dart flow, built on the flat, unpopulated-for-
  // matching `vehicles` reference table -- removed along with that
  // screen. My Garage now reuses vehicle_filter_sheet.dart's real
  // Brand->Model->Generation->Year cascade instead (see
  // garage_screen.dart), against the real, populated structured
  // fitment system.

  Future<List<Vehicle>> fetchMyGarage(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/garage/me'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to load your garage (${response.statusCode})');
    final list = jsonDecode(response.body) as List;
    return list.map((v) => Vehicle.fromJson(v as Map<String, dynamic>)).toList();
  }

  Future<List<Vehicle>> addVehicleToGarage(String token, String generationId, int year) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/garage/me'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'generationId': generationId, 'year': year}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to save vehicle (${response.statusCode})');
    }
    return fetchMyGarage(token);
  }

  Future<List<Vehicle>> removeVehicleFromGarage(String token, String generationId, int year) async {
    final response = await _client.delete(Uri.parse('$baseUrl/garage/me/$generationId/$year'), headers: {'Authorization': 'Bearer $token'});
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

  Future<Map<String, dynamic>> signup(String email, String password, {String? name, String? referralCode}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email, 'password': password,
        if (name != null) 'name': name,
        if (referralCode != null && referralCode.isNotEmpty) 'referralCode': referralCode,
      }),
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

  Future<List<dynamic>> fetchMyOrders(String token, {String? status}) async {
    final uri = Uri.parse('$baseUrl/order').replace(queryParameters: status != null ? {'status': status} : null);
    final response = await _client.get(
      uri,
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

  /// Real live tracking timeline (new) -- merges our own real hub
  /// milestones with real live carrier events from 17TRACK's query
  /// API, for the hub's own final-leg tracking number.
  Future<Map<String, dynamic>> fetchOrderTracking(String token, String orderId) async {
    final response = await _client.get(
      Uri.parse('$baseUrl/order/$orderId/tracking'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw ApiException('Failed to load tracking (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Real order cancellation (migration 029) -- only allowed by the
  /// real backend while every real sub-order is still pending or
  /// preparing; throws the real backend's own message otherwise (e.g.
  /// once something has genuinely shipped).
  Future<void> cancelOrder(String token, String orderId) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/order/$orderId/cancel'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw ApiException(body['error'] as String? ?? 'Failed to cancel order (${response.statusCode})');
    }
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
    String? promoCode,
    Map<String, dynamic>? address,
    String? addressId,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/order'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'items': items.map((i) => {'productId': i.productId, 'quantity': i.quantity}).toList(),
        if (userId != null) 'userId': userId,
        if (guestEmail != null) 'guestEmail': guestEmail,
        if (promoCode != null && promoCode.isNotEmpty) 'promoCode': promoCode,
        if (address != null) 'address': address,
        if (addressId != null) 'addressId': addressId,
      }),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(body['error'] as String? ?? 'Failed to place order (${response.statusCode})');
    }
    return body;
  }

  /// Real, post-confirmation address (migration 030) -- lets a real
  /// guest (or a logged-in buyer correcting one) set the real shipping
  /// address on an order that doesn't have one yet, or replace an
  /// existing one. `source` is 'manual' or 'geolocation'.
  Future<void> confirmOrderAddress(String orderId, Map<String, dynamic> address, {String? guestEmail, String? token, String source = 'manual'}) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/order/$orderId/address'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'address': address,
        'source': source,
        if (guestEmail != null) 'guestEmail': guestEmail,
      }),
    );
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to save address (${response.statusCode})');
    }
  }

  /// Real reverse geocoding via OpenStreetMap's free Nominatim service
  /// (migration 030) -- confirmed choice: genuinely free, no API key,
  /// matching the same reasoning as the Frankfurter FX rate provider.
  /// HONEST LIMITATION: Nominatim's real usage policy requires a real,
  /// identifying User-Agent and asks that high-volume use go through
  /// their own paid/self-hosted options instead -- fine for this app's
  /// real, human-triggered, one-off usage per guest order, not meant
  /// for bulk lookups. Returns null on any real failure -- the caller
  /// falls back to a real, empty, manually-fillable form rather than
  /// blocking the person on a geocoding hiccup.
  Future<Map<String, dynamic>?> reverseGeocode(double latitude, double longitude) async {
    try {
      final uri = Uri.parse('https://nominatim.openstreetmap.org/reverse?format=json&lat=$latitude&lon=$longitude&addressdetails=1');
      final response = await _client.get(uri, headers: {'User-Agent': 'LeapAutoPartsMarketplace/1.0'});
      if (response.statusCode != 200) return null;
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final addr = body['address'] as Map<String, dynamic>?;
      if (addr == null) return null;
      final street = [addr['house_number'], addr['road']].where((v) => v != null && (v as String).isNotEmpty).join(' ');
      final city = (addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['county']) as String?;
      final country = addr['country'] as String?;
      return {
        'streetAddress': street.isNotEmpty ? street : (body['display_name'] as String? ?? ''),
        'city': city ?? '',
        'country': country ?? '',
      };
    } catch (_) {
      return null;
    }
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

  /// Real gap closed here (mirrors the same fix already made for
  /// returns -- see returns_screen.dart's own comment): the backend's
  /// GET /support/my-tickets/:id now supports a real guest lookup via
  /// a matching ?guestEmail=, the same optionalAuth pattern
  /// GET /order/:id and GET /returns/my-cases/:id already use. This
  /// was only ever called with a real logged-in token before.
  Future<Map<String, dynamic>> fetchTicketDetail(String ticketId, {String? token, String? guestEmail}) async {
    final uri = Uri.parse('$baseUrl/support/my-tickets/$ticketId').replace(
      queryParameters: guestEmail != null ? {'guestEmail': guestEmail} : null,
    );
    final response = await _client.get(uri, headers: _authHeaders(token));
    return _decodeOrThrow(response);
  }

  Future<Map<String, dynamic>> sendTicketMessage(String ticketId, String message, {String? token, String? guestEmail}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/support/my-tickets/$ticketId/messages'),
      headers: _authHeaders(token),
      body: jsonEncode({'message': message, if (guestEmail != null) 'guestEmail': guestEmail}),
    );
    return _decodeOrThrow(response);
  }

  // ---------------- Return/dispute cases (BUY-053) ----------------

  Future<Map<String, dynamic>> createReturnCase({String? token, required int subOrderId, required String reason, required String message, String? guestEmail, List<String>? photos}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/returns'),
      headers: _authHeaders(token),
      body: jsonEncode({
        'subOrderId': subOrderId, 'reason': reason, 'message': message,
        if (guestEmail != null) 'guestEmail': guestEmail,
        if (photos != null && photos.isNotEmpty) 'photos': photos,
      }),
    );
    return _decodeOrThrow(response);
  }

  /// Real, optional evidence photo upload for a return request (migration
  /// 043), reusing the same real backend endpoint as review/hub photos --
  /// see uploadReviewPhoto's own comment for why. Requires a real logged-
  /// in buyer token, same as that endpoint's role check -- a guest return
  /// (this app never actually reaches that path today; see
  /// order_detail_screen.dart's header comment) couldn't attach one.
  ///
  /// REAL BUG FOUND AND FIXED HERE (confirmed live in a real browser, not
  /// just reasoned about): MultipartFile.fromPath reads via dart:io,
  /// which does not work on Flutter Web -- an XFile's .path there is a
  /// blob URL, not a real filesystem path. That threw an exception that
  /// wasn't an ApiException, so it was never caught, and the picker
  /// silently did nothing with no visible error at all. Fixed by reading
  /// real bytes via XFile.readAsBytes() (works identically on web and
  /// native) and using MultipartFile.fromBytes instead.
  Future<String> uploadReturnPhoto(String token, XFile file) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/uploads/product-image'));
    request.headers['Authorization'] = 'Bearer $token';
    final bytes = await file.readAsBytes();
    request.files.add(http.MultipartFile.fromBytes('image', bytes, filename: file.name, contentType: _mediaTypeFor(file)));
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 201) {
      throw ApiException(body['error'] as String? ?? 'Failed to upload photo (${response.statusCode})');
    }
    return body['url'] as String;
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

  /// Real buyer address book — up to 3 real saved addresses (see
  /// services/api/src/modules/addresses/routes.js). "Addresses" was a
  /// genuinely dead nav row before this.
  Future<List<dynamic>> fetchMyAddresses(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/addresses/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load addresses (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<Map<String, dynamic>> createAddress(String token, Map<String, dynamic> address) async {
    final response = await _client.post(Uri.parse('$baseUrl/addresses/me'), headers: _authHeaders(token), body: jsonEncode(address));
    return _decodeOrThrow(response);
  }

  Future<Map<String, dynamic>> updateAddress(String token, String id, Map<String, dynamic> updates) async {
    final response = await _client.patch(Uri.parse('$baseUrl/addresses/me/$id'), headers: _authHeaders(token), body: jsonEncode(updates));
    return _decodeOrThrow(response);
  }

  Future<void> deleteAddress(String token, String id) async {
    final response = await _client.delete(Uri.parse('$baseUrl/addresses/me/$id'), headers: _authHeaders(token));
    if (response.statusCode != 204) throw ApiException('Failed to delete address (${response.statusCode})');
  }

  /// Real wishlist — a buyer saves real products for later (see
  /// services/api/src/modules/wishlist/routes.js). Add/remove are both
  /// real, idempotent backend operations — safe to call again on a
  /// double-tap or slow-network retry without it being a real error.
  Future<List<Product>> fetchWishlist(String token, {String lang = 'en'}) async {
    final uri = Uri.parse('$baseUrl/wishlist/me').replace(queryParameters: {'lang': lang});
    final response = await _client.get(uri, headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load wishlist (${response.statusCode})');
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<bool> isWishlisted(String token, String productId) async {
    final response = await _client.get(Uri.parse('$baseUrl/wishlist/me/$productId'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to check wishlist (${response.statusCode})');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['wishlisted'] as bool;
  }

  Future<void> addToWishlist(String token, String productId) async {
    final response = await _client.post(Uri.parse('$baseUrl/wishlist/me/$productId'), headers: _authHeaders(token));
    if (response.statusCode != 201) throw ApiException('Failed to add to wishlist (${response.statusCode})');
  }

  Future<void> removeFromWishlist(String token, String productId) async {
    final response = await _client.delete(Uri.parse('$baseUrl/wishlist/me/$productId'), headers: _authHeaders(token));
    if (response.statusCode != 204) throw ApiException('Failed to remove from wishlist (${response.statusCode})');
  }

  /// Real saved searches (new) — see
  /// services/api/src/modules/savedSearches/routes.js. A real,
  /// periodic backend sweep notifies the buyer when a genuinely new
  /// product matches later; this app's own job is just real CRUD.
  Future<List<SavedSearch>> fetchSavedSearches(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/saved-searches/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load saved searches (${response.statusCode})');
    final body = jsonDecode(response.body) as List;
    return body.map((e) => SavedSearch.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<SavedSearch> createSavedSearch(String token, {String? searchTerm, String? category, required String label}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/saved-searches/me'),
      headers: {..._authHeaders(token), 'Content-Type': 'application/json'},
      body: jsonEncode({'searchTerm': searchTerm, 'category': category, 'label': label}),
    );
    if (response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to save search (${response.statusCode})');
    }
    return SavedSearch.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<void> deleteSavedSearch(String token, int id) async {
    final response = await _client.delete(Uri.parse('$baseUrl/saved-searches/me/$id'), headers: _authHeaders(token));
    if (response.statusCode != 204) throw ApiException('Failed to delete saved search (${response.statusCode})');
  }

  /// Real product reviews (new) — see
  /// services/api/src/modules/reviews/routes.js. Public: only ever
  /// returns real 'approved' reviews and a real average computed
  /// strictly from those — a pending or rejected review never shows or
  /// counts here, even briefly.
  Future<ReviewsSummary> fetchProductReviews(String productId) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId/reviews'));
    if (response.statusCode != 200) throw ApiException('Failed to load reviews (${response.statusCode})');
    return ReviewsSummary.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Real submit-or-edit — a buyer's second submission for the same
  /// real product is a real edit of their existing review (sent back
  /// to 'pending' for re-review), never a second row. Throws
  /// ApiException with the real backend message on failure — including
  /// the real "only buyers who have received this product" message when
  /// verified purchase is required and this buyer hasn't received it.
  /// Real photo upload for a review (migration 031), reusing the same
  /// real backend endpoint already built for supplier product photos
  /// and hub evidence photos -- the actual work there (validate real
  /// dimensions/type, save, return a real URL) is identical regardless
  /// of what the photo is evidence of.
  ///
  /// REAL BUG FOUND AND FIXED HERE (found while fixing the identical
  /// copy-pasted bug in uploadReturnPhoto, confirmed live in a real
  /// browser): MultipartFile.fromPath reads via dart:io, which does not
  /// work on Flutter Web -- an XFile's .path there is a blob URL, not a
  /// real filesystem path. The photo picker silently did nothing on web
  /// with no visible error, since the resulting exception wasn't an
  /// ApiException and was never caught anywhere. Fixed by reading real
  /// bytes via XFile.readAsBytes() (works identically on web and
  /// native) and using MultipartFile.fromBytes instead.
  Future<String> uploadReviewPhoto(String token, XFile file) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/uploads/product-image'));
    request.headers['Authorization'] = 'Bearer $token';
    final bytes = await file.readAsBytes();
    request.files.add(http.MultipartFile.fromBytes('image', bytes, filename: file.name, contentType: _mediaTypeFor(file)));
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 201) {
      throw ApiException(body['error'] as String? ?? 'Failed to upload photo (${response.statusCode})');
    }
    return body['url'] as String;
  }

  Future<MyReview> submitReview(String token, {required String productId, required int rating, String? comment, List<String>? photos}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/reviews'),
      headers: _authHeaders(token),
      body: jsonEncode({
        'productId': productId, 'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
        if (photos != null) 'photos': photos,
      }),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 201) throw ApiException(body['error'] as String? ?? 'Failed to submit review (${response.statusCode})');
    return MyReview.fromJson(body);
  }

  /// This buyer's own real reviews, any real status — used to show a
  /// real "your review is pending" state on the product page, and to
  /// pre-fill the write-a-review form if they already reviewed this
  /// product.
  Future<List<MyReview>> fetchMyReviews(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/reviews/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load your reviews (${response.statusCode})');
    final body = jsonDecode(response.body) as List;
    return body.map((e) => MyReview.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> deleteReview(String token, int reviewId) async {
    final response = await _client.delete(Uri.parse('$baseUrl/reviews/$reviewId'), headers: _authHeaders(token));
    if (response.statusCode != 204) throw ApiException('Failed to delete review (${response.statusCode})');
  }

  /// Real report/flag a review (migration 033) -- requires a real
  /// short reason; re-flagging the same real review is a genuine
  /// no-op server-side, never an error.
  Future<void> flagReview(String token, int reviewId, String reason) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/reviews/$reviewId/flag'),
      headers: _authHeaders(token),
      body: jsonEncode({'reason': reason}),
    );
    if (response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to report review (${response.statusCode})');
    }
  }

  /// Real recently viewed products (migration 032), synced to the
  /// buyer's real account. Best-effort, real-fire-and-forget from the
  /// caller's point of view -- a genuine failure here should never
  /// block viewing the actual product.
  Future<void> recordProductView(String token, String productId) async {
    await _client.post(Uri.parse('$baseUrl/recently-viewed/$productId'), headers: _authHeaders(token));
  }

  Future<List<Product>> fetchRecentlyViewed(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/recently-viewed/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load recently viewed products (${response.statusCode})');
    final body = jsonDecode(response.body) as List;
    return body.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Real notifications — triggered by real order changes and message/
  /// ticket replies (see services/api/src/modules/notifications/).
  Future<List<dynamic>> fetchNotifications(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/notifications/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load notifications (${response.statusCode})');
    return jsonDecode(response.body) as List<dynamic>;
  }

  Future<int> fetchUnreadNotificationCount(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/notifications/me/unread-count'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load unread count (${response.statusCode})');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['count'] as int;
  }

  Future<void> markNotificationRead(String token, int id) async {
    final response = await _client.patch(Uri.parse('$baseUrl/notifications/me/$id/read'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to mark notification read (${response.statusCode})');
  }

  Future<void> markAllNotificationsRead(String token) async {
    final response = await _client.patch(Uri.parse('$baseUrl/notifications/me/read-all'), headers: _authHeaders(token));
    if (response.statusCode != 204) throw ApiException('Failed to mark all notifications read (${response.statusCode})');
  }

  /// Real referral rewards + general promo codes (see
  /// services/api/src/modules/promotions/ and referrals/). Confirmed
  /// scope: a general promotions engine, not just referral rewards --
  /// referral codes are one real source of promo codes within it.
  Future<Map<String, dynamic>> fetchMyReferralInfo(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/referrals/me'), headers: _authHeaders(token));
    return _decodeOrThrow(response);
  }

  /// Real-time checkout validation — never trust a client-side check
  /// alone; the real charge in POST /order re-validates server-side too.
  Future<Map<String, dynamic>> validatePromoCode(String? token, String code) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/promo-codes/validate'),
      headers: _authHeaders(token),
      body: jsonEncode({'code': code}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 && response.statusCode != 400) {
      throw ApiException(body['reason'] as String? ?? body['error'] as String? ?? 'Request failed (${response.statusCode})');
    }
    return body; // { valid: bool, promoCode?, reason? } -- caller checks `valid` itself, a 400 here is a real "invalid code" answer, not a crash
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => 'ApiException: $message';
}
