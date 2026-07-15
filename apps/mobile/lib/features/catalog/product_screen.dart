import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/cart_state.dart';
import '../../core/language_state.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';

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

  void _ensureLoaded(String language) {
    if (_loadedForLanguage != language) {
      _loadedForLanguage = language;
      _productFuture = ApiClient().fetchProductById(widget.productId, lang: language);
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
      appBar: AppBar(title: Text(language == 'ar' ? 'تفاصيل المنتج' : 'Item details')),
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
                child: Text('Could not load this product.\n${snapshot.error}', textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
              ),
            );
          }
          final product = snapshot.data!;
          return _ProductDetailBody(
            product: product,
            language: language,
            qty: _qty,
            isAdding: _isAdding,
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
  final ValueChanged<int> onQtyChanged;
  final VoidCallback onAddToCart;

  const _ProductDetailBody({
    required this.product,
    required this.language,
    required this.qty,
    required this.isAdding,
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
    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            _PhotoGallery(images: product.images),
            const SizedBox(height: 16),
            Text(product.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFE4F5EC), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: LeapColors.gauge, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      product.stockQuantity > 0
                          ? (_isAr ? 'متوفر · يشحن خلال ${product.estimatedDeliveryDays} أيام' : 'In stock · ships in ${product.estimatedDeliveryDays} days')
                          : (_isAr ? 'غير متوفر حاليًا' : 'Currently out of stock'),
                      style: const TextStyle(color: LeapColors.gauge),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text('\$${product.price.toStringAsFixed(2)} ${product.currencyCode}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: LeapColors.line))),
            child: Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(8)),
                  child: Row(
                    children: [
                      IconButton(onPressed: () => onQtyChanged(qty > 1 ? qty - 1 : 1), icon: const Icon(Icons.remove, size: 16)),
                      Text('$qty', style: const TextStyle(fontWeight: FontWeight.w700)),
                      IconButton(onPressed: () => onQtyChanged(qty + 1), icon: const Icon(Icons.add, size: 16)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: (product.stockQuantity > 0 && !isAdding) ? onAddToCart : null,
                    child: isAdding
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('${_isAr ? "أضف إلى السلة" : "Add to cart"} · \$${(product.price * qty).toStringAsFixed(2)}'),
                  ),
                ),
              ],
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
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast ? null : const Border(bottom: BorderSide(color: LeapColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: LeapColors.muted)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
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
    if (widget.images.isEmpty) {
      return Container(
        height: 220,
        decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(12)),
        child: const Center(child: Icon(Icons.album_outlined, size: 64, color: LeapColors.ink)),
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
              itemBuilder: (context, i) => Image.network(
                ApiClient.resolveMediaUrl(widget.images[i]),
                fit: BoxFit.cover,
                errorBuilder: (context, error, stack) => Container(
                  color: LeapColors.chalk,
                  child: const Center(child: Icon(Icons.broken_image_outlined, size: 40, color: LeapColors.muted)),
                ),
              ),
            ),
          ),
        ),
        if (widget.images.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              widget.images.length,
              (i) => Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i == _index ? LeapColors.signal : LeapColors.line,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
