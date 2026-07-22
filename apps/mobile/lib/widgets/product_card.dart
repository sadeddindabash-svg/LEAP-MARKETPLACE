import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/app_strings.dart';
import '../core/auth_state.dart';
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
  bool? _isWishlisted; // null while unknown/loading; only checked for logged-in buyers
  bool _isTogglingWishlist = false;

  @override
  void initState() {
    super.initState();
    _checkWishlistState();
  }

  void _checkWishlistState() {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    ApiClient().isWishlisted(token, widget.product.id).then((wishlisted) {
      if (mounted) setState(() => _isWishlisted = wishlisted);
    }).catchError((_) {}); // non-critical -- the heart just stays unfilled if this fails
  }

  Future<void> _toggleWishlist() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() => _isTogglingWishlist = true);
    try {
      if (_isWishlisted == true) {
        await ApiClient().removeFromWishlist(token, widget.product.id);
        if (mounted) setState(() => _isWishlisted = false);
      } else {
        await ApiClient().addToWishlist(token, widget.product.id);
        if (mounted) setState(() => _isWishlisted = true);
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _isTogglingWishlist = false);
    }
  }

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
    final isLoggedIn = context.watch<AuthState>().isLoggedIn;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: p.images.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: ApiClient.resolveMediaUrl(p.images.first),
                          fit: BoxFit.cover,
                          width: double.infinity,
                          placeholder: (context, url) => Container(color: LeapColors.chalk),
                          errorWidget: (context, url, error) => Container(
                            color: LeapColors.chalk,
                            child: const Icon(Icons.broken_image_outlined, color: LeapColors.muted),
                          ),
                        )
                      : Container(
                          color: LeapColors.chalk,
                          child: const Icon(Icons.album_outlined, size: 32, color: LeapColors.muted),
                        ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                p.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.3),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(p.rating > 0 ? Icons.star : Icons.star_border, size: 13, color: const Color(0xFFF5A623)),
                  const SizedBox(width: 3),
                  Text(
                    p.reviewCount > 0 ? '${p.rating.toStringAsFixed(1)} (${p.reviewCount})' : tr(context, 'no_reviews_yet'),
                    style: const TextStyle(fontSize: 10.5, color: LeapColors.muted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                inStock ? tr(context, 'in_stock') : tr(context, 'out_of_stock'),
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: inStock ? LeapColors.gauge : Colors.red),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      '\$${p.price.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isLoggedIn) ...[
                        InkWell(
                          onTap: _isTogglingWishlist ? null : _toggleWishlist,
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: LeapColors.line),
                            ),
                            child: _isTogglingWishlist
                                ? const Padding(padding: EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2))
                                : Icon(
                                    _isWishlisted == true ? Icons.favorite : Icons.favorite_border,
                                    size: 15,
                                    color: _isWishlisted == true ? LeapColors.signal : LeapColors.muted,
                                  ),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      InkWell(
                        onTap: (inStock && !_isAdding) ? _addToCart : null,
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: inStock ? LeapColors.signal : LeapColors.line,
                          ),
                          child: _isAdding
                              ? const Padding(padding: EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Icon(Icons.add_shopping_cart, size: 14, color: inStock ? Colors.white : LeapColors.muted),
                        ),
                      ),
                    ],
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
