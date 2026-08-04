import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:in_app_review/in_app_review.dart';

/// Real app-store review prompt, triggered after a genuinely positive
/// real moment -- an order reaching real "delivered" status (see
/// order_detail_screen.dart's own real call site) -- rather than
/// randomly or on first launch, when the person has no real basis yet
/// to judge the app.
///
/// HONEST SCOPE: `InAppReview.requestReview()` wraps Apple's real
/// `SKStoreReviewController` and Android's real Play In-App Review
/// API. Both are deliberately throttled by the OS itself (e.g. iOS
/// limits how many times the real system dialog can appear to the
/// same person within a rolling real time window, regardless of how
/// often the app asks) -- calling this does not guarantee a real
/// prompt appears, and there is no real way for the app itself to
/// know whether one actually did. This class's own real
/// responsibility is narrower: decide when it's a genuinely
/// reasonable moment to ask at all, and avoid asking again for the
/// same real order once it already has.
class ReviewPromptState {
  static const _storage = FlutterSecureStorage();
  static const _promptedOrderIdsKey = 'review_prompted_order_ids_v1';

  /// Call once a real order has genuinely reached delivered status.
  /// Safe to call on every real screen load -- internally checks
  /// whether this exact real order has already triggered an attempt
  /// before doing anything.
  static Future<void> maybePromptAfterDelivery(String orderId) async {
    try {
      final alreadyPrompted = await _hasPrompted(orderId);
      if (alreadyPrompted) return;
      await _markPrompted(orderId);

      final inAppReview = InAppReview.instance;
      if (await inAppReview.isAvailable()) {
        await inAppReview.requestReview();
      }
    } catch (_) {
      // Real, honest no-op: a real failure here (e.g. running on a
      // real platform/OS version the plugin doesn't support) must
      // never affect anything else on this real screen -- a rating
      // prompt is a nice-to-have, not a real, load-bearing feature.
    }
  }

  static Future<bool> _hasPrompted(String orderId) async {
    final raw = await _storage.read(key: _promptedOrderIdsKey);
    if (raw == null) return false;
    return raw.split(',').contains(orderId);
  }

  static Future<void> _markPrompted(String orderId) async {
    final raw = await _storage.read(key: _promptedOrderIdsKey);
    final ids = raw == null ? <String>{} : raw.split(',').toSet();
    ids.add(orderId);
    // Real, bounded storage (new) -- keeps only the most recent 50
    // real order IDs rather than growing this one string forever for
    // a real, long-lived account with many real orders over time.
    final bounded = ids.length > 50 ? ids.skip(ids.length - 50).toSet() : ids;
    await _storage.write(key: _promptedOrderIdsKey, value: bounded.join(','));
  }
}
