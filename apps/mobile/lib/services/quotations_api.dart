import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_client.dart';

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

  Future<Map<String, dynamic>> renew(String token, String id, String lang, String displayCurrency) async => (await _send(() => _http.post(
        _uri('/quotations/me/${Uri.encodeComponent(id)}/renew', lang),
        headers: _headers(token, json: true),
        body: jsonEncode({'displayCurrency': displayCurrency}),
      ))) as Map<String, dynamic>;
}
