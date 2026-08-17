import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';
import '../../widgets/product_card.dart';
import '../../widgets/skeleton.dart';

/// Real wishlist — a buyer's saved products (see
/// services/api/src/modules/wishlist/routes.js). Reuses the same real
/// ProductCard used on the home feed, for consistency.
class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  Future<List<Product>>? _wishlistFuture;
  String? _loadedForLanguage;
  // Real compare mode (#101) -- lets a buyer select 2-4 real wishlist
  // items to compare side by side.
  bool _compareMode = false;
  final Set<String> _selectedForCompare = {};
  // Real fix for a real scope mistake: floatingActionButton sits at
  // the Scaffold's top level, but the real products list only exists
  // inside the nested FutureBuilder's own builder callback below --
  // this field is what the button actually reads instead.
  List<Product> _loadedProducts = [];

  void _ensureLoaded(String language, String? token) {
    if (_loadedForLanguage == language || token == null) return;
    _loadedForLanguage = language;
    _wishlistFuture = ApiClient().fetchWishlist(token, lang: language);
  }

  Future<void> _reload() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    final future = ApiClient().fetchWishlist(token, lang: context.read<LanguageState>().language);
    setState(() => _wishlistFuture = future);
    await future;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final language = context.watch<LanguageState>().language;
    _ensureLoaded(language, auth.token);

    return Scaffold(
      floatingActionButton: _compareMode && _selectedForCompare.length >= 2
          ? FloatingActionButton.extended(
              onPressed: () {
                final selected = _loadedProducts.where((p) => _selectedForCompare.contains(p.id)).toList();
                context.push('/compare-products', extra: selected);
              },
              icon: const Icon(Icons.compare_arrows),
              label: Text('${Localizations.localeOf(context).languageCode == 'ar' ? 'مقارنة' : 'Compare'} (${_selectedForCompare.length})'),
            )
          : null,
      appBar: AppBar(
        title: Text(tr(context, 'wishlist')),
        actions: [
          TextButton(
            onPressed: () => setState(() {
              _compareMode = !_compareMode;
              if (!_compareMode) _selectedForCompare.clear();
            }),
            child: Text(_compareMode ? tr(context, 'cancel') : (Localizations.localeOf(context).languageCode == 'ar' ? 'مقارنة' : 'Compare')),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<Product>>(
          future: _wishlistFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const ProductGridSkeleton();
            }
            if (snapshot.hasError) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 80),
                    child: Center(child: Text('${tr(context, 'could_not_load_products')} ${snapshot.error}', style: TextStyle(color: LeapPalette.of(context).muted))),
                  ),
                ],
              );
            }
            final products = snapshot.data ?? [];
            _loadedProducts = products;
            if (products.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Text(tr(context, 'no_wishlist_items_yet'), textAlign: TextAlign.center, style: TextStyle(color: LeapPalette.of(context).muted)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () => context.go('/home'),
                          child: Text(tr(context, 'browse_products')),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }
            return GridView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.55,
              ),
              itemCount: products.length,
              itemBuilder: (context, i) {
                final p = products[i];
                // Real price-drop indicator (#59) -- only shown when
                // the real lastKnownPrice snapshot genuinely exceeds
                // the real current price, i.e. an actual drop
                // happened, never a fabricated comparison.
                final hasPriceDrop = p.lastKnownPrice != null && p.lastKnownPrice! > p.price;
                final isSelected = _selectedForCompare.contains(p.id);
                return Stack(
                  children: [
                    ProductCard(
                      product: p,
                      onTap: _compareMode
                          ? () => setState(() {
                                if (isSelected) {
                                  _selectedForCompare.remove(p.id);
                                } else if (_selectedForCompare.length < 4) {
                                  _selectedForCompare.add(p.id);
                                }
                              })
                          : () => context.push('/product/${p.id}').then((_) => _reload()),
                    ),
                    if (_compareMode)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isSelected ? LeapPalette.of(context).signal : Colors.white,
                            border: Border.all(color: LeapPalette.of(context).line, width: 1.5),
                          ),
                          child: isSelected ? Icon(Icons.check, size: 16, color: LeapPalette.of(context).onSignal) : null,
                        ),
                      ),
                    if (hasPriceDrop)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: LeapPalette.of(context).gauge, borderRadius: BorderRadius.circular(20)),
                          child: Text(
                            '\$${p.lastKnownPrice!.toStringAsFixed(0)} → \$${p.price.toStringAsFixed(0)}',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}
