import 'package:flutter/material.dart';
import '../../models/vehicle.dart';

/// BUY-004, BUY-010–012: saved vehicles ("My Garage") drive the fitment
/// filter across the rest of the app. Phase 1 is Year/Make/Model/Trim only;
/// VIN lookup is Phase 2 (BUY-014) — don't build VIN decoding into this
/// screen yet, it depends on a licensed data provider (see SRS Section 11).
class GarageScreen extends StatelessWidget {
  const GarageScreen({super.key});

  // TODO: replace with real saved vehicles from the user service.
  static const _placeholderVehicles = [
    Vehicle(id: 'v1', make: 'BMW', model: '1 Hatchback (F20)', trim: '118d 2.0', yearsRange: '2015–2019'),
    Vehicle(id: 'v2', make: 'Toyota', model: 'Camry (XV70)', trim: '2.5L SE', yearsRange: '2018–2023'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Garage')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _placeholderVehicles.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          if (i == _placeholderVehicles.length) {
            return OutlinedButton.icon(
              onPressed: () {
                // TODO: push an "Add vehicle" flow — Make → Model → Year → Trim
              },
              icon: const Icon(Icons.add),
              label: const Text('Add a vehicle'),
            );
          }
          final v = _placeholderVehicles[i];
          return Card(
            child: ListTile(
              leading: const Icon(Icons.directions_car),
              title: Text(v.label, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(v.subLabel),
              onTap: () {
                // TODO: set as active vehicle in app state (Provider) and pop
                Navigator.of(context).pop();
              },
            ),
          );
        },
      ),
    );
  }
}
