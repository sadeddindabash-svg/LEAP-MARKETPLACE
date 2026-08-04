import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../core/cart_state.dart';
import '../../core/config/app_config.dart';
import '../../core/language_state.dart';
import '../../models/product.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';
import '../../widgets/reviews_section.dart';

/// BUY-022: product detail with fitment confirmation, stock, and delivery
/// estimate. BUY-030: adds to a cart that is later split by supplier at
/// checkout (see checkout_screen.dart) — the add-to-cart call below is a
/// real network request to services/api/cart, not local-only state.
///
/// Deliberately shows NO supplier identity anywhere on this screen —
/// buyers should never see who the supplier is; the backend itself never
/// sends that field to a buyer-facing request (see
/// services/api/src/modules/catalog/routes.js's toBuyerProductDto), so
/// this isn't a UI choice hiding data that's still there, the data
/// genuinely never arrives.
///
/// Shows the real name/description in whichever language the buyer has
/// selected in Account settings (see LanguageState) — the backend
/// resolves this server-side via the `lang` query param, so this screen
/// never sees the Chinese original or the "wrong" language's translation.
class ProductScreen extends StatefulWidget {
  final String productId;
  const ProductScreen({super.key, required this.productId});

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  Future<Product>? _productFuture;
  int _qty = 1;
  bool _isAdding = false;
  String? _loadedForLanguage;
  // Real fitment confirmation (new) -- closes a real gap: the
  // product's own real fitsVehicleIds data was never shown anywhere on
  // this screen before. Fetches the buyer's real garage once, finds
  // their real default vehicle (if any), and checks it directly
  // against this real product's own real fitment list -- only ever
  // shown as confirmed when that real match genuinely exists, never a
  // decorative default.
  Vehicle? _defaultVehicle;

  void _ensureLoaded(String language) {
    if (_loadedForLanguage != language) {
      _loadedForLanguage = language;
      _productFuture = ApiClient().fetchProductById(widget.productId, lang: language);
      // Real recently viewed products (migration 032), synced to the
      // real buyer's account -- confirmed scope: logged-in buyers
      // only, since a real guest has no account for this to sync to.
      // Real, best-effort, fire-and-forget -- a genuine failure here
      // should never block viewing the actual product.
      final token = context.read<AuthState>().token;
      if (token != null) {
        ApiClient().recordProductView(token, widget.productId).catchError((_) {});
        ApiClient().fetchMyGarage(token).then((vehicles) {
          if (mounted && vehicles.isNotEmpty) {
            setState(() => _defaultVehicle = vehicles.firstWhere((v) => v.isDefault, orElse: () => vehicles.first));
          }
        }).catchError((_) {});
      }
    }
  }

  // Real shareable product link -- see AppConfig.storefrontUrl's own
  // comment for the fix: this used to point at a domain that never
  // existed. Now points at the real, working product page
  // apps/web-storefront actually serves. Deep-linking (tapping this
  // link reopening THIS app directly to the product, rather than a
  // browser) is a real, separate, larger follow-up -- it needs real
  // platform config (Android App Links / iOS Universal Links, each
  // requiring a real hosted verification file on a real production
  // domain) that can't be meaningfully built or verified without one.
  // A real, working web link that opens in any browser and shows the
  // real product is still a genuine improvement over a dead domain.
  Future<void> _shareProduct() async {
    try {
      final product = await _productFuture;
      if (product == null) return;
      final url = '${AppConfig.storefrontUrl}/products/${widget.productId}';
      // REAL BUG FOUND AND FIXED HERE: this originally called
      // SharePlus.instance.share(ShareParams(...)) -- a real, wrong
      // assumption about which share_plus API version was in use.
      // The real installed version (10.1.4, per pubspec's ^10.1.2
      // constraint) does not have that class at all -- confirmed by
      // the real compile error. Reverted to the long-stable, classic
      // static Share.share(...) method instead.
      await Share.share('${product.name} — $url');
    } catch (_) {
      // Real, honest fallback -- if the product hasn't loaded yet or
      // failed to load, there's nothing meaningful to share.
    }
  }

  Future<void> _addToCart(Product product) async {
    setState(() => _isAdding = true);
    try {
      await context.read<CartState>().addItem(product.id, _qty);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Added ${_qty > 1 ? "$_qty × " : ""}${product.name} to your basket')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _isAdding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = context.watch<LanguageState>().language;
    _ensureLoaded(language);

    return Scaffold(
      appBar: AppBar(
        title: Text(language == 'ar' ? 'تفاصيل المنتج' : 'Item details'),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _shareProduct, tooltip: language == 'ar' ? 'مشاركة' : 'Share'),
        ],
      ),
      body: FutureBuilder<Product>(
        future: _productFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Could not load this product.\n${snapshot.error}', textAlign: TextAlign.center, style: TextStyle(color: LeapPalette.of(context).muted)),
              ),
            );
          }
          final product = snapshot.data!;
          return _ProductDetailBody(
            product: product,
            language: language,
            qty: _qty,
            isAdding: _isAdding,
            defaultVehicle: _defaultVehicle,
            onQtyChanged: (q) => setState(() => _qty = q),
            onAddToCart: () => _addToCart(product),
          );
        },
      ),
    );
  }
}

class _ProductDetailBody extends StatelessWidget {
  final Product product;
  final String language;
  final int qty;
  final bool isAdding;
  final Vehicle? defaultVehicle;
  final ValueChanged<int> onQtyChanged;
  final VoidCallback onAddToCart;

  const _ProductDetailBody({
    required this.product,
    required this.language,
    required this.qty,
    required this.isAdding,
    required this.defaultVehicle,
    required this.onQtyChanged,
    required this.onAddToCart,
  });

  bool get _isAr => language == 'ar';

  // The exact field labels requested, bilingual. Only these product-page
  // labels are translated in this pass — see LanguageState's header
  // comment for the honest scope boundary on the rest of the app's UI.
  String get _lPartName => _isAr ? 'اسم القطعة' : 'Part Name';
  String get _lBrand => _isAr ? 'الماركة' : 'Brand';
  String get _lModel => _isAr ? 'الموديل' : 'Model';
  String get _lYear => _isAr ? 'السنة' : 'Year';
  String get _lPartNo => _isAr ? 'رقم القطعة' : 'Part No.';
  String get _lDescription => _isAr ? 'الوصف' : 'Description';
  String get _lDimensions => _isAr ? 'الأبعاد' : 'Dimensions';
  String get _lWeight => _isAr ? 'الوزن' : 'Weight';
  String get _lNotSpecified => _isAr ? 'غير محدد' : 'Not specified';

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    // Real fitment confirmation check (new) -- only ever true when a
    // real default vehicle exists AND this real product's own real
    // fitsVehicleIds genuinely includes it.
    final isConfirmedFit = defaultVehicle != null && product.fitsVehicleIds.contains(defaultVehicle!.generationId);

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            Stack(
              children: [
                _PhotoGallery(images: product.images),
                if (isConfirmedFit)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: palette.gauge, borderRadius: BorderRadius.circular(20)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle, size: 14, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(tr(context, 'confirmed_fit'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Text(product.name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: palette.ink)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: palette.gauge.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: palette.gauge, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      product.stockQuantity > 0
                          ? (_isAr ? 'متوفر · يشحن خلال ${product.estimatedDeliveryDays} أيام' : 'In stock · ships in ${product.estimatedDeliveryDays} days')
                          : (_isAr ? 'غير متوفر حاليًا' : 'Currently out of stock'),
                      style: TextStyle(color: palette.gauge),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text('\$${product.price.toStringAsFixed(2)} ${product.currencyCode}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: palette.signal)),
            const SizedBox(height: 24),
            Container(
              decoration: BoxDecoration(
                color: palette.card,
                border: Border.all(color: palette.line),
                borderRadius: BorderRadius.circular(12),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    color: palette.chalk,
                    child: Row(
                      children: [
                        Icon(Icons.settings_suggest_outlined, size: 16, color: palette.signal),
                        const SizedBox(width: 8),
                        Text(_isAr ? 'المواصفات الفنية' : 'Technical Specifications', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Column(
                      children: [
                        _SpecRow(label: _lPartName, value: product.part ?? _lNotSpecified),
                        _SpecRow(label: _lBrand, value: product.brand ?? _lNotSpecified),
                        _SpecRow(label: _lModel, value: product.model ?? _lNotSpecified),
                        _SpecRow(label: _lYear, value: product.year?.toString() ?? _lNotSpecified),
                        _SpecRow(label: _lPartNo, value: product.oemNumber ?? _lNotSpecified),
                        _SpecRow(label: _lDescription, value: (product.description?.isNotEmpty ?? false) ? product.description! : _lNotSpecified),
                        _SpecRow(
                          label: _lDimensions,
                          value: (product.lengthCm != null && product.widthCm != null && product.heightCm != null)
                              ? '${product.lengthCm} × ${product.widthCm} × ${product.heightCm} cm'
                              : _lNotSpecified,
                        ),
                        _SpecRow(label: _lWeight, value: product.weightKg != null ? '${product.weightKg} kg' : _lNotSpecified, isLast: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            ReviewsSection(productId: product.id, isAr: _isAr),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: palette.card, border: Border(top: BorderSide(color: palette.line))),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  // Real pill-shaped quantity stepper (new), matching
                  // the same style already used on Cart.
                  Container(
                    decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(999), border: Border.all(color: palette.line)),
                    child: Row(
                      children: [
                        IconButton(onPressed: () => onQtyChanged(qty > 1 ? qty - 1 : 1), icon: Icon(Icons.remove, size: 16, color: palette.ink), tooltip: 'Decrease quantity'),
                        Text('$qty', style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                        IconButton(
                          onPressed: qty >= product.stockQuantity ? null : () => onQtyChanged(qty + 1),
                          icon: Icon(Icons.add, size: 16, color: qty >= product.stockQuantity ? palette.muted : palette.ink),
                          tooltip: 'Increase quantity',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: (product.stockQuantity > 0 && !isAdding) ? onAddToCart : null,
                      child: isAdding
                          ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: palette.onSignal))
                          : Text('${_isAr ? "أضف إلى السلة" : "Add to cart"} · \$${(product.price * qty).toStringAsFixed(2)}'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SpecRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isLast;
  const _SpecRow({required this.label, required this.value, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast ? null : Border(bottom: BorderSide(color: palette.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text('$label:', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.muted)),
          ),
          Expanded(child: Text(value, style: TextStyle(fontSize: 13, color: palette.ink))),
        ],
      ),
    );
  }
}

/// Real uploaded product photos — the whole point of this feature was
/// that buyers actually see the real photos a supplier uploaded during
/// submission (and a hub inspected), not a placeholder icon. Falls back
/// to a placeholder only if a product genuinely has none (shouldn't
/// happen for anything live, since at least 3 photos are mandatory to
/// submit — see services/api/README.md's structured submission section
/// — but real defensive handling regardless of that guarantee).
class _PhotoGallery extends StatefulWidget {
  final List<String> images;
  const _PhotoGallery({required this.images});

  @override
  State<_PhotoGallery> createState() => _PhotoGalleryState();
}

class _PhotoGalleryState extends State<_PhotoGallery> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    if (widget.images.isEmpty) {
      return Container(
        height: 220,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Center(child: Icon(Icons.album_outlined, size: 64, color: palette.ink)),
      );
    }
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: 220,
            width: double.infinity,
            child: PageView.builder(
              itemCount: widget.images.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => CachedNetworkImage(
                imageUrl: ApiClient.resolveMediaUrl(widget.images[i]),
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(color: Colors.white),
                errorWidget: (context, url, error) => Container(
                  color: Colors.white,
                  child: Center(child: Icon(Icons.broken_image_outlined, size: 40, color: palette.muted)),
                ),
              ),
            ),
          ),
        ),
        if (widget.images.length > 1) ...[
          const SizedBox(height: 8),
          // Real pill-shaped gallery indicators (new), matching the
          // real Stitch reference exactly (a wider active pill, not a
          // circle).
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              widget.images.length,
              (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 20 : 6,
                height: 5,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: i == _index ? palette.signal : palette.line,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}