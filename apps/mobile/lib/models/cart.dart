import 'cart_item.dart';

/// Confirmed with the person: wraps the real, full backend cart
/// response -- items plus the real, persisted promo code state
/// (survives even closing and reopening the app, since it's stored
/// on the real cart record itself, not just in-memory app state).
/// Replaces the previous, narrower `List<CartItem>` shape every cart
/// endpoint returned, which silently discarded this real promo data.
class Cart {
  final List<CartItem> items;
  final String? appliedPromoCode;
  final PromoDetails? appliedPromoDetails;
  final double promoDiscountUsd;
  // Confirmed with the person: whole-basket checkout price lock --
  // starts when the buyer genuinely enters checkout (not when an
  // item is added), lasts 60 real minutes, and keeps counting down
  // even if the buyer leaves and returns to checkout before it
  // expires (explicitly confirmed: not reset by re-entering).
  final bool lockActive;
  final DateTime? lockExpiresAt;

  const Cart({
    required this.items,
    this.appliedPromoCode,
    this.appliedPromoDetails,
    this.promoDiscountUsd = 0,
    this.lockActive = false,
    this.lockExpiresAt,
  });

  factory Cart.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List? ?? [];
    return Cart(
      items: itemsJson.map((e) => CartItem.fromJson(e as Map<String, dynamic>)).toList(),
      appliedPromoCode: json['appliedPromoCode'] as String?,
      appliedPromoDetails: json['appliedPromoDetails'] == null
          ? null
          : PromoDetails.fromJson(json['appliedPromoDetails'] as Map<String, dynamic>),
      promoDiscountUsd: (json['promoDiscountUsd'] as num?)?.toDouble() ?? 0,
      lockActive: json['lockActive'] as bool? ?? false,
      lockExpiresAt: json['lockExpiresAt'] == null ? null : DateTime.parse(json['lockExpiresAt'] as String),
    );
  }
}

/// Confirmed with the person: mirrors the real backend's own
/// appliedPromoDetails shape exactly -- type is one of 'percentage',
/// 'flat', or 'free_shipping' (see services/api's own promo_codes
/// CHECK constraint).
class PromoDetails {
  final String code;
  final String type;
  final double? value;

  const PromoDetails({required this.code, required this.type, this.value});

  factory PromoDetails.fromJson(Map<String, dynamic> json) => PromoDetails(
        code: json['code'] as String,
        type: json['type'] as String,
        value: (json['value'] as num?)?.toDouble(),
      );
}
