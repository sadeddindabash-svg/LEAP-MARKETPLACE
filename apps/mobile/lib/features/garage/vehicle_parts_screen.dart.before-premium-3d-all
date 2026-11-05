import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/language_state.dart';
import '../../models/product.dart';
import '../../models/vehicle.dart';
import '../../models/vehicle_parts_filter.dart';
import '../../services/api_client.dart';
import '../../widgets/product_card.dart';
import '../../widgets/skeleton.dart';

/// "Parts for your car" (new): what "View compatible parts" in My garage opens. The parts the server says fit THAT car (the generation and year of the garage entry whose button was pressed), as the same cards the rest of the app uses,
/// with the number that fit and category chips to narrow them. "Change" goes back to the garage to pick another car.
class VehiclePartsScreen extends StatefulWidget {
  final Vehicle vehicle;
  const VehiclePartsScreen({super.key, required this.vehicle});

  @override
  State<VehiclePartsScreen> createState() => _VehiclePartsScreenState();
}

class _VehiclePartsScreenState extends State<VehiclePartsScreen> {
  Future<List<Product>>? _future;
  String? _loadedForLanguage;
  String? _category; // null = every category

  void _ensureLoaded(String language) {
    if (_loadedForLanguage == language) return;
    _loadedForLanguage = language;
    _category = null;
    _future = ApiClient().fetchProducts(generationId: widget.vehicle.generationId, year: widget.vehicle.year, lang: language, limit: 200);
  }

  String _name(bool isAr) {
    final v = widget.vehicle;
    final brand = (isAr && (v.brandAr ?? '').isNotEmpty) ? v.brandAr! : v.brand;
    final model = (isAr && (v.modelAr ?? '').isNotEmpty) ? v.modelAr! : v.model;
    return '$brand $model · ${v.year}';
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    _ensureLoaded(isAr ? 'ar' : 'en');
    final v = widget.vehicle;
    final version = v.hasVersion ? v.versionNameFor(isAr) : null;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'vparts_title'))),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
            decoration: BoxDecoration(color: palette.card, border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_name(isAr), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: palette.ink)),
                      if ((version ?? '').isNotEmpty) Text(version!, style: TextStyle(fontSize: 12.5, color: palette.muted)),
                    ],
                  ),
                ),
                TextButton(onPressed: () => context.pop(), child: Text(tr(context, 'vparts_change'), style: TextStyle(color: palette.signal, fontWeight: FontWeight.w700))),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Product>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) return const ProductGridSkeleton();
                if (snapshot.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(tr(context, 'could_not_load_products'), textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
                          const SizedBox(height: 12),
                          OutlinedButton(onPressed: () => setState(() => _loadedForLanguage = null), child: Text(tr(context, 'retry'))),
                        ],
                      ),
                    ),
                  );
                }
                final all = snapshot.data ?? [];
                if (all.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(tr(context, 'vparts_none'), textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
                    ),
                  );
                }
                final chips = categoryCounts(all.map((p) => p.category));
                final shown = filterByCategory<Product>(all, _category, (p) => p.category);
                return Column(
                  children: [
                    if (chips.length > 1)
                      SizedBox(
                        height: 44,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                          children: [
                            Padding(
                              padding: const EdgeInsetsDirectional.only(end: 8),
                              child: ChoiceChip(label: Text('${tr(context, 'vparts_all')} (${all.length})'), selected: _category == null, onSelected: (_) => setState(() => _category = null)),
                            ),
                            for (final c in chips)
                              Padding(
                                padding: const EdgeInsetsDirectional.only(end: 8),
                                child: ChoiceChip(label: Text('${prettyCategory(c.key)} (${c.value})'), selected: _category == c.key, onSelected: (_) => setState(() => _category = c.key)),
                              ),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(shown.length == 1 ? tr(context, 'vparts_one') : tr(context, 'vparts_count').replaceAll('{n}', '${shown.length}'), style: TextStyle(fontSize: 13, color: palette.muted)),
                      ),
                    ),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final cardWidth = (constraints.maxWidth - 16 * 2 - 10) / 2;
                          final cardHeight = productCardHeightFor(cardWidth);
                          return GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: cardWidth / cardHeight),
                            itemCount: shown.length,
                            itemBuilder: (context, i) => ProductCard(product: shown[i], onTap: () => context.push('/product/${shown[i].id}')),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
