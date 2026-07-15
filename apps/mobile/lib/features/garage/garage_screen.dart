import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';

/// BUY-004, BUY-010–012: saved vehicles ("My Garage") drive the fitment
/// filter across the rest of the app. Phase 1 is Year/Make/Model/Trim only;
/// VIN lookup is Phase 2 (BUY-014) — don't build VIN decoding into this
/// screen yet, it depends on a licensed data provider (see SRS Section 11).
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

  void _refresh() => setState(() => _garageFuture = _load());

  Future<void> _remove(Vehicle v) async {
    final auth = context.read<AuthState>();
    try {
      await ApiClient().removeVehicleFromGarage(auth.token!, v.id);
      _refresh();
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
                    trailing: IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => _remove(v)),
                    onTap: () => Navigator.of(context).pop(v),
                  ),
                ),
              OutlinedButton.icon(
                onPressed: () async {
                  final added = await context.push<bool>('/garage/add');
                  if (added == true) _refresh();
                },
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
