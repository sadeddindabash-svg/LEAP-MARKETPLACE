import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';
import '../search/vehicle_filter_sheet.dart';

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
/// Requires login — there's no guest "garage" concept, unlike guest
/// checkout; saving a vehicle only makes sense tied to an account.
class GarageScreen extends StatefulWidget {
  const GarageScreen({super.key});

  @override
  State<GarageScreen> createState() => _GarageScreenState();
}

class _GarageScreenState extends State<GarageScreen> {
  late Future<List<Vehicle>> _garageFuture;

  @override
  void initState() {
    super.initState();
    _garageFuture = _load();
  }

  Future<List<Vehicle>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyGarage(auth.token!);
  }

  Future<void> _remove(Vehicle v) async {
    final auth = context.read<AuthState>();
    try {
      // Same real fix as _addVehicle above -- removeVehicleFromGarage
      // already returns the real, updated list directly from the real
      // DELETE response; using it directly instead of discarding it
      // and calling the old _refresh() (removed) for a second, separate fetch.
      final updatedGarage = await ApiClient().removeVehicleFromGarage(auth.token!, v.generationId, v.year);
      if (mounted) setState(() => _garageFuture = Future.value(updatedGarage));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // Real confirmation dialog (new) -- closes a real, genuine
  // inconsistency: the addresses screen already asks for confirmation
  // before a real delete; this screen removed a vehicle immediately
  // with no safety net at all for an equally irreversible action
  // (fitment filtering, saved default vehicle, etc. all rely on this).
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
      // REAL BUG FOUND AND FIXED HERE, reported by an actual person
      // testing on a real device: addVehicleToGarage ALREADY makes its
      // own real fetchMyGarage call internally and returns the real,
      // updated list -- but that result was being discarded here, and
      // the old _refresh() (removed) below then triggered a SECOND, entirely separate
      // fetch. Wasteful at best; at worst, a real race between the two
      // in-flight requests could explain exactly the reported symptom
      // (a genuinely saved vehicle not showing up until a manual
      // refresh forced a clean, single fetch). Uses the already-
      // fetched result directly instead of discarding it and fetching
      // a second time.
      //
      // Real fallback for "Any year in this generation" (year: null) --
      // My Garage always needs ONE definite year (this is meant to be
      // the buyer's own exact car), unlike search where "any year"
      // genuinely means "don't narrow." Falls back to the generation's
      // own real starting year, never a placeholder.
      final updatedGarage = await ApiClient().addVehicleToGarage(auth.token!, selection.generationId, selection.year ?? selection.yearStart);
      if (mounted) setState(() => _garageFuture = Future.value(updatedGarage));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
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
              const Icon(Icons.directions_car_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'garage_login_prompt'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in'))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'my_garage'))),
      body: FutureBuilder<List<Vehicle>>(
        future: _garageFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('${tr(context, 'could_not_load_garage')} ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
          }
          final vehicles = snapshot.data ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final v in vehicles)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const Icon(Icons.directions_car),
                    title: Text(v.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(v.subLabel),
                    trailing: IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => _confirmRemove(v)),
                    onTap: () => Navigator.of(context).pop(v),
                  ),
                ),
              OutlinedButton.icon(
                onPressed: _addVehicle,
                icon: const Icon(Icons.add),
                label: Text(tr(context, 'add_a_vehicle')),
              ),
            ],
          );
        },
      ),
    );
  }
}
