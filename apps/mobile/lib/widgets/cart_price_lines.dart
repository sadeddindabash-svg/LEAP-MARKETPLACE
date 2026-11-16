import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/app_strings.dart';
import '../core/currency_state.dart';
import '../models/cart_item.dart';

/// The price lines of one basket part during a checkout hold (Pricing > Discount rules > Rules): "1 × $90 held price",
/// "1 × $100 added later · today's price", and "price dropped" when a price went down during the hold. Light and dark mode.
class CartPriceLines extends StatelessWidget {
  final CartItem item;
  final bool compact;
  const CartPriceLines({super.key, required this.item, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final size = compact ? 11.0 : 11.5;
    Widget tag(String text, Color bg, Color fg) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(5)),
          child: Text(text, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: fg)),
        );
    return Padding(
      padding: EdgeInsets.only(top: compact ? 2 : 4),
      child: Column(
        key: const Key('cart-price-lines'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final l in item.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Wrap(
                spacing: 6,
                runSpacing: 2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('${l.quantity} × ${formatPrice(context, l.price)}', style: TextStyle(fontSize: size, fontWeight: FontWeight.w700)),
                  if (l.originalPrice != null && !compact)
                    Text(formatPrice(context, l.originalPrice!), style: TextStyle(fontSize: size, color: palette.muted, decoration: TextDecoration.lineThrough)),
                  l.isNew
                      ? tag(tr(context, 'cart_line_new'), dark ? const Color(0xFF1D3F73) : const Color(0xFFE8EEF7), dark ? const Color(0xFFD6E2F5) : const Color(0xFF1D3F73))
                      : tag(tr(context, 'cart_line_held'), dark ? const Color(0xFF5C4300) : const Color(0xFFFFF4D6), dark ? const Color(0xFFFFE3A3) : const Color(0xFF8A5A00)),
                  if (l.lowered) tag(tr(context, 'cart_line_lowered'), dark ? const Color(0xFF14532D) : const Color(0xFFE3F6EA), dark ? const Color(0xFFBBF7D0) : const Color(0xFF17663A)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
