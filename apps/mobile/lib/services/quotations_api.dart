import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_client.dart';
import '../models/product.dart';

/// "Get a quotation" (services/api/src/modules/quotations, migration 124): the calls the app makes. Kept apart from ApiClient so nothing there changes.
/// A refusal is an ApiException carrying the server's code (quote_expired, quote_out_of_stock, ...), so the screen shows its own sentence for it.
class QuotationsApi {
  final ApiClient _api;
  final http.Client _http;
  QuotationsApi({ApiClient? api, http.Client? client})
      : _api = api ?? ApiClient(),
        _http = client ?? http.Client();

  Uri _uri(String path, String lang) => Uri.parse('${_api.baseUrl}$path${path.contains('?') ? '&' : '?'}lang=$lang');

  Map<String, String> _headers(String? token, {bool json = false}) => {
        if (token != null) 'Authorization': 'Bearer $token',
        if (json) 'Content-Type': 'application/json',
      };

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    http.Response res;
    try {
      res = await request().timeout(const Duration(seconds: 30));
    } catch (_) {
      throw ApiException('No internet connection. Check your network and try again.', isNetworkError: true);
    }
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final map = body is Map<String, dynamic> ? body : const <String, dynamic>{};
      throw ApiException((map['error'] as String?) ?? 'Request failed (${res.statusCode})', code: map['code'] as String?, details: map);
    }
    return body;
  }

  Future<Map<String, dynamic>> create(String token, Map<String, dynamic> input, String lang) async =>
      (await _send(() => _http.post(_uri('/quotations', lang), headers: _headers(token, json: true), body: jsonEncode(input)))) as Map<String, dynamic>;

  Future<List<dynamic>> mine(String token, String lang) async => (await _send(() => _http.get(_uri('/quotations/me', lang), headers: _headers(token)))) as List<dynamic>;

  Future<Map<String, dynamic>> one(String token, String id, String lang) async =>
      (await _send(() => _http.get(_uri('/quotations/me/${Uri.encodeComponent(id)}', lang), headers: _headers(token)))) as Map<String, dynamic>;

  /// The parts that fit a car of the catalogue: the shop filtered to its generation, year and version (the sellers' fitment). Up to 60, for a search or a section.
  Future<List<Product>> fittingParts(Map<String, dynamic> vehicle, {String search = '', String? category, String lang = 'en'}) async {
    final uri = Uri.parse('${_api.baseUrl}/catalog/products').replace(queryParameters: {
      'generationId': '${vehicle['generationId']}',
      'year': '${vehicle['year']}',
      if (vehicle['versionId'] != null) 'versionId': '${vehicle['versionId']}',
      if (search.isNotEmpty) 'search': search,
      if (category != null) 'category': category,
      'limit': '60',
      'lang': lang,
    });
    final body = await _send(() => _http.get(uri));
    return (body as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Which of these parts fit the car (parts brought from the basket, or kept when the car changed).
  Future<Set<String>> fitCheck(String token, Map<String, dynamic> vehicle, List<String> productIds, String lang) async {
    final body = await _send(() => _http.post(_uri('/quotations/fit-check', lang), headers: _headers(token, json: true), body: jsonEncode({'vehicle': vehicle, 'productIds': productIds})));
    return {for (final id in ((body as Map<String, dynamic>)['fits'] as List)) id as String};
  }

  Future<Map<String, dynamic>> renew(String token, String id, String lang, String displayCurrency) async => (await _send(() => _http.post(
        _uri('/quotations/me/${Uri.encodeComponent(id)}/renew', lang),
        headers: _headers(token, json: true),
        body: jsonEncode({'displayCurrency': displayCurrency}),
      ))) as Map<String, dynamic>;
}
