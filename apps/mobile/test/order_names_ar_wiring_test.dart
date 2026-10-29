import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// In Arabic the order details screen asks the server for the ARABIC product names (GET /order/:id?lang=ar); in English it asks as before. Reads the source text, so it needs no device.
void main() {
  final client = File('lib/services/api_client.dart').readAsStringSync();
  final screen = File('lib/features/orders/order_detail_screen.dart').readAsStringSync();
  test('the order details call takes an optional language', () {
    expect(client.contains("Future<Map<String, dynamic>> fetchOrderDetail(String? token, String orderId, {String? guestEmail, String? lang}) async {"), isTrue);
  });
  test('CRITICAL: lang=ar is added to the request ONLY for Arabic, together with the guest email when there is one; nothing is added otherwise', () {
    expect(client.contains("queryParameters: (guestEmail != null || lang == 'ar') ? {if (guestEmail != null) 'guestEmail': guestEmail, if (lang == 'ar') 'lang': 'ar'} : null,"), isTrue);
    expect(client.contains("final uri = Uri.parse('\$baseUrl/order/\$orderId').replace("), isTrue);
  });
  test('CRITICAL: the screen reads the app language BEFORE the await and passes it to the call', () {
    final read = screen.indexOf("final lang = context.read<LanguageState>().isArabic ? 'ar' : 'en';");
    final call = screen.indexOf('fetchOrderDetail(auth.token, widget.orderId, guestEmail: widget.guestEmail, lang: lang);');
    expect(read > 0 && call > read && call - read < 250, isTrue);
  });
  test('the other calls of the same file (the guest email only) are untouched', () {
    expect("guestEmail != null ? {'guestEmail': guestEmail} : null,".allMatches(client).length, 2);
  });
}
