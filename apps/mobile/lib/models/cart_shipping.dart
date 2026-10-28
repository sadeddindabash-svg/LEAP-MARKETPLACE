/// The shipping fee of a cart: free shipping above a limit (the admin sets the limit and the fee; the server works it out and sends it with every cart answer as `shipping`).
/// Plain Dart (no Flutter), so it is tested without a device. With the rule off, or a server that sends nothing, this is [CartShipping.off]: no fee, nothing to show.
///   chargedUsd     the fee to pay now: the fee when the goods are under the limit, otherwise 0 (also 0 with a free-shipping promo code)
///   remainingUsd   how much more goods the buyer needs for free shipping (0 once the limit is reached)
///   qualifies      the goods have reached the limit
///   waivedByPromo  a free-shipping promo code is applied
class CartShipping {
  final bool enabled;
  final double thresholdUsd;
  final double feeUsd;
  final double chargedUsd;
  final double remainingUsd;
  final bool qualifies;
  final bool waivedByPromo;

  const CartShipping({
    required this.enabled,
    required this.thresholdUsd,
    required this.feeUsd,
    required this.chargedUsd,
    required this.remainingUsd,
    required this.qualifies,
    required this.waivedByPromo,
  });

  /// The rule is off: no fee is ever charged.
  static const CartShipping off = CartShipping(enabled: false, thresholdUsd: 0, feeUsd: 0, chargedUsd: 0, remainingUsd: 0, qualifies: true, waivedByPromo: false);

  /// Reads the server's `shipping` answer. Anything missing, damaged or switched off gives [off]; an amount that is not a sensible number counts as 0.
  factory CartShipping.fromJson(Object? json) {
    if (json is! Map || json['enabled'] != true) return off;
    double amount(Object? v) {
      final d = v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
      return d != null && d.isFinite && d >= 0 ? d : 0;
    }

    return CartShipping(
      enabled: true,
      thresholdUsd: amount(json['thresholdUsd']),
      feeUsd: amount(json['feeUsd']),
      chargedUsd: amount(json['chargedUsd']),
      remainingUsd: amount(json['remainingUsd']),
      qualifies: json['qualifies'] == true,
      waivedByPromo: json['waivedByPromo'] == true,
    );
  }

  /// Shipping is free now (the limit is reached, or a promo code waives it): the "Free shipping" icon over Checkout is shown.
  bool get isFree => enabled && chargedUsd == 0 && (qualifies || waivedByPromo);

  /// The shipping fee the buyer does NOT pay because shipping is free (the limit was reached, or a promo code waives it): what "You saved" adds to the discounts. 0 when a fee is charged, the rule is off, or there was no fee to pay.
  double get savedUsd => enabled && chargedUsd == 0 && feeUsd > 0 && (qualifies || waivedByPromo) ? feeUsd : 0;

  /// How far the goods are towards the limit, from 0 to 1 (the progress bar).
  double get progress {
    if (!enabled || thresholdUsd <= 0) return 0;
    final p = (thresholdUsd - remainingUsd) / thresholdUsd;
    if (!p.isFinite) return 0;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }

  /// What the buyer pays for goods of this value: the goods plus the fee.
  double totalWith(double goodsUsd) => goodsUsd + (enabled ? chargedUsd : 0);
}
