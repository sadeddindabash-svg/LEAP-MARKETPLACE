import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'product_card.dart';

/// Real alternate/equivalent in-stock parts (#9) -- shown especially
/// valuable when this real product is out of stock, but genuinely
/// useful as a comparison aid regardless. Mirrors ReviewsSection's own
/// real self-fetching widget pattern.
class AlternativesSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const AlternativesSection({super.key, required this.productId, required this.isAr});

  @override
  State<AlternativesSection> createState() => _AlternativesSectionState();
}

class _AlternativesSectionState extends State<AlternativesSection> {
  Future<List<Product>>? _future;
  String? _loadedForProductId;

  @override
  Widget build(BuildContext context) {
    if (_loadedForProductId != widget.productId) {
      _loadedForProductId = widget.productId;
      _future = ApiClient().fetchProductAlternatives(widget.productId);
    }
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snapshot) {
        final alternatives = snapshot.data ?? [];
        // Real, deliberate empty-state handling: never shows a
        // section header with nothing real underneath it, whether
        // still loading, failed, or genuinely has zero real
        // alternatives.
        if (snapshot.connectionState != ConnectionState.done || alternatives.isEmpty) {
          return const SizedBox.shrink();
        }
        final palette = LeapPalette.of(context);
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.isAr ? 'قطع مماثلة متوفرة' : 'Similar parts in stock',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: productCardHeightFor(150),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: alternatives.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, i) {
                    final alt = alternatives[i];
                    return SizedBox(
                      width: 150,
                      child: ProductCard(product: alt, onTap: () => context.push('/product/${alt.id}')),
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
