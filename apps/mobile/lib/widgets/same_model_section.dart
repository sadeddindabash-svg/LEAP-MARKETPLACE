import 'package:flutter/material.dart';
import '../services/api_client.dart';
import 'lazy_product_grid.dart';

/// Real "more parts for your car" cross-sell -- other real products
/// fitting the SAME real vehicle model this product fits, confirmed
/// directly with the person via a written plan first as genuinely
/// distinct from AlternativesSection (same part, different supplier)
/// -- this is different parts, same real car. Rendered as a real
/// 2-column, lazy-loading vertical grid (confirmed via a rendered
/// mockup), not a horizontal carousel.
class SameModelSection extends StatelessWidget {
  final String productId;
  final bool isAr;
  const SameModelSection({super.key, required this.productId, required this.isAr});

  @override
  Widget build(BuildContext context) {
    return LazyProductGrid(
      fetchPage: (page) async {
        final items = await ApiClient().fetchSameModelProducts(productId, lang: isAr ? 'ar' : 'en', page: page);
        return (items: items, hasMore: items.length >= 10);
      },
      buildHeader: (loaded) {
        final modelName = loaded.first.model ?? '';
        return isAr ? 'المزيد لـ $modelName' : 'More for $modelName';
      },
    );
  }
}
