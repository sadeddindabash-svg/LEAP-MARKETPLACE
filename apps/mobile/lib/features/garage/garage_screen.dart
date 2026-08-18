import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';
import '../search/vehicle_filter_sheet.dart';
import '../../widgets/skeleton.dart';

/// BUY-004, BUY-010–012: saved vehicles ("My Garage") drive the fitment
/// filter across the rest of the app.
///
/// REAL BUG FOUND AND FIXED HERE (backend migration 044): this screen
/// used to push a separate '/garage/add' route (add_vehicle_screen.dart)
/// built on the flat, unpopulated-for-matching vehicles table -- a
/// saved vehicle could never filter the catalog to a real product.
/// Now reuses VehicleFilterSheet directly (the same real Brand->Model->
/// Generation->Year picker the search filter already uses), against
/// the real, populated structured cascade. add_vehicle_screen.dart is
/// no longer routed to and has been removed.
///
/// REAL BUG FOUND AND FIXED HERE, reported by an actual person testing
/// on a real device, and only fully diagnosed via their own real
/// Chrome DevTools Network tab: after adding a vehicle, the real
/// backend genuinely saved it and genuinely returned it in the very
/// next real fetch (confirmed directly from the real response body,
/// not assumed) -- but it didn't appear on screen until a manual
/// refresh. This screen used to re-wrap that already-fetched result in
/// a brand new `Future.value(...)` and hand it to a `FutureBuilder` --
/// which resets its own internal snapshot to a waiting state and only
/// picks up a new Future's value on a LATER microtask, not
/// synchronously within the same `setState` -- a real, subtle timing
/// gap that this rewrite removes entirely by keeping the vehicle list
/// in a plain `List<Vehicle>?` field instead, updated directly and
/// synchronously, with no FutureBuilder replacement-future involved in
/// the add/remove path at all. FutureBuilder is now only used once,
/// for the real initial load.
///
/// Requires login — there's no guest "garage" concept, unlike guest
/// checkout; saving a vehicle only makes sense tied to an account.
class GarageScreen extends StatefulWidget {
  const GarageScreen({super.key});

  @override
  State<GarageScreen> createState() => _GarageScreenState();
}

class _GarageScreenState extends State<GarageScreen> {
  late Future<List<Vehicle>> _initialLoadFuture;
  List<Vehicle>? _vehicles;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _initialLoadFuture = _load();
    _initialLoadFuture.then((v) {
      if (mounted) setState(() => _vehicles = v);
    }).catchError((e) {
      if (mounted) setState(() => _loadError = e.toString());
    });
  }

  Future<List<Vehicle>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyGarage(auth.token!);
  }

  Future<void> _remove(Vehicle v) async {
    final auth = context.read<AuthState>();
    try {
      // removeVehicleFromGarage already returns the real, updated list
      // directly from the real DELETE response. Set directly into
      // _vehicles (a plain field, not wrapped in a new Future handed to
      // a FutureBuilder) -- see this file's own header comment for why.
      final updatedGarage = await ApiClient().removeVehicleFromGarage(auth.token!, v.generationId, v.year);
      if (mounted) setState(() => _vehicles = updatedGarage);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _setDefault(Vehicle v) async {
    final auth = context.read<AuthState>();
    try {
      // Same safe, direct pattern as add/_remove above -- see this
      // file's own header comment for why a Future.value()/
      // FutureBuilder replacement was never used here.
      final updatedGarage = await ApiClient().setDefaultVehicle(auth.token!, v.generationId, v.year);
      if (mounted) setState(() => _vehicles = updatedGarage);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // Real confirmation dialog -- closes a real, genuine inconsistency:
  // the addresses screen already asks for confirmation before a real
  // delete; this screen removed a vehicle immediately with no safety
  // net at all for an equally irreversible action (fitment filtering,
  // saved default vehicle, etc. all rely on this).
  void _confirmRemove(Vehicle v) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(tr(context, 'remove_vehicle_confirm')),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(tr(context, 'cancel'))),
          TextButton(
            onPressed: () { Navigator.of(dialogContext).pop(); _remove(v); },
            child: Text(tr(context, 'delete'), style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<void> _addVehicle() async {
    final selection = await showModalBottomSheet<VehicleFilterSelection>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const VehicleFilterSheet(),
    );
    if (selection == null) return;
    final auth = context.read<AuthState>();
    try {
      // addVehicleToGarage already returns the real, updated list --
      // POST /garage/me itself only returns the single newly-added
      // vehicle (a real backend constraint), so this makes its own
      // real internal follow-up fetch and returns THAT. Set directly
      // into _vehicles (a plain field), not wrapped in a new Future
      // handed to a FutureBuilder -- see this file's own header
      // comment for the real timing bug that caused.
      //
      // Real fallback for "Any year in this generation" (year: null) --
      // My Garage always needs ONE definite year (this is meant to be
      // the buyer's own exact car), unlike search where "any year"
      // genuinely means "don't narrow." Falls back to the generation's
      // own real starting year, never a placeholder.
      final updatedGarage = await ApiClient().addVehicleToGarage(auth.token!, selection.generationId, selection.year ?? selection.yearStart);
      if (mounted) setState(() => _vehicles = updatedGarage);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // Real pull-to-refresh (new) -- closes a real gap: this screen had
  // no way to manually refresh at all before, matching the same real
  // gesture already added to every other list screen in the app
  // earlier this session. Reuses the exact same real _load() already
  // used for the initial fetch.
  Future<void> _handleRefresh() async {
    try {
      final vehicles = await _load();
      if (mounted) setState(() { _vehicles = vehicles; _loadError = null; });
    } catch (e) {
      if (mounted) setState(() => _loadError = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'my_garage'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.directions_car_outlined, size: 40, color: LeapPalette.of(context).muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'garage_login_prompt'),
                textAlign: TextAlign.center,
                style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in'))),
            ],
          ),
        ),
      );
    }

    Widget body;
    if (_loadError != null) {
      body = RefreshIndicator(
        onRefresh: _handleRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 80),
              child: Center(child: Text('${tr(context, 'could_not_load_garage')} $_loadError', style: TextStyle(color: LeapPalette.of(context).muted))),
            ),
          ],
        ),
      );
    } else if (_vehicles == null) {
      body = const ListSkeleton();
    } else {
      final vehicles = _vehicles!;
      final palette = LeapPalette.of(context);
      body = RefreshIndicator(
        onRefresh: _handleRefresh,
        child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          for (final v in vehicles)
            Container(
              key: ValueKey(v.id),
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: palette.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: v.isDefault ? palette.signal : palette.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Real photo hero area, square, sized to the full
                  // width the card has available -- confirmed against
                  // several real rendered mockups before building
                  // this. Same real fallback chain and same real
                  // BoxFit.contain containment (never cropped) as the
                  // Home screen's own "Shopping for" card.
                  AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.all(8),
                      child: (v.modelPhotoUrl ?? v.brandPhotoUrl) != null
                          ? CachedNetworkImage(
                              imageUrl: ApiClient.resolveMediaUrl((v.modelPhotoUrl ?? v.brandPhotoUrl)!),
                              fit: BoxFit.contain,
                              fadeInDuration: const Duration(milliseconds: 300),
                              errorWidget: (context, url, error) => Icon(Icons.directions_car, size: 56, color: palette.muted),
                            )
                          : Icon(Icons.directions_car, size: 56, color: palette.muted),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Icon(Icons.badge_outlined, size: 14, color: palette.muted),
                      const SizedBox(width: 6),
                      Text(
                        (v.isDefault ? tr(context, 'default_vehicle_label') : tr(context, 'saved_vehicle_label')).toUpperCase(),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.muted, letterSpacing: 1),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Real "set as default" button and the close button
                  // now sit on the same real row as the model name --
                  // confirmed against a real rendered mockup before
                  // moving them up from the bottom row.
                  Row(
                    children: [
                      Expanded(child: Text(v.label, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: palette.ink))),
                      const SizedBox(width: 8),
                      if (v.isDefault)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(color: palette.signal.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.star, size: 13, color: palette.signal),
                              const SizedBox(width: 5),
                              Text(tr(context, 'default_vehicle_label'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: palette.signal)),
                            ],
                          ),
                        )
                      else
                        OutlinedButton(
                          onPressed: () => _setDefault(v),
                          style: OutlinedButton.styleFrom(side: BorderSide(color: palette.muted), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.star_border, size: 13, color: palette.muted),
                              const SizedBox(width: 5),
                              Text(tr(context, 'set_as_default_vehicle'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: palette.muted)),
                            ],
                          ),
                        ),
                      const SizedBox(width: 8),
                      IconButton(icon: Icon(Icons.close, size: 18, color: palette.muted), tooltip: 'Remove vehicle', onPressed: () => _confirmRemove(v)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(v.subLabel, style: TextStyle(fontSize: 12.5, color: palette.muted)),
                  const SizedBox(height: 14),
                  // Real, now centered rather than stretched full-width
                  // -- confirmed against a real rendered mockup, since
                  // this is now the only real action left on this row.
                  Center(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(v),
                      style: ElevatedButton.styleFrom(backgroundColor: palette.signal, foregroundColor: palette.ink, elevation: 0, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
                      child: Text(tr(context, 'view_compatible_parts'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                    ),
                  ),
                ],
              ),
            ),
          OutlinedButton.icon(
            onPressed: _addVehicle,
            icon: const Icon(Icons.add),
            label: Text(tr(context, 'add_a_vehicle')),
          ),
        ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'my_garage'))),
      body: body,
    );
  }
}
