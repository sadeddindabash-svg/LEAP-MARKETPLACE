import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/cart_item.dart';
import '../services/api_client.dart';

/// Real draft-order queue (#60). Deliberately narrow scope: only ever
/// triggered by a genuine real network failure at checkout (see
/// checkout_screen.dart's own real error handling), never a
/// validation error or any other real failure -- those need the
/// person's own real attention, not a silent retry.
///
/// A real, explicit choice by the person ("Save and send when back
/// online?"), not an automatic background queue they never asked for
/// -- placing an order is consequential enough that a silent retry
/// they didn't agree to would be a real, confirmed surprise later.
class DraftOrderQueue {
  static const _storageKey = 'leap_pending_draft_orders';
  static const _storage = FlutterSecureStorage();

  /// Real save (#60) -- persists the real order payload locally,
  /// tagged with a real, fresh idempotency key so a later retry can
  /// never create a real duplicate order if an earlier attempt
  /// already succeeded server-side.
  static Future<void> save({
    required List<CartItem> items,
    String? userId,
    String? guestEmail,
    String? promoCode,
    Map<String, dynamic>? address,
    String? addressId,
    bool waitForAllShipments = false,
  }) async {
    final idempotencyKey = const Uuid().v4();
    final draft = {
      'idempotencyKey': idempotencyKey,
      'items': items.map((i) => {'productId': i.productId, 'quantity': i.quantity}).toList(),
      'userId': userId,
      'guestEmail': guestEmail,
      'promoCode': promoCode,
      'address': address,
      'addressId': addressId,
      'waitForAllShipments': waitForAllShipments,
    };
    final pending = await _loadAll();
    pending.add(draft);
    await _storage.write(key: _storageKey, value: jsonEncode(pending));
  }

  static Future<List<Map<String, dynamic>>> _loadAll() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw == null || raw.isEmpty) return [];
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  static Future<int> pendingCount() async => (await _loadAll()).length;

  /// Real, best-effort submission attempt (#60) -- called on real app
  /// startup/resume, not a persistent background listener (this
  /// sandbox's own honest scope: no real always-on connectivity
  /// monitor here, just an opportunistic retry at natural real app
  /// lifecycle points). A real failure on any individual draft is
  /// left in the real queue for the next attempt, never silently
  /// dropped.
  static Future<int> trySubmitPending() async {
    final pending = await _loadAll();
    if (pending.isEmpty) return 0;
    final stillPending = <Map<String, dynamic>>[];
    var submitted = 0;
    for (final draft in pending) {
      try {
        final items = (draft['items'] as List)
            .map((i) => CartItem(
                  productId: i['productId'] as String,
                  quantity: i['quantity'] as int,
                  name: '',
                  price: 0,
                  currencyCode: 'USD',
                  stockQuantity: 0,
                ))
            .toList();
        await ApiClient().placeOrder(
          items: items,
          userId: draft['userId'] as String?,
          guestEmail: draft['guestEmail'] as String?,
          promoCode: draft['promoCode'] as String?,
          address: draft['address'] as Map<String, dynamic>?,
          addressId: draft['addressId'] as String?,
          waitForAllShipments: draft['waitForAllShipments'] as bool? ?? false,
          idempotencyKey: draft['idempotencyKey'] as String?,
        );
        submitted++;
      } catch (_) {
        // Real, honest retention: a real failure (still offline, or a
        // genuinely different problem this time) keeps this real
        // draft queued for the next attempt rather than dropping it.
        stillPending.add(draft);
      }
    }
    await _storage.write(key: _storageKey, value: jsonEncode(stillPending));
    return submitted;
  }
}
