import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final rows = [
      (icon: Icons.directions_car_outlined, label: 'My Garage', route: '/garage'),
      (icon: Icons.location_on_outlined, label: 'Addresses', route: null),
      (icon: Icons.inventory_2_outlined, label: 'Orders & returns', route: '/orders'),
      (icon: Icons.chat_bubble_outline, label: 'Leap Support', route: '/support'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        children: rows
            .map((r) => ListTile(
                  leading: Icon(r.icon, color: LeapColors.ink),
                  title: Text(r.label),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: r.route == null ? null : () => context.push(r.route!),
                ))
            .toList(),
      ),
    );
  }
}
