import 'package:flutter/material.dart';
import '../services/api_client.dart';
import 'lazy_product_grid.dart';

/// Real, general "newest products" section -- reuses the exact same
/// real fetchProducts(sort: 'newest') call already used by Home's own
/// Newest feed, confirmed directly with the person as deliberately
/// unfiltered (not scoped to this product's own model/brand, unlike
/// AlternativesSection/SameBrandSection above it). Excludes the current
/// real product itself from each real page's results, since it could
/// otherwise appear among "newest" on its own page. Rendered as a
/// real 2-column, lazy-loading vertical grid (confirmed via a
/// rendered mockup), not a horizontal carousel.
///
/// Real bug caught and fixed before testing: hasMore is computed from
/// the RAW backend page length (before filtering out the current
/// product), not the post-filter count -- filtering could otherwise
/// shrink a full real page of 10 down to 9, incorrectly signaling "no
/// more pages" when more genuinely exist on the backend.
class NewestProductsSection extends StatelessWidget {
  final String productId;
  final bool isAr;
  const NewestProductsSection({super.key, required this.productId, required this.isAr});

  @override
  Widget build(BuildContext context) {
    return LazyProductGrid(
      fetchPage: (page) async {
        final rawResults = await ApiClient().fetchProducts(sort: 'newest', lang: isAr ? 'ar' : 'en', limit: 10, page: page);
        final filtered = rawResults.where((p) => p.id != productId).toList();
        return (items: filtered, hasMore: rawResults.length >= 10);
      },
      buildHeader: (loaded) => isAr ? 'أحدث المنتجات' : 'Newest products',
    );
  }
}
