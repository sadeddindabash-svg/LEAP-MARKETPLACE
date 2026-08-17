import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../core/auth_state.dart';
import '../../core/app_strings.dart';
import '../../models/product.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';
import '../../widgets/product_card.dart';
import '../../widgets/skeleton.dart';

/// BUY-013: real products for a category, optionally scoped to one
/// exact real Part (see the new CategoryBrowseScreen — tapping a real
/// Part there lands here with both `categoryId` and `part` set, showing
/// exactly that part's products via the backend's real exact-match
/// `part=` filter, not the fuzzy `search=` one).
///
/// Real fitment-based filtering (new, #2) -- closes this file's own
/// previously-flagged gap: fetches the real buyer's own saved default
/// vehicle (same real pattern already established on Home) and, when
/// one exists, filters to genuinely confirmed-fit results only,
/// showing the same real Confirmed Fit badge Search's own "My Car"
/// concept already uses.
class CategoryScreen extends StatefulWidget {
  final String categoryId;
  final String categoryName;
  final String? part;
  const CategoryScreen({super.key, required this.categoryId, required this.categoryName, this.part});

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  Future<List<Product>>? _productsFuture;
  String? _loadedForLanguage;
  Vehicle? _defaultVehicle;
  bool _defaultVehicleChecked = false;

  Future<void> _loadDefaultVehicle() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) {
      setState(() => _defaultVehicleChecked = true);
      return;
    }
    try {
      final garage = await ApiClient().fetchMyGarage(auth.token!);
      final defaultVehicle = garage.isEmpty ? null : garage.firstWhere((v) => v.isDefault, orElse: () => garage.first);
      if (mounted) {
        setState(() {
          _defaultVehicle = defaultVehicle;
          _defaultVehicleChecked = true;
          _loadedForLanguage = null; // force a real reload now that the real vehicle is known
        });
      }
    } catch (_) {
      // Real, honest degrade: a real failure fetching the garage just
      // means no real fitment filter applies -- the category still
      // shows its normal, unfiltered real results.
      if (mounted) setState(() => _defaultVehicleChecked = true);
    }
  }

  void _ensureLoaded(String language) {
    if (_loadedForLanguage != language) {
      _loadedForLanguage = language;
      _productsFuture = ApiClient().fetchProductsByCategory(widget.categoryId, part: widget.part, generationId: _defaultVehicle?.generationId, lang: language);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadDefaultVehicle();
  }

  @override
  Widget build(BuildContext context) {
    final language = context.watch<LanguageState>().language;
    if (!_defaultVehicleChecked) {
      return Scaffold(appBar: AppBar(title: Text(widget.part ?? widget.categoryName)), body: const ProductGridSkeleton());
    }
    _ensureLoaded(language);
    return Scaffold(
      appBar: AppBar(title: Text(widget.part ?? widget.categoryName)),
      body: FutureBuilder<List<Product>>(
        future: _productsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const ProductGridSkeleton();
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', textAlign: TextAlign.center, style: TextStyle(color: LeapPalette.of(context).muted)),
              ),
            );
          }
          final products = snapshot.data ?? [];
          if (products.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(tr(context, 'no_products_in_category'), textAlign: TextAlign.center, style: TextStyle(color: LeapPalette.of(context).muted)),
              ),
            );
          }
          return GridView.builder(
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
              return ProductCard(product: p, onTap: () => context.push('/product/${p.id}'), showConfirmedFitBadge: _defaultVehicle != null);
            },
          );
        },
      ),
    );
  }
}
