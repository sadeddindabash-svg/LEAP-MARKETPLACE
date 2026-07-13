import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../models/vehicle.dart';
import '../../services/api_client.dart';

/// Two-step "Add a vehicle" flow: pick a make from the real reference
/// catalog (GET /fitment/makes), then pick a specific vehicle for that
/// make (GET /fitment/vehicles?make=...), then save it to this buyer's
/// garage (POST /garage/me). Pops with `true` if a vehicle was added, so
/// GarageScreen knows to refresh its list.
class AddVehicleScreen extends StatefulWidget {
  const AddVehicleScreen({super.key});

  @override
  State<AddVehicleScreen> createState() => _AddVehicleScreenState();
}

class _AddVehicleScreenState extends State<AddVehicleScreen> {
  String? _selectedMake;
  late Future<List<String>> _makesFuture;
  Future<List<Vehicle>>? _vehiclesFuture;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _makesFuture = ApiClient().fetchMakes();
  }

  void _selectMake(String make) {
    setState(() {
      _selectedMake = make;
      _vehiclesFuture = ApiClient().fetchVehiclesByMake(make);
    });
  }

  Future<void> _saveVehicle(Vehicle v) async {
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().addVehicleToGarage(auth.token!, v.id);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isSaving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_selectedMake == null ? 'Choose a make' : _selectedMake!),
        leading: _selectedMake == null
            ? null
            : IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selectedMake = null)),
      ),
      body: _selectedMake == null ? _buildMakeList() : _buildVehicleList(),
    );
  }

  Widget _buildMakeList() {
    return FutureBuilder<List<String>>(
      future: _makesFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('Could not load makes: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
        }
        final makes = snapshot.data ?? [];
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: makes.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, i) => ListTile(
            title: Text(makes[i]),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _selectMake(makes[i]),
          ),
        );
      },
    );
  }

  Widget _buildVehicleList() {
    return Column(
      children: [
        if (_errorMessage != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          ),
        Expanded(
          child: FutureBuilder<List<Vehicle>>(
            future: _vehiclesFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(child: Text('Could not load vehicles: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
              }
              final vehicles = snapshot.data ?? [];
              if (vehicles.isEmpty) {
                return const Center(child: Text('No vehicles found for this make.', style: TextStyle(color: LeapColors.muted)));
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: vehicles.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final v = vehicles[i];
                  return Card(
                    child: ListTile(
                      title: Text(v.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(v.subLabel),
                      trailing: _isSaving ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add_circle_outline),
                      onTap: _isSaving ? null : () => _saveVehicle(v),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
