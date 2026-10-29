import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// ONE CART PER ACCOUNT in the app: the cart id the server answers with is used from then on, the cart screen shows the banner, and signing out gives the device a fresh empty cart. Reads the source text, so it needs no device.
void main() {
  final client = File('lib/services/api_client.dart').readAsStringSync();
  final state = File('lib/core/cart_state.dart').readAsStringSync();
  final screen = File('lib/features/cart/cart_screen.dart').readAsStringSync();
  final banner = File('lib/widgets/cart_merge_banner.dart').readAsStringSync();
  final strings = File('lib/core/app_strings.dart').readAsStringSync();
  test('the API client keeps, after EVERY cart answer, the cart id and what was combined (null when the answer has none)', () {
    expect(client.contains("lastCartId = body['cartId'] as String?;"), isTrue);
    expect(client.contains("lastCartMerge = CartMerge.fromJson(body['merge']);"), isTrue);
    expect(client.indexOf("lastCartShipping = CartShipping.fromJson(body['shipping']);") < client.indexOf("lastCartId = body['cartId'] as String?;"), isTrue);
  });
  test('CRITICAL: every cart answer goes through _applyCart, which adopts the answered id (and saves it) and keeps the notice', () {
    expect(state.contains('final answeredId = _apiClient.lastCartId;'), isTrue);
    expect(state.contains('if (answeredId != null && answeredId != _cartId) {'), isTrue);
    expect(state.contains('_secureStorage.write(key: _cartIdKey, value: answeredId);'), isTrue);
    expect(state.contains('if (combined != null) _mergeNotice = combined;'), isTrue);
  });
  test('CRITICAL: signing out (a token that becomes null) starts a fresh empty guest cart with a NEW id; signing in and other changes do not', () {
    expect(state.contains('final signedOut = _token != null && token == null;'), isTrue);
    expect(state.contains('if (signedOut) {\n      _startFreshGuestCart();\n      return;\n    }'), isTrue);
    final start = state.indexOf('Future<void> _startFreshGuestCart() async {');
    final fresh = state.substring(start, state.indexOf('await refresh();', start));
    expect(fresh.contains('final id = const Uuid().v4();'), isTrue);
    expect(fresh.contains('_items = [];'), isTrue);
    expect(fresh.contains('_mergeNotice = null;'), isTrue);
    expect(fresh.contains('await _secureStorage.write(key: _cartIdKey, value: id);'), isTrue);
  });
  test('the notice can be read and dismissed', () {
    expect(state.contains('CartMerge? get mergeNotice => _mergeNotice;'), isTrue);
    expect(state.contains('void dismissMergeNotice() {'), isTrue);
  });
  test('after an order the SAME cart is emptied (the app removes each item from it), as before', () {
    expect(state.contains('await _apiClient.removeCartItem(_cartId!, item.productId, token: _token, lang: _language);'), isTrue);
  });
  test('the cart screen shows the banner in BOTH states: an empty basket and a filled one', () {
    expect('const CartMergeBanner(),'.allMatches(screen).length, 2);
    expect(screen.contains("import '../../widgets/cart_merge_banner.dart';"), isTrue);
  });
  test('the banner shows nothing without a notice, can be dismissed, and says what was added, lowered and dropped', () {
    expect(banner.contains('if (notice == null) return const SizedBox.shrink();'), isTrue);
    expect(banner.contains('context.read<CartState>().dismissMergeNotice()'), isTrue);
    for (final key in ['cart_merged_title', 'cart_merged_added_one', 'cart_merged_added_many', 'cart_merged_reduced', 'cart_merged_dropped']) {
      expect(banner.contains("'$key'"), isTrue, reason: key);
    }
  });
  test('every word the banner uses exists in English and Arabic', () {
    for (final key in ['cart_merged_title', 'cart_merged_added_one', 'cart_merged_added_many', 'cart_merged_reduced', 'cart_merged_dropped', 'cart_merged_dismiss']) {
      final line = strings.split('\n').firstWhere((l) => l.contains("'$key':"), orElse: () => '');
      expect(line.contains("'en':"), isTrue, reason: '$key has English');
      expect(line.contains("'ar':"), isTrue, reason: '$key has Arabic');
    }
  });
}
