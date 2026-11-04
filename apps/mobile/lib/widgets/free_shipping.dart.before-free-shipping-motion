import 'package:flutter/material.dart';
import '../core/app_strings.dart';
import '../core/currency_state.dart';
import '../core/theme.dart';
import '../models/cart_shipping.dart';

/// Free shipping above a limit, three small pieces (the same as on the website). Each draws nothing when the rule is off or the server sent nothing.
///   ShippingFeeRow        a line of the order summary: "Shipping fees +$5" under the limit; at or above it the fee is struck through and says "Free"
///   FreeShippingHint      a note with a progress bar: "Add $30 more for free shipping"; "You've reached $50: shipping is free"; or "Free shipping with your promo code"
///   FreeShippingBadgeOver puts a green "Free shipping" pill over the corner of the Checkout button once shipping is free
const Color _green = Color(0xFF1E9D6B);

String _withAmount(BuildContext context, String key, double usd) => tr(context, key).replaceAll('{amount}', formatPrice(context, usd));

class ShippingFeeRow extends StatelessWidget {
  final CartShipping shipping;
  final EdgeInsetsGeometry padding;
  const ShippingFeeRow({super.key, required this.shipping, this.padding = const EdgeInsets.fromLTRB(14, 0, 14, 10)});

  @override
  Widget build(BuildContext context) {
    if (!shipping.enabled) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    final free = shipping.chargedUsd == 0;
    return Padding(
      padding: padding,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(tr(context, 'shipping_fees'), style: TextStyle(color: palette.muted, fontSize: 13)),
          if (free)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(formatPrice(context, shipping.feeUsd), style: TextStyle(color: palette.muted, fontSize: 13, decoration: TextDecoration.lineThrough)),
                const SizedBox(width: 6),
                Text(tr(context, 'shipping_free'), style: const TextStyle(color: _green, fontSize: 13, fontWeight: FontWeight.w700)),
              ],
            )
          else
            Text('+${formatPrice(context, shipping.chargedUsd)}', style: TextStyle(color: palette.ink, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class FreeShippingHint extends StatelessWidget {
  final CartShipping shipping;
  final EdgeInsetsGeometry margin;
  const FreeShippingHint({super.key, required this.shipping, this.margin = const EdgeInsets.fromLTRB(14, 0, 14, 14)});

  @override
  Widget build(BuildContext context) {
    if (!shipping.enabled) return const SizedBox.shrink();
    final done = shipping.waivedByPromo || shipping.qualifies;
    final text = shipping.waivedByPromo ? tr(context, 'shipping_promo_free') : (shipping.qualifies ? _withAmount(context, 'shipping_reached', shipping.thresholdUsd) : _withAmount(context, 'shipping_add_more', shipping.remainingUsd));
    final Color fg = done ? const Color(0xFF177A53) : const Color(0xFF8A5410);
    return Container(
      margin: margin,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: done ? const Color(0xFFE3F4EC) : const Color(0xFFFFF4E5),
        border: Border.all(color: done ? const Color(0xFFB7E0CD) : const Color(0xFFF3D3A4)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.local_shipping_outlined, size: 18, color: fg),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w600)),
                if (!done) ...[
                  const SizedBox(height: 7),
                  Semantics(
                    label: tr(context, 'shipping_fees'),
                    value: '${(shipping.progress * 100).round()}%',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(value: shipping.progress, minHeight: 6, backgroundColor: const Color(0xFFF1DDBD), color: _green),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class FreeShippingBadgeOver extends StatelessWidget {
  final CartShipping shipping;
  final Widget child;
  const FreeShippingBadgeOver({super.key, required this.shipping, required this.child});

  @override
  Widget build(BuildContext context) {
    if (!shipping.isFree) return child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        // PositionedDirectional: the end corner, so it mirrors in Arabic.
        PositionedDirectional(
          top: -14,
          end: 14,
          child: IgnorePointer(
            child: Semantics(
              label: tr(context, 'shipping_free_badge'),
              excludeSemantics: true,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _green,
                  border: Border.all(color: Colors.white, width: 2),
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 6, offset: Offset(0, 2))],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.local_shipping_outlined, size: 14, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(tr(context, 'shipping_free_badge'), style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
