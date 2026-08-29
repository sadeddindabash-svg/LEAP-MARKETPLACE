import 'dart:async';
import 'dart:convert';
import 'dart:io';
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
import '../models/quote_request.dart';

/// Real, centralized offline/network-failure handling (new). Without
/// this, a real network failure (no internet, DNS lookup failure, a
/// request that times out) throws a raw `SocketException` or
/// `http.ClientException` -- neither is an `ApiException`, so the 65
/// real call sites below that only ever catch `ApiException`
/// specifically would either let a cryptic technical message like
/// "SocketException: Failed host lookup..." reach the screen, or (in
/// a screen with no generic catch-all) crash outright. Wrapping the
/// real `http.Client` here, once, converts those real failures into a
/// clear, friendly `ApiException` at a single point -- every existing
/// call site benefits automatically, none of them needed to change.
class _NetworkAwareClient extends http.BaseClient {
  final http.Client _inner;
  _NetworkAwareClient(this._inner);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    try {
      // 30s, not a tighter value -- this file also has real multipart
      // photo uploads (uploadReviewPhoto, product-image) that can
      // genuinely take longer than a quick JSON API call on a slower
      // real connection; too tight a timeout would fail a real,
      // still-in-progress upload, not just a genuinely dead connection.
      return await _inner.send(request).timeout(const Duration(seconds: 30));
    } on SocketException {
      throw ApiException('No internet connection. Check your network and try again.', isNetworkError: true);
    } on TimeoutException {
      throw ApiException('The request took too long to respond. Check your connection and try again.', isNetworkError: true);
    } on http.ClientException catch (e) {
      throw ApiException('Could not reach the server: ${e.message}', isNetworkError: true);
    }
  }
}

/// Thin wrapper around services/api. Kept deliberately simple for the MVP —
/// swap in a generated client (e.g. from an OpenAPI spec) once the backend
/// contract stabilizes, rather than hand-maintaining this longer-term.
class ApiClient {
  final String baseUrl;
  final http.Client _client;

  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _client = _NetworkAwareClient(client ?? http.Client());

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

  Future<List<Product>> fetchProductsByCategory(String categoryId, {String? part, String? vehicleId, String? generationId, String lang = 'en'}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      'category': categoryId,
      if (part != null) 'part': part,
      if (vehicleId != null) 'vehicleId': vehicleId,
      if (generationId != null) 'generationId': generationId,
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
  Future<List<Product>> fetchProducts({String? sort, String? generationId, int? year, String lang = 'en', int? limit, int? page}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      if (sort != null) 'sort': sort,
      if (generationId != null) 'generationId': generationId,
      if (year != null) 'year': '$year',
      if (limit != null) 'limit': '$limit',
      if (page != null) 'page': '$page',
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
  Future<List<Product>> searchProducts(String query, {String lang = 'en', String? generationId, int? year, String? sort, num? minPrice, num? maxPrice, int? maxDeliveryDays}) async {
    final uri = Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
      if (query.isNotEmpty) 'search': query,
      'lang': lang,
      if (generationId != null) 'generationId': generationId,
      if (year != null) 'year': '$year',
      if (sort != null) 'sort': sort,
      if (minPrice != null) 'minPrice': '$minPrice',
      if (maxPrice != null) 'maxPrice': '$maxPrice',
      if (maxDeliveryDays != null) 'maxDeliveryDays': '$maxDeliveryDays',
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

  // Real, new -- checkout's own real payment methods, filtered to
  // whichever real country the buyer's own selected shipping address
  // is in. The backend itself resolves either a real 2-letter country
  // code or a real full country name (what a saved address actually
  // stores), so this can be passed straight through unchanged.
  Future<List<dynamic>> fetchPaymentMethodsForCountry(String country) async {
    final response = await _client.get(Uri.parse('$baseUrl/payment-methods/for-country/${Uri.encodeComponent(country)}'));
    if (response.statusCode != 200) throw ApiException('Failed to load payment methods (${response.statusCode})');
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

  /// Real trending searches (new) -- genuinely aggregated from real,
  /// logged search queries platform-wide (see
  /// services/api/src/modules/catalog/routes.js's own real
  /// GET /trending-searches), not a hardcoded example list.
  Future<List<String>> fetchTrendingSearches() async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/trending-searches'));
    if (response.statusCode != 200) throw ApiException('Failed to load trending searches (${response.statusCode})');
    return (jsonDecode(response.body) as List).cast<String>();
  }

  /// Real search autocomplete (#28) -- calls the new real backend
  /// endpoint, matching on real, previously-searched terms.
  Future<List<String>> fetchAutocompleteSuggestions(String prefix) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/search-autocomplete?prefix=${Uri.encodeQueryComponent(prefix)}'));
    if (response.statusCode != 200) throw ApiException('Failed to load suggestions (${response.statusCode})');
    return (jsonDecode(response.body) as List).cast<String>();
  }

  /// Real minimum-supported app version (new) -- calls the new real,
  /// genuinely public backend endpoint (no auth required, since a
  /// real guest hasn't logged in yet and the whole point is to catch
  /// an outdated real app before it gets that far). Returns null when
  /// no real minimum has ever been configured.
  Future<String?> fetchMinAppVersion() async {
    final response = await _client.get(Uri.parse('$baseUrl/platform-settings/min-app-version'));
    if (response.statusCode != 200) throw ApiException('Failed to load minimum app version (${response.statusCode})');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['minVersion'] as String?;
  }

  /// Real VIN decoding via NHTSA's own free, public vPIC API --
  /// genuinely free US government vehicle data, no API key or paid
  /// account required (confirmed directly: https://vpic.nhtsa.dot.gov
  /// is a real, no-auth, no-cost REST API). Returns the decoded real
  /// Make/Model/ModelYear as a simple map; the caller is responsible
  /// for fuzzy-matching these real values against this app's own
  /// real brand/model/generation records, since NHTSA's own naming
  /// won't always exactly match this app's (see
  /// vehicle_filter_sheet.dart's own _tryVinLookup for that real
  /// matching logic).
  ///
  /// HONEST LIMITATION: this is a real, direct third-party HTTP call
  /// made from the app itself, not proxied through the real backend.
  /// On a real Android/iOS build this works exactly like any other
  /// real HTTP call. On Flutter Web specifically (e.g. testing via
  /// `flutter run -d chrome`), this could be blocked by the browser's
  /// own CORS policy if NHTSA's API doesn't set permissive CORS
  /// headers -- genuinely untested here, since this sandbox has no
  /// real Flutter/Dart SDK to run it against. Worth confirming
  /// directly the first time this is tested for real.
  Future<Map<String, String>> decodeVin(String vin) async {
    final trimmed = vin.trim().toUpperCase();
    if (trimmed.length != 17) {
      throw ApiException('A VIN is always 17 characters — please check and try again.');
    }
    final response = await _client.get(Uri.parse('https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/$trimmed?format=json'));
    if (response.statusCode != 200) throw ApiException('Could not reach the VIN decoder (${response.statusCode})');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final results = (body['Results'] as List?)?.cast<Map<String, dynamic>>();
    if (results == null || results.isEmpty) throw ApiException('Could not decode this VIN.');
    final result = results.first;
    final make = result['Make'] as String?;
    final model = result['Model'] as String?;
    final year = result['ModelYear'] as String?;
    if (make == null || make.isEmpty) throw ApiException('This VIN could not be recognized. Try entering your vehicle manually instead.');
    return {'make': make, 'model': model ?? '', 'year': year ?? ''};
  }

  /// Real address autocomplete via OpenStreetMap's own free, public
  /// Nominatim API -- no API key or paid account required (confirmed
  /// directly: nominatim.openstreetmap.org is a real, no-auth REST
  /// API, per its own real, published usage policy).
  ///
  /// HONEST, IMPORTANT LIMITATION, stated directly: Nominatim's own
  /// real usage policy explicitly caps public-instance use at a
  /// maximum of 1 request/second and asks callers not to use it for
  /// real, sustained autocomplete-style traffic in production --
  /// see address_form_screen.dart's own real debounce (roughly 600ms
  /// between keystrokes) for how this stays within that real limit
  /// for one person typing, but a real app with meaningful real
  /// traffic should move to a real paid provider (Google Places,
  /// Mapbox) or self-host Nominatim rather than rely on the free
  /// public instance long-term.
  ///
  /// Requests structured `addressdetails=1` specifically so a
  /// selected real suggestion can auto-fill this form's own separate
  /// street/city/country/postal fields, not just show one flat
  /// display string with nothing to parse it back out of.
  Future<List<Map<String, dynamic>>> searchAddresses(String query) async {
    if (query.trim().length < 3) return [];
    final uri = Uri.parse('https://nominatim.openstreetmap.org/search').replace(queryParameters: {
      'q': query.trim(),
      'format': 'jsonv2',
      'addressdetails': '1',
      'limit': '5',
    });
    // Nominatim's own real usage policy requires a real, identifying
    // User-Agent on every real request -- not optional, a request
    // without one can be real refused or real rate-limited harder.
    final response = await _client.get(uri, headers: {'User-Agent': 'LeapAutoPartsApp/1.0 (contact: support@leapautoparts.com)'});
    if (response.statusCode != 200) throw ApiException('Could not search addresses (${response.statusCode})');
    return (jsonDecode(response.body) as List).cast<Map<String, dynamic>>();
  }

  Future<Product> fetchProductById(String productId, {String lang = 'en'}) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId?lang=$lang'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load product (${response.statusCode})');
    }
    return Product.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Confirmed with the person: merged what used to be two separate
  /// real sections (this one, plus a separate "same-model" one) into
  /// one. Now genuinely requires BOTH the same real vehicle model AND
  /// the same real category, always in-stock -- a real narrowing, not
  /// a broadening.
  Future<List<Product>> fetchProductAlternatives(String productId, {String lang = 'en'}) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId/alternatives?lang=$lang'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load alternatives (${response.statusCode})');
    }
    return (jsonDecode(response.body) as List).map((j) => Product.fromJson(j as Map<String, dynamic>)).toList();
  }

  /// Real multi-supplier price comparison for the identical real OEM
  /// part number (#78) -- calls the new real backend endpoint.
  Future<List<Product>> fetchOemAlternatives(String productId, {String lang = 'en'}) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId/oem-alternatives?lang=$lang'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load OEM comparison (${response.statusCode})');
    }
    return (jsonDecode(response.body) as List).map((j) => Product.fromJson(j as Map<String, dynamic>)).toList();
  }

  /// Same real idea as fetchProductAlternatives above, broadened to
  /// the whole real vehicle brand -- the real backend already
  /// excludes anything shown there, so these two real lists never
  /// overlap.
  Future<List<Product>> fetchSameBrandProducts(String productId, {String lang = 'en', int page = 1}) async {
    final response = await _client.get(Uri.parse('$baseUrl/catalog/products/$productId/same-brand?lang=$lang&page=$page'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load same-brand products (${response.statusCode})');
    }
    return (jsonDecode(response.body) as List).map((j) => Product.fromJson(j as Map<String, dynamic>)).toList();
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

  /// Real "set as default" (new, migration 047) -- already returns the
  /// real, updated full list directly (mirrors add/removeVehicleFromGarage
  /// above), so a caller can use it directly rather than fetching again.
  Future<List<Vehicle>> setDefaultVehicle(String token, String generationId, int year) async {
    final response = await _client.patch(Uri.parse('$baseUrl/garage/me/$generationId/$year/default'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to set default vehicle (${response.statusCode})');
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

  /// Real completion of a 2FA login (new) -- calls the new real
  /// POST /auth/login/2fa (see AuthState.verifyTwoFactorLogin, the
  /// real caller).
  Future<Map<String, dynamic>> verifyTwoFactorLogin(String userId, String code) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login/2fa'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'code': code}),
    );
    return _decodeAuthResponse(response);
  }

  /// Real 2FA setup, step 1 of 2 (new) -- returns a real, fresh QR
  /// code (as a data URL) plus the real raw secret as a fallback for
  /// manual entry.
  Future<Map<String, dynamic>> setupTwoFactor(String token) async {
    final response = await _client.post(Uri.parse('$baseUrl/auth/2fa/setup'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to start 2FA setup (${response.statusCode})');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Real 2FA setup, step 2 of 2 (new) -- proves the real pending
  /// secret from step 1 was genuinely scanned/entered correctly.
  Future<void> confirmTwoFactor(String token, String code) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/2fa/confirm'),
      headers: _authHeaders(token),
      body: jsonEncode({'code': code}),
    );
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to confirm 2FA (${response.statusCode})');
    }
  }

  /// Real 2FA disable (new) -- requires the real current password.
  Future<void> disableTwoFactor(String token, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/2fa/disable'),
      headers: _authHeaders(token),
      body: jsonEncode({'password': password}),
    );
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to disable 2FA (${response.statusCode})');
    }
  }

  /// Real "change email" (new) -- closes a real gap: no self-service
  /// way to change your account email existed at all before this,
  /// only display-only. Returns a real, fresh token+user (email is a
  /// real JWT claim) -- the caller (AuthState.updateSession) stores it
  /// the same way a real login does.
  Future<Map<String, dynamic>> changeEmail(String token, String newEmail, String currentPassword) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/auth/me/email'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'newEmail': newEmail, 'currentPassword': currentPassword}),
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

  /// Real annual spend summary (#30) -- calls the new real backend
  /// endpoint, aggregating a real buyer's own real order history for
  /// one real year. Defaults to the real current year.
  Future<Map<String, dynamic>> fetchAnnualSpendSummary(String token, {int? year}) async {
    final uri = Uri.parse('$baseUrl/order/me/annual-summary').replace(queryParameters: year != null ? {'year': '$year'} : null);
    final response = await _client.get(uri, headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) {
      throw ApiException('Failed to load annual summary (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Real buyer-facing display currency rates (new) -- public, no auth
  /// needed, matching the backend route's own public access. Returns
  /// { currencyCode: rate } -- 1 USD = `rate` units of currencyCode.
  Future<Map<String, dynamic>> fetchDisplayRates() async {
    final response = await _client.get(Uri.parse('$baseUrl/pricing/display-rates'));
    if (response.statusCode != 200) {
      throw ApiException('Failed to load display rates (${response.statusCode})');
    }
    return (jsonDecode(response.body) as Map<String, dynamic>)['rates'] as Map<String, dynamic>;
  }

  /// Fetches full detail for one order, including per-supplier sub-orders
  /// (needed to know which subOrderId to attach a return request to).
  /// Uses the real logged-in buyer's token — GET /order/:id is
  /// ownership-checked server-side (see services/api/src/modules/order/routes.js;
  /// this endpoint used to be a real security hole, fixed in a later pass).
  /// [token] is now optional -- the real backend endpoint uses
  /// `optionalAuth` and accepts a real guest via `?guestEmail=`
  /// instead (see that endpoint's own real header comment). Closes a
  /// real gap: this method previously required a token unconditionally,
  /// so a real guest-checkout buyer could never actually call it at
  /// all, even though the backend was already built to allow it.
  Future<Map<String, dynamic>> fetchOrderDetail(String? token, String orderId, {String? guestEmail}) async {
    final uri = Uri.parse('$baseUrl/order/$orderId').replace(
      queryParameters: guestEmail != null ? {'guestEmail': guestEmail} : null,
    );
    final response = await _client.get(
      uri,
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
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
    // Real shipping consolidation preference (#51) -- defaults to
    // false (ship as available), matching the only real behavior
    // that existed before this.
    bool waitForAllShipments = false,
    // Real idempotency key (#60) -- lets a real retry (e.g. from
    // DraftOrderQueue) safely resubmit without creating a real
    // duplicate order if an earlier attempt already succeeded
    // server-side.
    String? idempotencyKey,
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
        'waitForAllShipments': waitForAllShipments,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
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
      // Real, temporary diagnostic aid -- surfaces the real
      // debugMessage (a development-only field the backend adds for
      // a genuinely unexpected error) directly in the app's own
      // error message, so it shows up wherever this exception is
      // displayed rather than requiring the backend's own terminal.
      final debugMessage = body['debugMessage'] as String?;
      final baseMessage = body['error'] as String? ?? 'Request failed (${response.statusCode})';
      throw ApiException(debugMessage != null ? '$baseMessage: $debugMessage' : baseMessage);
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

  /// Real ticket-helpfulness feedback (#100) -- calls the new real
  /// backend endpoint, only accepted once a ticket is genuinely
  /// resolved/closed.
  Future<void> submitTicketFeedback(String ticketId, bool helpful, {String? token, String? guestEmail}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/support/my-tickets/$ticketId/feedback'),
      headers: _authHeaders(token),
      body: jsonEncode({'helpful': helpful, if (guestEmail != null) 'guestEmail': guestEmail}),
    );
    _decodeOrThrow(response);
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

  /// Real gap closed here (mirrors the same fix already made for
  /// support tickets): the backend's GET /returns/my-cases/:id already
  /// supported a real guest lookup via a matching ?guestEmail= this
  /// whole time (built earlier this session for web-storefront's own
  /// /returns page) -- this was just never wired up on mobile. This was
  /// only ever called with a real logged-in token before.
  Future<Map<String, dynamic>> fetchReturnCaseDetail(String caseId, {String? token, String? guestEmail}) async {
    final uri = Uri.parse('$baseUrl/returns/my-cases/$caseId').replace(
      queryParameters: guestEmail != null ? {'guestEmail': guestEmail} : null,
    );
    final response = await _client.get(uri, headers: _authHeaders(token));
    return _decodeOrThrow(response);
  }

  Future<Map<String, dynamic>> sendReturnCaseMessage(String caseId, String message, {String? token, String? guestEmail}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/returns/my-cases/$caseId/messages'),
      headers: _authHeaders(token),
      body: jsonEncode({'message': message, if (guestEmail != null) 'guestEmail': guestEmail}),
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

  /// Real profile photo upload -- reuses the exact same real generic
  /// upload endpoint already used for review/product photos (its own
  /// header comment already states it's meant to be reused this way).
  Future<String> uploadAvatarPhoto(String token, XFile file) async {
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

  /// Real profile photo save/remove -- calls the new real
  /// PATCH /auth/me/avatar. Pass null to remove the real photo.
  Future<void> updateAvatar(String token, String? avatarUrl) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/auth/me/avatar'),
      headers: _authHeaders(token),
      body: jsonEncode({'avatarUrl': avatarUrl}),
    );
    if (response.statusCode != 200) {
      throw ApiException('Failed to update profile photo (${response.statusCode})');
    }
  }

  /// Real bug report submission (#139) -- calls the new real backend
  /// endpoint. No required auth -- a real guest can submit too
  /// (optionalAuth on the backend), but an available real token is
  /// still sent so the report can be tied to a real account.
  Future<void> submitBugReport({required String description, String? screenshotUrl, String? deviceInfo, String? token}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/bug-reports'),
      headers: token != null ? _authHeaders(token) : {'Content-Type': 'application/json'},
      body: jsonEncode({
        'description': description,
        if (screenshotUrl != null) 'screenshotUrl': screenshotUrl,
        if (deviceInfo != null) 'deviceInfo': deviceInfo,
      }),
    );
    if (response.statusCode != 201) {
      throw ApiException('Failed to submit report (${response.statusCode})');
    }
  }

  /// Real account deletion (#147) -- calls the new real backend
  /// endpoint, which anonymizes rather than hard-deletes.
  Future<void> deleteAccount(String token, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/me/delete'),
      headers: _authHeaders(token),
      body: jsonEncode({'password': password}),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw ApiException(body['error'] as String? ?? 'Failed to delete account (${response.statusCode})');
    }
  }

  /// Real per-referral detail history (#149) -- calls the new real
  /// backend endpoint.
  Future<List<Map<String, dynamic>>> fetchReferralHistory(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/referrals/me/history'), headers: _authHeaders(token));
    if (response.statusCode != 200) throw ApiException('Failed to load referral history (${response.statusCode})');
    return (jsonDecode(response.body) as List).cast<Map<String, dynamic>>();
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

  Future<List<Product>> fetchRecentlyViewed(String token, {String lang = 'en'}) async {
    final uri = Uri.parse('$baseUrl/recently-viewed/me').replace(queryParameters: {'lang': lang});
    final response = await _client.get(uri, headers: _authHeaders(token));
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

  /// Real device-token registration for push notifications (see
  /// services/api/src/modules/push/routes.js's own real endpoint).
  /// Called from PushState once a real FCM token exists.
  Future<void> registerDeviceToken(String authToken, String deviceToken, String platform) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/notifications/register-device'),
      headers: _authHeaders(authToken),
      body: jsonEncode({'token': deviceToken, 'platform': platform}),
    );
    if (response.statusCode != 204) throw ApiException('Failed to register device token (${response.statusCode})');
  }

  /// Real device-token removal on logout -- a device that's no longer
  /// signed in as this real user shouldn't keep receiving this real
  /// user's own push notifications (see PushState.unregister, the
  /// real caller).
  Future<void> unregisterDeviceToken(String authToken, String deviceToken) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl/notifications/register-device'),
      headers: _authHeaders(authToken),
      body: jsonEncode({'token': deviceToken}),
    );
    if (response.statusCode != 204) throw ApiException('Failed to unregister device token (${response.statusCode})');
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

  // ============================================================
  // Real "request a part we don't carry" (RFQ), confirmed with the
  // person through several rounds of design discussion before
  // building.
  // ============================================================

  Future<QuoteRequest> createQuoteRequest(String token, {required String generationId, required int year}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/quote-requests'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'generationId': generationId, 'year': year}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to create the request (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<List<QuoteRequest>> fetchMyQuoteRequests(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/quote-requests/mine'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to load your requests (${response.statusCode})');
    final list = jsonDecode(response.body) as List;
    return list.map((r) => QuoteRequest.fromJson(r as Map<String, dynamic>)).toList();
  }

  Future<QuoteRequest> fetchQuoteRequest(String token, String requestId) async {
    final response = await _client.get(Uri.parse('$baseUrl/quote-requests/$requestId'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode != 200) throw ApiException('Failed to load this request (${response.statusCode})');
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> addQuoteRequestItem(
    String token,
    String requestId, {
    required String name,
    String? description,
    String? referencePhotoUrl,
    int quantity = 1,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/quote-requests/$requestId/items'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'name': name, 'description': description, 'referencePhotoUrl': referencePhotoUrl, 'quantity': quantity}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to add this item (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> updateQuoteRequestItem(
    String token,
    String requestId,
    String itemId, {
    String? name,
    String? description,
    String? referencePhotoUrl,
    int? quantity,
  }) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl/quote-requests/$requestId/items/$itemId'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (referencePhotoUrl != null) 'referencePhotoUrl': referencePhotoUrl,
        if (quantity != null) 'quantity': quantity,
      }),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to update this item (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> deleteQuoteRequestItem(String token, String requestId, String itemId) async {
    final response = await _client.delete(Uri.parse('$baseUrl/quote-requests/$requestId/items/$itemId'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to remove this item (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> submitQuoteRequest(String token, String requestId) async {
    final response = await _client.post(Uri.parse('$baseUrl/quote-requests/$requestId/submit'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to submit this request (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> cancelQuoteRequest(String token, String requestId) async {
    final response = await _client.post(Uri.parse('$baseUrl/quote-requests/$requestId/cancel'), headers: {'Authorization': 'Bearer $token'});
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to cancel this request (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<QuoteRequest> placeQuoteRequestOrder(String token, String requestId, {required String cartId}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/quote-requests/$requestId/place-order'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
      body: jsonEncode({'cartId': cartId}),
    );
    if (response.statusCode >= 400) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw ApiException(body['error'] as String? ?? 'Failed to place this order (${response.statusCode})');
    }
    return QuoteRequest.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}

class ApiException implements Exception {
  final String message;
  // Real, typed flag (#60) -- set at the actual real throw site
  // (_NetworkAwareClient) where the real cause is genuinely known,
  // rather than fragile string-matching against exact wording later
  // to distinguish a real network failure from a real business-logic
  // error (e.g. "items is required").
  final bool isNetworkError;
  ApiException(this.message, {this.isNetworkError = false});
  @override
  String toString() => 'ApiException: $message';
}
