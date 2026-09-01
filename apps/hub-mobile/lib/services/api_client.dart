import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import '../core/app_config.dart';
import '../models/shipment.dart';

/// Same real, proven network-failure handling as apps/mobile's own
/// _NetworkAwareClient -- converts raw SocketException/TimeoutException/
/// ClientException into a single, clear ApiException at one point, so
/// every call site below benefits automatically.
class _NetworkAwareClient extends http.BaseClient {
  final http.Client _inner;
  _NetworkAwareClient(this._inner);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    try {
      // 30s, not tighter -- this file also does real multipart evidence-
      // photo uploads, which can genuinely take longer than a quick
      // JSON call on a slower connection (relevant on a warehouse
      // floor's wifi specifically).
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

/// Ported from the web hub portal's own auth.js -- a 401 response
/// means the session itself is gone, not a business-logic error, so
/// callers can catch this specifically and route back to login rather
/// than showing a generic error message.
class SessionExpiredError implements Exception {
  final String message;
  SessionExpiredError([this.message = 'Your session has expired. Please log in again.']);
}

class ApiException implements Exception {
  final String message;
  final bool isNetworkError;
  ApiException(this.message, {this.isNetworkError = false});
  @override
  String toString() => 'ApiException: $message';
}

class ApiClient {
  final String baseUrl;
  final http.Client _client;

  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        _client = _NetworkAwareClient(client ?? http.Client());

  Map<String, String> _authHeaders(String token) => {'Authorization': 'Bearer $token'};
  Map<String, String> _jsonAuthHeaders(String token) => {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'};

  static MediaType _mediaTypeFor(XFile file) {
    final reported = file.mimeType;
    if (reported != null && reported.startsWith('image/')) {
      return MediaType.parse(reported);
    }
    final name = file.name.toLowerCase();
    if (name.endsWith('.png')) return MediaType('image', 'png');
    if (name.endsWith('.webp')) return MediaType('image', 'webp');
    return MediaType('image', 'jpeg');
  }

  /// GET helper matching the web app's own authedGet exactly: a 401
  /// specifically throws SessionExpiredError, any other non-2xx throws
  /// a plain ApiException carrying the backend's own {error} message.
  Future<dynamic> _authedGet(String path, String token) async {
    final response = await _client.get(Uri.parse('$baseUrl$path'), headers: _authHeaders(token));
    if (response.statusCode == 401) throw SessionExpiredError();
    final data = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException((data is Map ? data['error'] as String? : null) ?? 'Request failed (${response.statusCode})');
    }
    return data;
  }

  Future<dynamic> _authedMutate(String method, String path, String token, Map<String, dynamic> body) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll(_jsonAuthHeaders(token))
      ..body = jsonEncode(body);
    final streamedResponse = await _client.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    if (response.statusCode == 401) throw SessionExpiredError();
    final data = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException((data is Map ? data['error'] as String? : null) ?? 'Request failed (${response.statusCode})');
    }
    return data;
  }

  // ---------------- Auth ----------------

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw ApiException(data['error'] as String? ?? 'Login failed (${response.statusCode})');
    }
    return data; // { token, user }
  }

  Future<Map<String, dynamic>> getCurrentUser(String token) async {
    final response = await _client.get(Uri.parse('$baseUrl/auth/me'), headers: _authHeaders(token));
    if (response.statusCode != 200) {
      throw ApiException('Session expired or invalid (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  // ---------------- Hub staff endpoints ----------------
  // Ported 1:1 from apps/hub-portal/src/auth.js's own real, working
  // endpoint list -- same paths, same request shapes.

  Future<List<ShipmentSummary>> fetchMyShipments(String token) async {
    final data = await _authedGet('/hub/me/shipments', token) as List<dynamic>;
    return data.map((s) => ShipmentSummary.fromJson(s as Map<String, dynamic>)).toList();
  }

  Future<ShipmentDetail> fetchMyShipmentById(String token, String shipmentId) async {
    final data = await _authedGet('/hub/me/shipments/$shipmentId', token) as Map<String, dynamic>;
    return ShipmentDetail.fromJson(data);
  }

  /// Confirmed with the person: records the real, actual quantity
  /// counted on arrival -- separate from what was originally
  /// ordered. Never auto-flags a mismatch; the worker decides for
  /// themselves whether to actually flag the shipment.
  Future<void> recordReceivedQuantity(String token, String shipmentId, String productId, int receivedQuantity) async {
    await _authedMutate('PATCH', '/hub/me/shipments/$shipmentId/items/$productId/received', token, {
      'receivedQuantity': receivedQuantity,
    });
  }

  /// Confirmed with the person via mockup: fetches the real, raw PDF
  /// bytes for the delivery address label -- a separate method from
  /// _authedGet, since that helper always JSON-decodes the response,
  /// which would fail on this genuine binary PDF data.
  Future<Uint8List> fetchAddressLabelPdf(String token, String shipmentId) async {
    final response = await _client.get(Uri.parse('$baseUrl/hub/me/shipments/$shipmentId/address-label'), headers: _authHeaders(token));
    if (response.statusCode == 401) throw SessionExpiredError();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('Could not load the delivery address label (${response.statusCode})');
    }
    return response.bodyBytes;
  }

  Future<void> recordShipmentEvent(
    String token,
    String shipmentId, {
    required String step,
    String? notes,
    required List<String> photos,
    String? trackingNumber,
  }) async {
    await _authedMutate('POST', '/hub/me/shipments/$shipmentId/events', token, {
      'step': step,
      if (notes != null) 'notes': notes,
      'photos': photos,
      if (trackingNumber != null) 'trackingNumber': trackingNumber,
    });
  }

  Future<void> confirmDelivery(String token, String shipmentId, String deliveryNote) async {
    await _authedMutate('PATCH', '/hub/me/shipments/$shipmentId/confirm-delivery', token, {'deliveryNote': deliveryNote});
  }

  // ---------------- Evidence photo upload ----------------
  // Same real endpoint, same real proven upload pattern as apps/mobile's
  // own uploadReturnPhoto -- including its own confirmed fix for
  // Flutter Web (MultipartFile.fromBytes via XFile.readAsBytes, not
  // fromPath, since an XFile's .path on web is a blob URL dart:io
  // can't read).

  Future<String> uploadEvidencePhoto(String token, XFile file) async {
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

  /// Turns a relative media path (e.g. "/uploads/abc123.jpg") into a
  /// real, fully-qualified URL -- same real reasoning as apps/mobile's
  /// own resolveMediaUrl: the backend returns relative paths since it
  /// doesn't know its own public hostname at response time.
  static String resolveMediaUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '${AppConfig.apiBaseUrl}$path';
  }
}
