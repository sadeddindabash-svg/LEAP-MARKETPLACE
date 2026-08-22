import 'package:flutter/material.dart';
import 'package:custom_refresh_indicator/custom_refresh_indicator.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/garage_state.dart';
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
  // Real, new -- tracks the last GarageState.version this screen has
  // already re-fetched for, so _ensureGarageLoaded can tell "the
  // default vehicle changed somewhere else" apart from "already
  // up to date," regardless of which screen changed it or how the
  // person navigated back here.
  int? _lastSeenGarageVersion;

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

  void _ensureGarageLoaded(AuthState auth, int currentGarageVersion) {
    final needsInitialLoad = _garageFuture == null && auth.isLoggedIn;
    final changedElsewhere = auth.isLoggedIn && _lastSeenGarageVersion != null && currentGarageVersion != _lastSeenGarageVersion;
    if (needsInitialLoad || changedElsewhere) {
      _garageFuture = ApiClient().fetchMyGarage(auth.token!);
    }
    _lastSeenGarageVersion = currentGarageVersion;
  }

  // Real, new -- fixes a real reported bug: changing the default
  // vehicle in My Garage never updated the "Shopping for" card here,
  // since _garageFuture was only ever fetched once (guarded by "if
  // null" in _ensureGarageLoaded above) and nothing re-fetched it on
  // return from the garage screen. Re-fetches on every real return
  // from '/garage', regardless of whether anything was actually
  // changed there -- simpler and safer than trying to detect whether
  // a real change happened, and this screen already re-fetches its
  // whole garage future on pull-to-refresh the same way.
  void _navigateToGarage(BuildContext context) {
    context.push('/garage').then((_) {
      if (!mounted) return;
      final auth = context.read<AuthState>();
      if (!auth.isLoggedIn) return;
      setState(() {
        _garageFuture = ApiClient().fetchMyGarage(auth.token!);
      });
    });
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
    _ensureGarageLoaded(auth, context.watch<GarageState>().version);
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
                Image.asset('assets/images/leap_logo.png', height: 32, width: 32),
                const SizedBox(width: 8),
                Text(
                  isAr ? 'ليب لقطع السيارات' : 'LEAP Auto Parts',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: palette.ink),
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
        // Real, branded pull-to-refresh (#121) -- renders the real
        // logo (assets/images/leap_logo.png) instead of Flutter's
        // generic spinner, since RefreshIndicator itself only
        // supports changing the spinner's color, not swapping in a
        // real custom widget.
        child: CustomRefreshIndicator(
          onRefresh: _handleRefresh,
          builder: (context, child, controller) {
            return Stack(
              children: [
                child,
                if (!controller.isIdle)
                  AnimatedBuilder(
                    animation: controller,
                    builder: (context, _) {
                      final progress = controller.value.clamp(0.0, 1.5);
                      return Positioned(
                        top: 16 + (24 * progress.clamp(0.0, 1.0)),
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Opacity(
                            opacity: progress.clamp(0.0, 1.0),
                            child: Transform.rotate(
                              angle: controller.isLoading ? controller.value * 6.28 : 0,
                              child: Image.asset('assets/images/leap_logo.png', width: 32, height: 32),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
              ],
            );
          },
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
            // 2. Shopping for -- real garage data
            _ShoppingForCard(garageFuture: _garageFuture, isLoggedIn: auth.isLoggedIn, onNavigateToGarage: () => _navigateToGarage(context)),
            const SizedBox(height: 12),
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
                        height: productCardHeightFor(140),
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
                            ),
                            clipBehavior: Clip.antiAlias,
                            // Real category photo (new) -- closes a
                            // real gap: the backend's own real,
                            // admin-uploaded photoUrl field existed
                            // already, this screen just never showed
                            // it. Falls back to the existing icon when
                            // a real category genuinely has none yet.
                            child: c.photoUrl != null
                                ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!), fit: BoxFit.cover, fadeInDuration: const Duration(milliseconds: 300), errorWidget: (context, url, error) => Icon(_iconForCategory(c.id), color: palette.signal, size: 31))
                                : Icon(_iconForCategory(c.id), color: palette.signal, size: 31),
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
                          onPressed: () => _navigateToGarage(context),
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
                          color: palette.card,
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
                                Text('${firstVehicle.labelFor(isAr)} · ${firstVehicle.subLabel}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.ink)),
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
                        childAspectRatio: 0.55,
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
  final VoidCallback onNavigateToGarage;
  const _ShoppingForCard({required this.garageFuture, required this.isLoggedIn, required this.onNavigateToGarage});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    // Real, deliberate scoping: gold only in dark mode, per the
    // original request. Light mode keeps its real muted gray --
    // gold on a light background would have much lower real
    // contrast/readability than the existing color there.
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final labelColor = isDark ? palette.signal : palette.muted;
    if (!isLoggedIn || garageFuture == null) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.directions_car_outlined),
          title: Text(tr(context, 'shopping_for'), style: TextStyle(fontSize: 11, color: labelColor)),
          subtitle: Text(tr(context, 'add_a_vehicle'), style: isDark ? TextStyle(color: palette.signal) : null),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => onNavigateToGarage(),
        ),
      );
    }
    return FutureBuilder<List<Vehicle>>(
      future: garageFuture,
      builder: (context, snapshot) {
        final vehicles = snapshot.data ?? [];
        final vehicle = vehicles.isNotEmpty ? vehicles.firstWhere((v) => v.isDefault, orElse: () => vehicles.first) : null;
        if (vehicle == null) {
          return Card(
            child: ListTile(
              leading: const Icon(Icons.directions_car_outlined),
              title: Text(tr(context, 'shopping_for'), style: TextStyle(fontSize: 11, color: labelColor)),
              subtitle: Text(tr(context, 'add_a_vehicle'), style: isDark ? TextStyle(color: palette.signal) : null),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => onNavigateToGarage(),
            ),
          );
        }
        // Real angled photo panel (new, "option 6") -- shows the real
        // vehicle brand's own photo when one exists. Note this is a
        // photo of the real BRAND (e.g. a generic Honda image), not
        // one specific to this exact model/generation -- no per-model
        // photos exist in this system yet, confirmed directly against
        // the real database before building this. Falls back to a
        // plain icon, gracefully, when the brand has no real photo
        // set yet (most brands today, confirmed via a real query).
        final isAr = context.watch<LanguageState>().isArabic;
        // Real, confirmed fallback chain: the model's own photo is
        // more specific to this exact saved vehicle than the brand's
        // generic one, so it's preferred whenever it exists.
        final displayPhotoUrl = vehicle.modelPhotoUrl ?? vehicle.brandPhotoUrl;
        return Card(
          clipBehavior: Clip.antiAlias,
          color: palette.chalk,
          child: InkWell(
            onTap: () => onNavigateToGarage(),
            child: SizedBox(
              height: 76,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: FractionallySizedBox(
                      widthFactor: 0.45,
                      alignment: isAr ? Alignment.centerLeft : Alignment.centerRight,
                      child: ClipPath(
                        clipper: _DiagonalClipper(mirrored: isAr),
                        child: Container(
                          color: palette.card,
                          child: Center(
                            child: Container(
                              width: 75,
                              height: 75,
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(8)),
                              child: displayPhotoUrl != null
                                  ? CachedNetworkImage(
                                      imageUrl: ApiClient.resolveMediaUrl(displayPhotoUrl),
                                      fit: BoxFit.contain,
                                      fadeInDuration: const Duration(milliseconds: 300),
                                      errorWidget: (context, url, error) => Icon(Icons.directions_car, size: 20, color: palette.muted),
                                    )
                                  : Icon(Icons.directions_car, size: 20, color: palette.muted),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: isAr ? 100 : 14,
                    right: isAr ? 8 : 100,
                    top: 14,
                    child: Directionality(
                      textDirection: TextDirection.ltr,
                      child: Column(
                        crossAxisAlignment: isAr ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(tr(context, 'shopping_for'), style: TextStyle(fontSize: 11, color: labelColor), textDirection: isAr ? TextDirection.rtl : TextDirection.ltr),
                          const SizedBox(height: 4),
                          PlateChip(text: '${vehicle.labelFor(isAr)} · ${vehicle.subLabel}', small: true),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Real diagonal-edge clip (new) -- for the "Shopping for" card's
/// angled photo panel. The top edge starts 25% in from the left, the
/// bottom edge runs the full width, producing a slanted left border
/// instead of a plain rectangle. Set mirrored: true for RTL (Arabic),
/// where the photo panel sits on the left instead of the right --
/// confirmed against a real rendered mockup before building: this
/// flips which corner the diagonal starts from, so the slant faces
/// the correct direction relative to where the panel actually sits.
class _DiagonalClipper extends CustomClipper<Path> {
  final bool mirrored;
  const _DiagonalClipper({this.mirrored = false});

  @override
  Path getClip(Size size) {
    final path = Path();
    if (mirrored) {
      path.moveTo(0, 0);
      path.lineTo(size.width * 0.75, 0);
      path.lineTo(size.width, size.height);
      path.lineTo(0, size.height);
    } else {
      path.moveTo(size.width * 0.25, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
      path.lineTo(0, size.height);
    }
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant _DiagonalClipper oldClipper) => oldClipper.mirrored != mirrored;
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
          color: selected ? palette.signal : palette.card,
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
