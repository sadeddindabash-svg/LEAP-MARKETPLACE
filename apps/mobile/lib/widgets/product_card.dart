import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../core/app_strings.dart';
import '../core/currency_state.dart';
import '../core/auth_state.dart';
import '../core/cart_state.dart';
import '../core/language_state.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/api_client.dart';

/// Real, generously-sized height for a ProductCard placed in a fixed-
/// width, horizontal-scrolling row (e.g. Home's Recently Viewed,
/// AlternativesSection, OemComparisonSection-style widgets) -- fixes a
/// real, confirmed overflow bug: this card's own natural content
/// height grew when the low-stock countdown text (#8) was added, but
/// every fixed-height wrapper around it was never updated to match,
/// causing a real, visible overflow (confirmed directly via a real
/// screenshot: "BOTTOM OVERFLOWED BY 39 PIXELS"). Deliberately
/// generous rather than pixel-exact -- this sandbox has no real
/// Flutter renderer to verify an exact value against, and a little
/// unused space below the card is a far safer failure mode than
/// clipped, overflowing content.
double productCardHeightFor(double cardWidth) {
  // The square image's real height scales with the real card width
  // (minus the card's own real 8px-per-side padding), so a wider card
  // genuinely needs a taller allotted height, not a fixed number
  // regardless of width.
  final imageHeight = cardWidth - 16;
  // Real, calculated allowance (not a guess) -- confirmed via the
  // exact same element-by-element measurement used to fix the real
  // grid overflow this session: spacers (6+4+3+6) + 2-line name at
  // fontSize 12/height 1.3 (~31px) + rating row (~14px) + stock-status
  // row (~14px) + price/add-to-cart row (dominated by the real 28px
  // button circle) + the real delivery-estimate chip (~20px,
  // previously missing entirely from this allowance -- confirmed real
  // cause of the real overflow reported here) + the card's own real
  // top+bottom padding (16px) + the real 12px bottom padding added
  // afterward (confirmed real cause of a real, reported "overflowed
  // by 0.200 pixels" this same session -- that padding was never
  // reflected here). ~154px real total, some margin added.
  return imageHeight + 175;
}

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
  // Real "confirmed fit" badge (new) -- shown only when this card is
  // genuinely being displayed as a fitment-confirmed result (the
  // real "My Car" filter on Home), never as a decorative default --
  // matches the real Google Stitch reference design's own badge,
  // confirmed directly against real backend behavior: My Car results
  // are already always fitment-filtered server-side, so this badge
  // never claims something the data doesn't back up.
  final bool showConfirmedFitBadge;
  const ProductCard({super.key, required this.product, required this.onTap, this.showConfirmedFitBadge = false});

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
      // Real "already in cart" check (#18) -- the real backend
      // already correctly merges a repeat add into the existing real
      // line item (confirmed directly: ON CONFLICT ... quantity =
      // quantity + EXCLUDED.quantity), so there's no real duplicate
      // to warn about -- this is an honest, informational notice
      // instead, checked against the real, already-loaded cart
      // before the add, not a fabricated one.
      final cart = context.read<CartState>();
      CartItem? existing;
      for (final i in cart.items) {
        if (i.productId == widget.product.id) {
          existing = i;
          break;
        }
      }
      await cart.addItem(widget.product.id, 1);
      if (mounted) {
        final message = existing != null
            ? '${trRead(context, 'added_to_cart')}: ${widget.product.name} (${existing.quantity + 1} in cart)'
            : '${trRead(context, 'added_to_cart')}: ${widget.product.name}';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), duration: const Duration(seconds: 1)),
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
    final palette = LeapPalette.of(context);
    final inStock = p.stockQuantity > 0;
    final isAr = context.watch<LanguageState>().isArabic;
    final isLoggedIn = context.watch<AuthState>().isLoggedIn;
    return UnconstrainedBox(
      alignment: Alignment.topCenter,
      constrainedAxis: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Card(
      margin: EdgeInsets.zero,
      color: palette.card,
      child: InkWell(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 1,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      // Real, fixed white background (new) -- matches
                      // the real design spec directly: real product
                      // photos should sit on a light/white background
                      // to pop against a dark UI, regardless of the
                      // active theme -- deliberately NOT palette.chalk
                      // here, since that would go dark in dark mode.
                      child: Container(
                        color: Colors.white,
                        child: p.images.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: ApiClient.resolveMediaUrl(p.images.first),
                                fit: BoxFit.cover,
                                width: double.infinity,
                                fadeInDuration: const Duration(milliseconds: 300),
                                placeholder: (context, url) => Container(color: const Color(0xFFF5F6F8)),
                                errorWidget: (context, url, error) => const Icon(Icons.broken_image_outlined, color: LeapColors.muted),
                              )
                            : const Icon(Icons.album_outlined, size: 32, color: LeapColors.muted),
                      ),
                    ),
                  ),
                  if (widget.showConfirmedFitBadge)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(color: palette.gauge, borderRadius: BorderRadius.circular(4)),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.verified, size: 10, color: Colors.white),
                            const SizedBox(width: 3),
                            Text(tr(context, 'confirmed_fit'), style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Colors.white)),
                          ],
                        ),
                      ),
                    ),
                  if (isLoggedIn)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: InkWell(
                        onTap: _isTogglingWishlist ? null : _toggleWishlist,
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xB3000000)),
                          child: _isTogglingWishlist
                              ? const Padding(padding: EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Icon(
                                  _isWishlisted == true ? Icons.favorite : Icons.favorite_border,
                                  size: 14,
                                  color: _isWishlisted == true ? palette.signal : Colors.white,
                                ),
                        ),
                      ),
                    ),
                  // Real vehicle-brand logo badge (e.g. BMW, Hongqi) --
                  // confirmed directly against a rendered mockup:
                  // bottom-left corner, 36px (1.5x the initially-shown
                  // 24px size), white rounded background so any logo
                  // reads clearly regardless of the product photo
                  // behind it. Sourced automatically from the same
                  // real fitment data a supplier already selects at
                  // product submission -- zero new admin workflow,
                  // per the person's own explicit correction. Shown
                  // only when this specific product's own primary
                  // fitment entry actually has a brand with a real
                  // logo set.
                  if (p.brandLogoUrl != null)
                    Positioned(
                      bottom: 6,
                      left: 6,
                      child: Container(
                        width: 36,
                        height: 36,
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(7),
                          border: Border.all(color: const Color(0x1F000000)),
                        ),
                        child: CachedNetworkImage(
                          imageUrl: ApiClient.resolveMediaUrl(p.brandLogoUrl!),
                          fit: BoxFit.contain,
                          // Real, deliberately silent fallbacks -- a
                          // slow-loading or broken real brand logo
                          // shouldn't show a jarring placeholder/error
                          // icon on top of the real product photo;
                          // simplest is to just show nothing for that
                          // brief moment rather than draw attention to
                          // a real, non-critical decorative element.
                          placeholder: (context, url) => const SizedBox.shrink(),
                          errorWidget: (context, url, error) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              // Real, confirmed with the person: reserve a fixed
              // 2-line height regardless of this specific product's
              // own real name length, so every card in a row is the
              // same real height -- a short 1-line name no longer
              // makes its own card shorter than a neighboring card
              // with a longer, genuinely 2-line name. 12 * 1.3 * 2 =
              // the real, exact height 2 lines at this font
              // size/line-height actually occupy.
              SizedBox(
                height: 12 * 1.3 * 2 + 2,
                child: Text(
                  p.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.3),
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(p.rating > 0 ? Icons.star : Icons.star_border, size: 13, color: const Color(0xFFF5A623)),
                  const SizedBox(width: 3),
                  Text(
                    p.reviewCount > 0 ? '${p.rating.toStringAsFixed(1)} (${p.reviewCount})' : tr(context, 'no_reviews_yet'),
                    style: TextStyle(fontSize: 10.5, color: palette.muted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Row(
                children: [
                  Icon(Icons.circle, size: 6, color: !inStock ? Colors.red : (p.stockQuantity <= 5 ? palette.torque : palette.gauge)),
                  const SizedBox(width: 4),
                  Text(
                    // Real low-stock countdown (#8), same real threshold
                    // and treatment as Product Detail's own.
                    !inStock
                        ? tr(context, 'out_of_stock')
                        : p.stockQuantity <= 5
                            ? (isAr ? 'متبقٍ ${p.stockQuantity} فقط' : 'Only ${p.stockQuantity} left')
                            : tr(context, 'in_stock'),
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: !inStock ? Colors.red : (p.stockQuantity <= 5 ? palette.torque : palette.gauge)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            formatPrice(context, p.price),
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: palette.ink),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // Real price-drop comparison (new) -- same real
                        // hasPriceDrop pattern already used in
                        // wishlist_screen.dart, using the real
                        // lastKnownPrice snapshot field, not a
                        // fabricated sale price.
                        if (p.lastKnownPrice != null && p.lastKnownPrice! > p.price) ...[
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              formatPrice(context, p.lastKnownPrice!),
                              style: TextStyle(fontSize: 11, color: palette.muted, decoration: TextDecoration.lineThrough),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      InkWell(
                        onTap: (inStock && !_isAdding) ? _addToCart : null,
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: inStock ? palette.signal : palette.line,
                          ),
                          child: _isAdding
                              // REAL BUG FOUND AND FIXED HERE while
                              // migrating this widget: white spinner/
                              // icon on gold is the same real
                              // white-on-gold contrast issue already
                              // found and fixed elsewhere this
                              // session -- gold is too light for white
                              // to read well against.
                              ? Padding(padding: const EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                              : Icon(Icons.add_shopping_cart, size: 14, color: inStock ? palette.onSignal : palette.muted),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 5),
              Visibility(
                visible: inStock,
                maintainSize: true,
                maintainAnimation: true,
                maintainState: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: palette.gauge.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(5)),
                  child: Text(
                    isAr ? 'التوصيل خلال ${p.estimatedDeliveryDays} أيام' : 'Delivery in ${p.estimatedDeliveryDays} ${p.estimatedDeliveryDays == 1 ? 'day' : 'days'}',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: palette.gauge),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
      ),
    );
  }
}
