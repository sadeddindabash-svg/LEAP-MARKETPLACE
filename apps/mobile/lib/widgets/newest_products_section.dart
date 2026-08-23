import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'product_card.dart';

/// Real, general "newest products" section -- reuses the exact same
/// real fetchProducts(sort: 'newest') call already used by Home's own
/// Newest feed, confirmed directly with the person as deliberately
/// unfiltered (not scoped to this product's own model/brand, unlike
/// SameModelSection/SameBrandSection above it). Excludes the current
/// real product itself from the results, since it could otherwise
/// appear among "newest" on its own page.
class NewestProductsSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const NewestProductsSection({super.key, required this.productId, required this.isAr});

  @override
  State<NewestProductsSection> createState() => _NewestProductsSectionState();
}

class _NewestProductsSectionState extends State<NewestProductsSection> {
  Future<List<Product>>? _future;
  String? _loadedForProductId;

  @override
  Widget build(BuildContext context) {
    if (_loadedForProductId != widget.productId) {
      _loadedForProductId = widget.productId;
      _future = ApiClient().fetchProducts(sort: 'newest', lang: widget.isAr ? 'ar' : 'en', limit: 11);
    }
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snapshot) {
        final products = (snapshot.data ?? []).where((p) => p.id != widget.productId).toList();
        if (snapshot.connectionState != ConnectionState.done || products.isEmpty) {
          return const SizedBox.shrink();
        }
        final palette = LeapPalette.of(context);
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.isAr ? 'أحدث المنتجات' : 'Newest products',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: productCardHeightFor(150),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: products.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final p = products[i];
                    return SizedBox(
                      width: 150,
                      child: ProductCard(product: p, onTap: () => context.push('/product/${p.id}')),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
