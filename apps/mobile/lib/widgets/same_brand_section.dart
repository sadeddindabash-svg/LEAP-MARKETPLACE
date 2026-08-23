import 'package:flutter/material.dart';
import '../services/api_client.dart';
import 'lazy_product_grid.dart';

/// Same real idea as SameModelSection, broadened to the whole real
/// vehicle brand -- the real backend already excludes anything shown
/// there, so these two real sections never show the same product
/// twice. Confirmed directly with the person via a written plan
/// first. Rendered as a real 2-column, lazy-loading vertical grid
/// (confirmed via a rendered mockup), not a horizontal carousel.
class SameBrandSection extends StatelessWidget {
  final String productId;
  final bool isAr;
  const SameBrandSection({super.key, required this.productId, required this.isAr});

  @override
  Widget build(BuildContext context) {
    return LazyProductGrid(
      fetchPage: (page) async {
        final items = await ApiClient().fetchSameBrandProducts(productId, lang: isAr ? 'ar' : 'en', page: page);
        return (items: items, hasMore: items.length >= 10);
      },
      buildHeader: (loaded) {
        final brandName = loaded.first.brand ?? '';
        return isAr ? 'المزيد من قطع $brandName' : 'More $brandName parts';
      },
    );
  }
}
