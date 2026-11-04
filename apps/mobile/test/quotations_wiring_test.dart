import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// "Get a quotation" in the app: the screens are reachable (routes), from the basket (under Checkout) and from the account menu, and they ask the server
// (prices are never worked out or typed in the app). Reads the source text.
void main() {
  final app = File('lib/app.dart').readAsStringSync();
  final cart = File('lib/features/cart/cart_screen.dart').readAsStringSync();
  final account = File('lib/features/account/account_screen.dart').readAsStringSync();
  final screens = File('lib/features/quotations/quotations_screens.dart').readAsStringSync();
  final api = File('lib/services/quotations_api.dart').readAsStringSync();
  test('the three screens have their routes, "new" before ":id"', () {
    final n = app.indexOf("GoRoute(path: '/quotations/new'");
    final id = app.indexOf("GoRoute(path: '/quotations/:id'");
    expect(app.contains("GoRoute(path: '/quotations', builder: (context, state) => const MyQuotationsScreen())"), isTrue);
    expect(n > 0 && id > n, isTrue);
  });
  test('CRITICAL: the basket offers it for the ticked parts, and the account menu lists My quotations', () {
    expect(cart.contains("context.push('/quotations/new')"), isTrue);
    expect(account.contains("label: qtr(context, 'my_quotations'), route: '/quotations'"), isTrue);
  });
  test('the quotation is made from the ticked lines and the server prices it (only ids and quantities are sent)', () {
    expect(screens.contains("context.watch<CartState>().forCheckout.items"), isTrue);
    expect(screens.contains("{'productId': i.productId, 'quantity': i.quantity}"), isTrue);
    expect(api.contains("_uri('/quotations', lang)"), isTrue);
  });
}
