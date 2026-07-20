import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../models/category.dart';
import '../../models/product.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';
import '../../widgets/product_card.dart';

/// Real, admin-managed icon per known category id — a NEW category an
/// admin adds via the admin dashboard's Categories page (see
/// services/api/README.md's "Category + parts reference lists" section)
/// won't have an icon mapping here yet, so it falls back to a generic
/// one rather than crashing or showing nothing. The backend doesn't
/// store icon choices — that's a real, honest scope boundary, not an
/// oversight — so this mapping is maintained here, in the one place
/// that actually renders icons.
IconData _iconForCategory(String categoryId) {
  const known = {
    'brake': Icons.album_outlined,
    'engine': Icons.settings_outlined,
    'electrical': Icons.electrical_services_outlined,
    'filters': Icons.filter_alt_outlined,
    'suspension': Icons.build_outlined,
    'lighting': Icons.lightbulb_outline,
  };
  return known[categoryId] ?? Icons.category_outlined;
}

/// Confirmed exact sequence, top to bottom: search bar -> "Shopping
/// for" -> "Shop by category" -> filter (Newest / My car) -> the real
/// product feed, each card showing photo, name, review stars, an
/// add-to-cart button, stock availability, and price (see ProductCard).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<ProductCategory>> _categoriesFuture;
  Future<List<Vehicle>>? _garageFuture;

  String _feedFilter = 'newest'; // 'newest' | 'my_car'
  Future<List<Product>>? _feedFuture;
  String? _loadedForFeedKey;

  // Real recently viewed products (migration 032), synced to the real
  // buyer's account -- confirmed scope: logged-in buyers only.
  Future<List<Product>>? _recentlyViewedFuture;

  @override
  void initState() {
    super.initState();
    _categoriesFuture = ApiClient().fetchCategories();
  }

  void _ensureGarageLoaded(AuthState auth) {
    if (_garageFuture == null && auth.isLoggedIn) {
      _garageFuture = ApiClient().fetchMyGarage(auth.token!);
    }
  }

  void _ensureRecentlyViewedLoaded(AuthState auth) {
    if (_recentlyViewedFuture == null && auth.isLoggedIn) {
      _recentlyViewedFuture = ApiClient().fetchRecentlyViewed(auth.token!);
    }
  }

  void _ensureFeedLoaded(String language, String? myCarVehicleId) {
    final key = '$_feedFilter|$language|${myCarVehicleId ?? ""}';
    if (_loadedForFeedKey == key) return;
    _loadedForFeedKey = key;
    if (_feedFilter == 'newest') {
      _feedFuture = ApiClient().fetchProducts(sort: 'newest', lang: language);
    } else if (myCarVehicleId != null) {
      _feedFuture = ApiClient().fetchProducts(vehicleId: myCarVehicleId, lang: language);
    } else {
      _feedFuture = Future.value(const []); // no saved vehicle -- real empty state shown separately, not an error
    }
  }

  void _setFilter(String filter) {
    if (_feedFilter == filter) return;
    setState(() {
      _feedFilter = filter;
      _loadedForFeedKey = null; // force a real refetch under the new filter
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final language = context.watch<LanguageState>().language;
    final isAr = context.watch<LanguageState>().isArabic;
    _ensureGarageLoaded(auth);
    _ensureRecentlyViewedLoaded(auth);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('LEAP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: LeapColors.ink)),
                IconButton(
                  icon: const Icon(Icons.chat_bubble_outline),
                  onPressed: () => context.push('/support'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // 1. Search bar
            TextField(
              readOnly: true,
              onTap: () => context.push('/search'),
              decoration: InputDecoration(
                hintText: tr(context, 'search_hint'),
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),
            // 2. Shopping for -- real garage data
            _ShoppingForCard(garageFuture: _garageFuture, isLoggedIn: auth.isLoggedIn),
            const SizedBox(height: 20),
            // 2.5. Recently viewed -- real, synced to the buyer's real
            // account (migration 032) -- logged-in buyers only.
            if (auth.isLoggedIn)
              FutureBuilder<List<Product>>(
                future: _recentlyViewedFuture,
                builder: (context, snapshot) {
                  final products = snapshot.data ?? [];
                  if (snapshot.connectionState != ConnectionState.done || products.isEmpty) {
                    return const SizedBox.shrink();
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(isAr ? 'شوهدت مؤخرًا' : 'Recently viewed', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 210,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: products.length,
                          separatorBuilder: (context, i) => const SizedBox(width: 10),
                          itemBuilder: (context, i) {
                            final p = products[i];
                            return SizedBox(width: 140, child: ProductCard(product: p, onTap: () => context.push('/product/${p.id}')));
                          },
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  );
                },
              ),
            // 3. Shop by category
            Text(tr(context, 'shop_by_category'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 12),
            FutureBuilder<List<ProductCategory>>(
              future: _categoriesFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()));
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', style: const TextStyle(color: LeapColors.muted), textAlign: TextAlign.center),
                  );
                }
                final categories = snapshot.data ?? [];
                return GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  children: categories.map((c) {
                    final label = c.displayName(isAr);
                    return GestureDetector(
                      onTap: () => context.push('/category-browse/${c.id}'),
                      child: Column(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: LeapColors.chalk,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: LeapColors.line),
                            ),
                            child: Icon(_iconForCategory(c.id), color: LeapColors.ink),
                          ),
                          const SizedBox(height: 6),
                          Text(label, style: const TextStyle(fontSize: 10), textAlign: TextAlign.center),
                        ],
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 24),
            // 4. Filter: Newest / My car
            Row(
              children: [
                _FilterChip(label: tr(context, 'filter_newest'), selected: _feedFilter == 'newest', onTap: () => _setFilter('newest')),
                const SizedBox(width: 10),
                _FilterChip(label: tr(context, 'filter_my_car'), selected: _feedFilter == 'my_car', onTap: () => _setFilter('my_car')),
              ],
            ),
            const SizedBox(height: 12),
            // 5. The real product feed.
            FutureBuilder<List<Vehicle>>(
              future: _garageFuture,
              builder: (context, garageSnapshot) {
                final firstVehicleId = (garageSnapshot.data?.isNotEmpty ?? false) ? garageSnapshot.data!.first.id : null;
                if (_feedFilter == 'my_car' && auth.isLoggedIn && garageSnapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()));
                }
                _ensureFeedLoaded(language, firstVehicleId);
                if (_feedFilter == 'my_car' && firstVehicleId == null) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(tr(context, 'add_a_vehicle_for_my_car_filter'), style: const TextStyle(color: LeapColors.muted), textAlign: TextAlign.center),
                  );
                }
                return FutureBuilder<List<Product>>(
                  future: _feedFuture,
                  builder: (context, feedSnapshot) {
                    if (feedSnapshot.connectionState == ConnectionState.waiting) {
                      return const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()));
                    }
                    if (feedSnapshot.hasError) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text('${tr(context, 'could_not_load_products')}\n${feedSnapshot.error}', style: const TextStyle(color: LeapColors.muted), textAlign: TextAlign.center),
                      );
                    }
                    final products = feedSnapshot.data ?? [];
                    if (products.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(tr(context, 'no_products_yet'), style: const TextStyle(color: LeapColors.muted), textAlign: TextAlign.center),
                      );
                    }
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 0.62,
                      ),
                      itemCount: products.length,
                      itemBuilder: (context, i) {
                        final p = products[i];
                        return ProductCard(product: p, onTap: () => context.push('/product/${p.id}'));
                      },
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ShoppingForCard extends StatelessWidget {
  final Future<List<Vehicle>>? garageFuture;
  final bool isLoggedIn;
  const _ShoppingForCard({required this.garageFuture, required this.isLoggedIn});

  @override
  Widget build(BuildContext context) {
    if (!isLoggedIn || garageFuture == null) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.directions_car_outlined),
          title: Text(tr(context, 'shopping_for'), style: const TextStyle(fontSize: 11, color: LeapColors.muted)),
          subtitle: Text(tr(context, 'add_a_vehicle')),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push('/garage'),
        ),
      );
    }
    return FutureBuilder<List<Vehicle>>(
      future: garageFuture,
      builder: (context, snapshot) {
        final vehicles = snapshot.data ?? [];
        final vehicle = vehicles.isNotEmpty ? vehicles.first : null;
        return Card(
          child: ListTile(
            leading: const Icon(Icons.directions_car_outlined),
            title: Text(tr(context, 'shopping_for'), style: const TextStyle(fontSize: 11, color: LeapColors.muted)),
            subtitle: vehicle != null
                ? PlateChip(text: '${vehicle.label} · ${vehicle.subLabel}', small: true)
                : Text(tr(context, 'add_a_vehicle')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/garage'),
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? LeapColors.signal : LeapColors.chalk,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? LeapColors.signal : LeapColors.line),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? Colors.white : LeapColors.ink),
        ),
      ),
    );
  }
}
