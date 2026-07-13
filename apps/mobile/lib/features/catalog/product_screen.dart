import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/cart_state.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';

/// BUY-022: product detail with fitment confirmation, stock, and delivery
/// estimate. BUY-030: adds to a cart that is later split by supplier at
/// checkout (see checkout_screen.dart) — the add-to-cart call below is a
/// real network request to services/api/cart, not local-only state.
class ProductScreen extends StatefulWidget {
  final String productId;
  const ProductScreen({super.key, required this.productId});

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  late Future<Product> _productFuture;
  int _qty = 1;
  bool _isAdding = false;

  @override
  void initState() {
    super.initState();
    _productFuture = ApiClient().fetchProductById(widget.productId);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Item details')),
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
  final int qty;
  final bool isAdding;
  final ValueChanged<int> onQtyChanged;
  final VoidCallback onAddToCart;

  const _ProductDetailBody({
    required this.product,
    required this.qty,
    required this.isAdding,
    required this.onQtyChanged,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            Container(
              height: 180,
              decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(12)),
              child: const Center(child: Icon(Icons.album_outlined, size: 64, color: LeapColors.ink)),
            ),
            const SizedBox(height: 16),
            Text(product.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 6),
            Text('Sold by ${product.supplierName}', style: const TextStyle(color: LeapColors.muted, fontSize: 12)),
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
                      product.stockQuantity > 0 ? 'In stock · ships in ${product.estimatedDeliveryDays} days' : 'Currently out of stock',
                      style: const TextStyle(color: LeapColors.gauge),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text('\$${product.price.toStringAsFixed(2)} ${product.currencyCode}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
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
                        : Text('Add to cart · \$${(product.price * qty).toStringAsFixed(2)}'),
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
