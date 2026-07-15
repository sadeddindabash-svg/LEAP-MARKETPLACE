import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/language_state.dart';
import '../../models/category.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';

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

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<ProductCategory>> _categoriesFuture;

  @override
  void initState() {
    super.initState();
    _categoriesFuture = ApiClient().fetchCategories();
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
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
            FutureBuilder<List<ProductCategory>>(
              future: _categoriesFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', style: const TextStyle(color: LeapColors.muted), textAlign: TextAlign.center),
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
                      onTap: () => context.push('/category/${c.id}', extra: label),
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
                            child: Icon(_iconForCategory(c.id), color: LeapColors.ink),
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
          ],
        ),
      ),
    );
  }
}
