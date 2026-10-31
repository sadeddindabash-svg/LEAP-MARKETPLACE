import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

/// Shown instead of a product that the admin DELETED (the server answers 410 "This product is no longer available", migration 119):
/// a buyer can still reach it from an old order, a notification or a shared link. Arabic or English.
class ProductGoneView extends StatelessWidget {
  final String language;
  const ProductGoneView({super.key, required this.language});

  /// True when loading the product failed because it was deleted.
  static bool isGone(Object? error) {
    final text = '$error'.toLowerCase();
    return text.contains('no longer available') || text.contains('product_deleted') || text.contains('410');
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final ar = language == 'ar';
    return Center(
      child: Padding(
        key: const ValueKey('product-gone'),
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(color: palette.muted.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
              child: Icon(Icons.block, size: 40, color: palette.muted),
            ),
            const SizedBox(height: 16),
            Text(
              ar ? 'هذا المنتج لم يعد متوفراً' : 'This product is no longer available',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: palette.ink),
            ),
            const SizedBox(height: 6),
            Text(
              ar ? 'تمت إزالته من LEAP. طلباتك السابقة لا تتأثر.' : 'It has been removed from LEAP. Your past orders are not affected.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: palette.muted),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => context.push('/search'),
              child: Text(ar ? 'ابحث عن قطعة مشابهة' : 'Find a similar part'),
            ),
            TextButton(
              onPressed: () => context.go('/orders'),
              child: Text(ar ? 'العودة إلى طلباتي' : 'Back to my orders'),
            ),
          ],
        ),
      ),
    );
  }
}
