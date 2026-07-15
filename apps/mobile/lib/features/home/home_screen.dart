import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../widgets/plate_chip.dart';

const List<({String id, String stringKey, IconData icon})> kCategories = [
  (id: 'brake', stringKey: 'cat_brake', icon: Icons.album_outlined),
  (id: 'engine', stringKey: 'cat_engine', icon: Icons.settings_outlined),
  (id: 'electrical', stringKey: 'cat_electrical', icon: Icons.electrical_services_outlined),
  (id: 'filters', stringKey: 'cat_filters', icon: Icons.filter_alt_outlined),
  (id: 'suspension', stringKey: 'cat_suspension', icon: Icons.build_outlined),
  (id: 'lighting', stringKey: 'cat_lighting', icon: Icons.lightbulb_outline),
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
                hintText: tr(context, 'search_hint'),
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.directions_car_outlined),
                title: Text(tr(context, 'shopping_for'), style: const TextStyle(fontSize: 11, color: LeapColors.muted)),
                subtitle: const PlateChip(text: 'BMW 1 (F20) · 118d 2.0', small: true),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/garage'),
              ),
            ),
            const SizedBox(height: 20),
            Text(tr(context, 'shop_by_category'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: kCategories
                  .map((c) {
                    // Computed HERE, during build (tr() uses context.watch,
                    // which throws a real Flutter framework error if called
                    // later inside onTap instead) — this was a real bug:
                    // tapping a category silently did nothing, because the
                    // exception inside onTap prevented context.push from
                    // ever running.
                    final categoryLabel = tr(context, c.stringKey);
                    return GestureDetector(
                        onTap: () => context.push('/category/${c.id}', extra: categoryLabel),
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
                            Text(categoryLabel, style: const TextStyle(fontSize: 10), textAlign: TextAlign.center),
                          ],
                        ),
                      );
                  })
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
