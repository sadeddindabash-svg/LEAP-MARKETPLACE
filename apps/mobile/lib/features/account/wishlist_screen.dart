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

  void _ensureLoaded(String language, String? token) {
    if (_loadedForLanguage == language || token == null) return;
    _loadedForLanguage = language;
    _wishlistFuture = ApiClient().fetchWishlist(token, lang: language);
  }

  void _reload() {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    setState(() => _wishlistFuture = ApiClient().fetchWishlist(token, lang: context.read<LanguageState>().language));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final language = context.watch<LanguageState>().language;
    _ensureLoaded(language, auth.token);

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'wishlist'))),
      body: FutureBuilder<List<Product>>(
        future: _wishlistFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('${tr(context, 'could_not_load_products')} ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
          }
          final products = snapshot.data ?? [];
          if (products.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(tr(context, 'no_wishlist_items_yet'), textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
              ),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.62,
            ),
            itemCount: products.length,
            itemBuilder: (context, i) {
              final p = products[i];
              return ProductCard(
                product: p,
                onTap: () => context.push('/product/${p.id}').then((_) => _reload()),
              );
            },
          );
        },
      ),
    );
  }
}
