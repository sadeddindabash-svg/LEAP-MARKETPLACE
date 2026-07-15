import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../widgets/plate_chip.dart';

const List<({String id, String name, IconData icon})> kCategories = [
  (id: 'brake', name: 'Brake System', icon: Icons.album_outlined),
  (id: 'engine', name: 'Engine', icon: Icons.settings_outlined),
  (id: 'electrical', name: 'Electrical', icon: Icons.electrical_services_outlined),
  (id: 'filters', name: 'Filters', icon: Icons.filter_alt_outlined),
  (id: 'suspension', name: 'Suspension', icon: Icons.build_outlined),
  (id: 'lighting', name: 'Lighting', icon: Icons.lightbulb_outline),
];

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
            TextField(
              readOnly: true,
              onTap: () => context.push('/search'),
              decoration: InputDecoration(
                hintText: 'Search part, brand, or number',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.directions_car_outlined),
                title: const Text('Shopping for', style: TextStyle(fontSize: 11, color: LeapColors.muted)),
                subtitle: const PlateChip(text: 'BMW 1 (F20) · 118d 2.0', small: true),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/garage'),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Shop by category', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: kCategories
                  .map((c) => GestureDetector(
                        onTap: () => context.push('/category/${c.id}', extra: c.name),
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
                              child: Icon(c.icon, color: LeapColors.ink),
                            ),
                            const SizedBox(height: 6),
                            Text(c.name, style: const TextStyle(fontSize: 10), textAlign: TextAlign.center),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
