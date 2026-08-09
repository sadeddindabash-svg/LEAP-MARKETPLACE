import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
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
import '../../widgets/skeleton.dart';
import '../../widgets/onboarding_overlay.dart';

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
    // Real, first-run onboarding walkthrough (new) -- shown once,
    // after the very first frame so a real BuildContext is safely
    // available to show a dialog with.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) OnboardingOverlay.showIfFirstRun(context);
    });
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

  void _ensureFeedLoaded(String language, Vehicle? myCarVehicle) {
    final key = '$_feedFilter|$language|${myCarVehicle?.id ?? ""}';
    if (_loadedForFeedKey == key) return;
    _loadedForFeedKey = key;
    if (_feedFilter == 'newest') {
      _feedFuture = ApiClient().fetchProducts(sort: 'newest', lang: language);
    } else if (myCarVehicle != null) {
      _feedFuture = ApiClient().fetchProducts(generationId: myCarVehicle.generationId, year: myCarVehicle.year, lang: language);
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

  /// Real pull-to-refresh (new) -- resets every real future on this
  /// screen (categories, garage, recently viewed, and the main feed
  /// via the same cache-bypass _setFilter already uses when the filter
  /// changes), rather than just one of them. The feed itself
  /// deliberately isn't awaited directly here -- it depends on the
  /// garage future resolving first (see the nested FutureBuilder
  /// below), the same real dependency chain this screen already had
  /// before pull-to-refresh existed, not something new introduced here.
  Future<void> _handleRefresh() async {
    final auth = context.read<AuthState>();
    setState(() {
      _categoriesFuture = ApiClient().fetchCategories();
      if (auth.isLoggedIn) {
        _garageFuture = ApiClient().fetchMyGarage(auth.token!);
        _recentlyViewedFuture = ApiClient().fetchRecentlyViewed(auth.token!);
      }
      _loadedForFeedKey = null;
    });
    final waits = <Future>[_categoriesFuture];
    if (_garageFuture != null) waits.add(_garageFuture!);
    if (_recentlyViewedFuture != null) waits.add(_recentlyViewedFuture!);
    await Future.wait(waits);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final language = context.watch<LanguageState>().language;
    final isAr = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    _ensureGarageLoaded(auth);
    _ensureRecentlyViewedLoaded(auth);

    return Scaffold(
      // Real, fixed app bar (new) -- matches the real Stitch reference
      // design directly (a docked/fixed header, not scrolling away
      // with the rest of the page). Also more idiomatic Flutter than
      // the previous in-ListView Row.
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: 16,
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(Icons.directions_car, color: palette.signal),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('LEAP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: palette.ink, height: 1.0)),
                    Text(
                      isAr ? 'لقطع السيارات' : 'AUTO PARTS',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 9, color: palette.muted, letterSpacing: 1.2),
                    ),
                  ],
                ),
              ],
            ),
            Row(
              children: [
                IconButton(icon: Icon(Icons.search, color: palette.signal), tooltip: 'Search', onPressed: () => context.push('/search')),
                IconButton(icon: Icon(Icons.chat_bubble_outline, color: palette.signal), tooltip: 'Support', onPressed: () => context.push('/support')),
              ],
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _handleRefresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
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
            // Real quick-shortcut chips (new) -- matches the real
            // Stitch reference design directly. Deliberately
            // visual-only for now (confirmed directly) -- not yet
            // wired to any real filter/sort, a real follow-up step.
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _QuickShortcutChip(label: isAr ? 'عروض' : 'Deals', selected: true),
                  const SizedBox(width: 8),
                  _QuickShortcutChip(label: isAr ? 'أداء' : 'Performance', selected: false),
                  const SizedBox(width: 8),
                  _QuickShortcutChip(label: isAr ? 'صيانة' : 'Maintenance', selected: false),
                  const SizedBox(width: 8),
                  _QuickShortcutChip(label: isAr ? 'داخلي' : 'Interior', selected: false),
                  const SizedBox(width: 8),
                  _QuickShortcutChip(label: isAr ? 'أدوات' : 'Tools', selected: false),
                ],
              ),
            ),
            const SizedBox(height: 16),
            // Real Shop by Symptom entry point (new, #15) -- see
            // shop_by_symptom_screen.dart's own header comment for
            // the full real scope.
            InkWell(
              onTap: () => context.push('/shop-by-symptom'),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Icons.build_circle_outlined, color: palette.signal),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        isAr ? 'ما الذي تلاحظه في سيارتك؟ تسوق حسب العارض' : 'What\'s your car doing? Shop by symptom',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: palette.ink),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: palette.muted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            // Real Which Part Do I Need wizard entry point (new,
            // #61) -- see which_part_wizard_screen.dart's own header
            // comment for how this differs from Shop by Symptom above.
            InkWell(
              onTap: () => context.push('/which-part-wizard'),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: palette.chalk, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Icons.checklist_outlined, color: palette.signal),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        isAr ? 'لا تعرف اسم القطعة؟ دعنا نساعدك' : 'Not sure what it\'s called? Let us help',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: palette.ink),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: palette.muted),
                  ],
                ),
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
                    child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', style: TextStyle(color: palette.muted), textAlign: TextAlign.center),
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
                              color: palette.chalk,
                              shape: BoxShape.circle,
                              border: Border.all(color: palette.line),
                            ),
                            clipBehavior: Clip.antiAlias,
                            // Real category photo (new) -- closes a
                            // real gap: the backend's own real,
                            // admin-uploaded photoUrl field existed
                            // already, this screen just never showed
                            // it. Falls back to the existing icon when
                            // a real category genuinely has none yet.
                            child: c.photoUrl != null
                                ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!), fit: BoxFit.cover, fadeInDuration: const Duration(milliseconds: 300), errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal))
                                : Icon(_iconForCategory(c.id), color: palette.signal),
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
                // Real fix (new) -- used to just take whichever vehicle
                // happened to be first in an arbitrary list order.
                // Prefers the real default vehicle now (migration 047),
                // falling back to the first one only if somehow none is
                // marked default (a defensive fallback, not the
                // intended real path).
                final garage = garageSnapshot.data;
                final firstVehicle = (garage?.isNotEmpty ?? false)
                    ? garage!.firstWhere((v) => v.isDefault, orElse: () => garage.first)
                    : null;
                if (_feedFilter == 'my_car' && auth.isLoggedIn && garageSnapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()));
                }
                _ensureFeedLoaded(language, firstVehicle);
                if (_feedFilter == 'my_car' && firstVehicle == null) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Column(
                      children: [
                        Text(tr(context, 'add_a_vehicle_for_my_car_filter'), style: TextStyle(color: palette.muted), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        // Real CTA (new) -- closes a real gap: just
                        // text before, no way to act on it from here.
                        OutlinedButton.icon(
                          onPressed: () => context.push('/garage'),
                          icon: const Icon(Icons.add, size: 18),
                          label: Text(tr(context, 'add_a_vehicle')),
                        ),
                      ],
                    ),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Real "Active Vehicle" banner (new) -- matches the
                    // real Stitch reference design directly. Only ever
                    // shown when the My Car filter is genuinely active
                    // AND a real vehicle is selected -- never a
                    // decorative placeholder.
                    if (_feedFilter == 'my_car' && firstVehicle != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: palette.chalk,
                          borderRadius: BorderRadius.circular(8),
                          border: Border(left: BorderSide(color: palette.signal, width: 4)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isAr ? 'المركبة النشطة' : 'ACTIVE VEHICLE',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 1),
                                ),
                                const SizedBox(height: 2),
                                Text('${firstVehicle.label} · ${firstVehicle.subLabel}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink)),
                              ],
                            ),
                            Icon(Icons.check_circle, color: palette.signal),
                          ],
                        ),
                      ),
                    FutureBuilder<List<Product>>(
                      future: _feedFuture,
                      builder: (context, feedSnapshot) {
                        if (feedSnapshot.connectionState == ConnectionState.waiting) {
                          return const ProductGridSkeleton();
                        }
                    if (feedSnapshot.hasError) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text('${tr(context, 'could_not_load_products')}\n${feedSnapshot.error}', style: TextStyle(color: palette.muted), textAlign: TextAlign.center),
                      );
                    }
                    final products = feedSnapshot.data ?? [];
                    if (products.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(tr(context, 'no_products_yet'), style: TextStyle(color: palette.muted), textAlign: TextAlign.center),
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
                        return ProductCard(
                          product: p,
                          onTap: () => context.push('/product/${p.id}'),
                          // Real "confirmed fit" badge (new) -- only
                          // ever shown for genuine My Car results,
                          // which are already always fitment-filtered
                          // server-side (see _ensureFeedLoaded).
                          showConfirmedFitBadge: _feedFilter == 'my_car',
                        );
                      },
                    );
                  },
                    ),
                  ],
                );
              },
            ),
          ],
          ),
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
    final palette = LeapPalette.of(context);
    if (!isLoggedIn || garageFuture == null) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.directions_car_outlined),
          title: Text(tr(context, 'shopping_for'), style: TextStyle(fontSize: 11, color: palette.muted)),
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
            title: Text(tr(context, 'shopping_for'), style: TextStyle(fontSize: 11, color: palette.muted)),
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
    final palette = LeapPalette.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? palette.signal : palette.chalk,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? palette.signal : palette.line),
        ),
        child: Text(
          label,
          // REAL BUG FOUND AND FIXED HERE while migrating this widget
          // to be theme-aware: selected text used hardcoded white,
          // the same real white-on-gold contrast issue already found
          // and fixed elsewhere earlier this session -- gold is too
          // light for white text to read well against.
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? palette.onSignal : palette.ink),
        ),
      ),
    );
  }
}

// Real quick-shortcut chip (new) -- deliberately visual-only for now
// (confirmed directly), matching the real Stitch reference design's
// own gold-filled (selected) / outlined (unselected) pattern.
class _QuickShortcutChip extends StatelessWidget {
  final String label;
  final bool selected;
  const _QuickShortcutChip({required this.label, required this.selected});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
      decoration: BoxDecoration(
        color: selected ? palette.signal : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected ? palette.signal : palette.line),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: selected ? palette.onSignal : palette.ink),
      ),
    );
  }
}
