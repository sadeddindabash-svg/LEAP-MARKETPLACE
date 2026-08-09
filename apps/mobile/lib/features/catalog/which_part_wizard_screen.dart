import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/language_state.dart';
import '../../models/category.dart';
import '../../services/api_client.dart';

/// Real "which part do I need" wizard (#61) -- a structured,
/// step-by-step decision tree using the real category/part taxonomy
/// directly (the same real data Shop by Category already browses),
/// distinct from Shop by Symptom (#15's own keyword-search shortcut
/// for a described symptom). This one is for a person who already
/// knows roughly what needs attention but doesn't know the right
/// term for it -- guided by real category names first, then real
/// part names within that category, landing on the same real
/// category product list either way.
class WhichPartWizardScreen extends StatefulWidget {
  const WhichPartWizardScreen({super.key});

  @override
  State<WhichPartWizardScreen> createState() => _WhichPartWizardScreenState();
}

class _WhichPartWizardScreenState extends State<WhichPartWizardScreen> {
  ProductCategory? _selectedCategory;
  Future<List<ProductCategory>>? _categoriesFuture;
  Future<List<ProductCategory>>? _partsFuture;

  @override
  void initState() {
    super.initState();
    _categoriesFuture = ApiClient().fetchCategories();
  }

  void _selectCategory(ProductCategory category) {
    setState(() {
      _selectedCategory = category;
      _partsFuture = ApiClient().fetchPartsForCategory(category.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final palette = LeapPalette.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(isAr ? 'أي قطعة أحتاج؟' : 'Which part do I need?'),
        leading: _selectedCategory != null
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selectedCategory = null))
            : null,
      ),
      body: _selectedCategory == null ? _buildCategoryStep(isAr, palette) : _buildPartStep(isAr, palette),
    );
  }

  Widget _buildCategoryStep(bool isAr, LeapPalette palette) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            isAr ? 'ما المنطقة في سيارتك التي تحتاج انتباهًا؟' : 'What area of your car needs attention?',
            style: TextStyle(color: palette.muted, fontSize: 13),
          ),
        ),
        Expanded(
          child: FutureBuilder<List<ProductCategory>>(
            future: _categoriesFuture,
            builder: (context, snapshot) {
              if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
              final categories = snapshot.data!;
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final c = categories[i];
                  return Card(
                    child: ListTile(
                      leading: Icon(Icons.build_outlined, color: palette.signal),
                      title: Text(c.displayName(isAr), style: TextStyle(fontWeight: FontWeight.w600, color: palette.ink)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _selectCategory(c),
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

  Widget _buildPartStep(bool isAr, LeapPalette palette) {
    final category = _selectedCategory!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            isAr ? 'ما القطعة المحددة في "${category.displayName(true)}"؟' : 'Which specific part in "${category.nameEn}"?',
            style: TextStyle(color: palette.muted, fontSize: 13),
          ),
        ),
        Expanded(
          child: FutureBuilder<List<ProductCategory>>(
            future: _partsFuture,
            builder: (context, snapshot) {
              if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
              final parts = snapshot.data!;
              if (parts.isEmpty) {
                // Real, honest fallback: this real category genuinely
                // has no real sub-parts on record -- go straight to
                // its real product list instead of showing an empty
                // step.
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: ElevatedButton(
                      onPressed: () => context.push('/category/${category.id}', extra: {'categoryName': category.nameEn}),
                      child: Text(isAr ? 'عرض المنتجات' : 'View products'),
                    ),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: parts.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final p = parts[i];
                  return Card(
                    child: ListTile(
                      title: Text(p.displayName(isAr), style: TextStyle(fontWeight: FontWeight.w600, color: palette.ink)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/category/${category.id}', extra: {'categoryName': category.nameEn, 'part': p.nameEn}),
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
