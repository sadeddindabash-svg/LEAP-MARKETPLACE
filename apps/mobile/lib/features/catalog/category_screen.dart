import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/app_strings.dart';
import '../../models/product.dart';
import '../../services/api_client.dart';

/// BUY-013: shows parts for a category, fetched from the real catalog API.
/// (Fitment-based filtering via an active vehicle — showing only
/// confirmed-fit parts — isn't threaded through here yet; see BUY-013 in
/// the SRS for the full requirement. This fetches by category only.)
class CategoryScreen extends StatefulWidget {
  final String categoryId;
  final String categoryName;
  const CategoryScreen({super.key, required this.categoryId, required this.categoryName});

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  Future<List<Product>>? _productsFuture;
  String? _loadedForLanguage;

  void _ensureLoaded(String language) {
    if (_loadedForLanguage != language) {
      _loadedForLanguage = language;
      _productsFuture = ApiClient().fetchProductsByCategory(widget.categoryId, lang: language);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = context.watch<LanguageState>().language;
    _ensureLoaded(language);
    return Scaffold(
      appBar: AppBar(title: Text(widget.categoryName)),
      body: FutureBuilder<List<Product>>(
        future: _productsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
              ),
            );
          }
          final products = snapshot.data ?? [];
          if (products.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(tr(context, 'no_products_in_category'), textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final p = products[i];
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.album_outlined, color: LeapColors.ink),
                  title: Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${p.category} · \$${p.price.toStringAsFixed(2)} ${p.currencyCode}'),
                  onTap: () => context.push('/product/${p.id}'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
