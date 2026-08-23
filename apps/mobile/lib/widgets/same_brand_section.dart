import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import '../services/api_client.dart';
import 'product_card.dart';

/// Same real idea as SameModelSection, broadened to the whole real
/// vehicle brand -- the real backend already excludes anything shown
/// there, so these two real sections never show the same product
/// twice. Confirmed directly with the person via a written plan
/// first.
class SameBrandSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const SameBrandSection({super.key, required this.productId, required this.isAr});

  @override
  State<SameBrandSection> createState() => _SameBrandSectionState();
}

class _SameBrandSectionState extends State<SameBrandSection> {
  Future<List<Product>>? _future;
  String? _loadedForProductId;

  @override
  Widget build(BuildContext context) {
    if (_loadedForProductId != widget.productId) {
      _loadedForProductId = widget.productId;
      _future = ApiClient().fetchSameBrandProducts(widget.productId, lang: widget.isAr ? 'ar' : 'en');
    }
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snapshot) {
        final products = snapshot.data ?? [];
        if (snapshot.connectionState != ConnectionState.done || products.isEmpty) {
          return const SizedBox.shrink();
        }
        final palette = LeapPalette.of(context);
        final brandName = products.first.brand ?? '';
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.isAr ? 'المزيد من قطع $brandName' : 'More $brandName parts',
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
