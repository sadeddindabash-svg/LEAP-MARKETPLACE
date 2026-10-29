import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_strings.dart';
import '../core/cart_state.dart';
import '../core/theme.dart';

/// On the cart screen, after signing in: this device's basket was combined with the account basket (one cart per account): how many items were added, which quantity was lowered for stock, what could not be added.
/// Shown once, until dismissed; nothing at all when nothing was combined.
class CartMergeBanner extends StatelessWidget {
  const CartMergeBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final notice = context.watch<CartState>().mergeNotice;
    if (notice == null) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    final added = notice.itemsAdded + notice.itemsCombined;
    final lines = <String>[
      if (added > 0) (added == 1 ? tr(context, 'cart_merged_added_one') : tr(context, 'cart_merged_added_many').replaceAll('{n}', '$added')),
      for (final r in notice.reduced) tr(context, 'cart_merged_reduced').replaceAll('{name}', r.name).replaceAll('{to}', '${r.to}'),
      for (final d in notice.dropped) tr(context, 'cart_merged_dropped').replaceAll('{name}', d.name),
    ];
    return Container(
      key: const Key('cart-merge-banner'),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 4, 10),
      decoration: BoxDecoration(
        color: palette.gauge.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: palette.gauge.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, 'cart_merged_title'), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: palette.ink)),
                for (final line in lines) Padding(padding: const EdgeInsets.only(top: 2), child: Text(line, style: TextStyle(fontSize: 12.5, color: palette.ink))),
              ],
            ),
          ),
          IconButton(
            key: const Key('cart-merge-dismiss'),
            tooltip: tr(context, 'cart_merged_dismiss'),
            icon: Icon(Icons.close, size: 18, color: palette.muted),
            onPressed: () => context.read<CartState>().dismissMergeNotice(),
          ),
        ],
      ),
    );
  }
}
