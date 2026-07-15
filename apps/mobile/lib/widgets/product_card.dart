import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/app_strings.dart';
import '../core/cart_state.dart';
import '../models/product.dart';
import '../services/api_client.dart';

/// Real product card for feeds (home "Newest"/"My car", eventually
/// category/search lists too) — shows exactly what was asked for:
/// photo, product name, review stars, an add-to-cart button, stock
/// availability, and price. Add-to-cart calls the real cart endpoint
/// directly from the card (quantity 1), same as the product detail
/// screen's own add-to-cart, so a buyer doesn't have to open the full
/// product page just to add one unit.
class ProductCard extends StatefulWidget {
  final Product product;
  final VoidCallback onTap;
  const ProductCard({super.key, required this.product, required this.onTap});

  @override
  State<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<ProductCard> {
  bool _isAdding = false;

  Future<void> _addToCart() async {
    setState(() => _isAdding = true);
    try {
      await context.read<CartState>().addItem(widget.product.id, 1);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${trRead(context, 'added_to_cart')}: ${widget.product.name}'), duration: const Duration(seconds: 1)),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isAdding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final inStock = p.stockQuantity > 0;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: p.images.isNotEmpty
                      ? Image.network(
                          ApiClient.resolveMediaUrl(p.images.first),
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) => Container(
                            color: LeapColors.chalk,
                            child: const Icon(Icons.broken_image_outlined, color: LeapColors.muted),
                          ),
                        )
                      : Container(
                          color: LeapColors.chalk,
                          child: const Icon(Icons.album_outlined, color: LeapColors.ink),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        ...List.generate(5, (i) => Icon(
                              i < p.rating.round() ? Icons.star : Icons.star_border,
                              size: 13,
                              color: const Color(0xFFF5A623),
                            )),
                        const SizedBox(width: 4),
                        if (p.reviewCount > 0)
                          Text('(${p.reviewCount})', style: const TextStyle(fontSize: 10.5, color: LeapColors.muted)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      inStock ? tr(context, 'in_stock') : tr(context, 'out_of_stock'),
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: inStock ? LeapColors.gauge : Colors.red),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('\$${p.price.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: (inStock && !_isAdding) ? _addToCart : null,
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: inStock ? LeapColors.signal : LeapColors.line,
                      ),
                      child: _isAdding
                          ? const Padding(padding: EdgeInsets.all(7), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.add_shopping_cart, size: 16, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
