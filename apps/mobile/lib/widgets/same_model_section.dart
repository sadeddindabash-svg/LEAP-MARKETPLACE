import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'product_card.dart';

/// Real "more parts for your car" cross-sell -- other real products
/// fitting the SAME real vehicle model this product fits, confirmed
/// directly with the person via a written plan first as genuinely
/// distinct from AlternativesSection (same part, different supplier)
/// -- this is different parts, same real car. Mirrors
/// AlternativesSection's own real self-fetching widget pattern.
class SameModelSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const SameModelSection({super.key, required this.productId, required this.isAr});

  @override
  State<SameModelSection> createState() => _SameModelSectionState();
}

class _SameModelSectionState extends State<SameModelSection> {
  Future<List<Product>>? _future;
  String? _loadedForProductId;

  @override
  Widget build(BuildContext context) {
    if (_loadedForProductId != widget.productId) {
      _loadedForProductId = widget.productId;
      _future = ApiClient().fetchSameModelProducts(widget.productId, lang: widget.isAr ? 'ar' : 'en');
    }
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snapshot) {
        final products = snapshot.data ?? [];
        // Real, deliberate empty-state handling -- confirmed directly
        // with the person: a product with no real fitment data at all
        // (or no other real products for that same model) simply
        // shows nothing here, matching AlternativesSection's own
        // established convention, not an explicit "nothing found"
        // message.
        if (snapshot.connectionState != ConnectionState.done || products.isEmpty) {
          return const SizedBox.shrink();
        }
        final palette = LeapPalette.of(context);
        final modelName = products.first.model ?? '';
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.isAr ? 'المزيد لـ $modelName' : 'More for $modelName',
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
