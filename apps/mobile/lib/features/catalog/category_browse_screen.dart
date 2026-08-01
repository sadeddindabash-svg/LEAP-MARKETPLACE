import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/language_state.dart';
import '../../models/category.dart';
import '../../services/api_client.dart';

/// Confirmed requirement: a sidebar listing every real major category;
/// the main area shows the real Parts within whichever category is
/// currently selected; tapping a Part moves to the real product list
/// for exactly that Part (see CategoryScreen's new `part` parameter,
/// using the backend's real exact-match filter).
///
/// Categories and Parts are both real, admin-managed reference data
/// (see services/api/README.md's "Category + parts reference lists"
/// section) — an admin adding a category or part shows up here without
/// an app code change.
class CategoryBrowseScreen extends StatefulWidget {
  final String? initialCategoryId;
  const CategoryBrowseScreen({super.key, this.initialCategoryId});

  @override
  State<CategoryBrowseScreen> createState() => _CategoryBrowseScreenState();
}

class _CategoryBrowseScreenState extends State<CategoryBrowseScreen> {
  List<ProductCategory>? _categories;
  String? _selectedCategoryId;
  Future<List<ProductCategory>>? _partsFuture;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.initialCategoryId; // may be null -- resolved once categories load, see below
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await ApiClient().fetchCategories();
      if (mounted) {
        setState(() {
          _categories = categories;
          // Confirmed: the "Shop" tab enters this same screen with no
          // specific starting category (unlike tapping a category icon
          // on Home) -- default to the real first category rather than
          // requiring a caller to always know one in advance.
          _selectedCategoryId ??= categories.isNotEmpty ? categories.first.id : null;
          if (_selectedCategoryId != null) {
            _partsFuture = ApiClient().fetchPartsForCategory(_selectedCategoryId!);
          }
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  void _selectCategory(String categoryId) {
    setState(() {
      _selectedCategoryId = categoryId;
      _partsFuture = ApiClient().fetchPartsForCategory(categoryId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isAr = context.watch<LanguageState>().isArabic;
    final selectedCategory = _categories?.firstWhere(
      (c) => c.id == _selectedCategoryId,
      orElse: () => const ProductCategory(id: '', nameEn: ''),
    );

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'shop_by_category'))),
      body: _categories == null
          ? (_error != null
              ? Center(child: Text(_error!, style: TextStyle(color: LeapPalette.of(context).muted)))
              : const Center(child: CircularProgressIndicator()))
          : Row(
              children: [
                // Real sidebar -- every major category, tappable.
                SizedBox(
                  width: 96,
                  child: Container(
                    color: LeapPalette.of(context).chalk,
                    child: ListView.builder(
                      itemCount: _categories!.length,
                      itemBuilder: (context, i) {
                        final c = _categories![i];
                        final selected = c.id == _selectedCategoryId;
                        final palette = LeapPalette.of(context);
                        return InkWell(
                          onTap: () => _selectCategory(c.id),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                            decoration: BoxDecoration(
                              color: selected ? palette.card : Colors.transparent,
                              border: Border(left: BorderSide(color: selected ? palette.signal : Colors.transparent, width: 3)),
                            ),
                            child: Column(
                              children: [
                                // Real category photo (new) -- closes a
                                // real gap: the backend's own real,
                                // admin-uploaded photoUrl field existed
                                // already, the app just never showed it.
                                // Falls back to a plain icon when a real
                                // category genuinely has no photo
                                // uploaded yet (most don't, currently).
                                Container(
                                  width: 44,
                                  height: 44,
                                  margin: const EdgeInsets.only(bottom: 6),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white,
                                    border: Border.all(color: selected ? palette.signal : palette.line),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: c.photoUrl != null
                                      ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!), fit: BoxFit.cover, errorWidget: (context, url, error) => Icon(Icons.category_outlined, size: 18, color: palette.muted))
                                      : Icon(Icons.category_outlined, size: 18, color: selected ? palette.signal : palette.muted),
                                ),
                                Text(
                                  c.displayName(isAr),
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                                    color: selected ? palette.signal : palette.ink,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                VerticalDivider(width: 1, color: LeapPalette.of(context).line),
                // Real parts within the selected category.
                Expanded(
                  child: FutureBuilder<List<ProductCategory>>(
                    future: _partsFuture,
                    builder: (context, snapshot) {
                      final palette = LeapPalette.of(context);
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (snapshot.hasError) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Text('${tr(context, 'could_not_load_products')}\n${snapshot.error}', textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
                          ),
                        );
                      }
                      final parts = snapshot.data ?? [];
                      if (parts.isEmpty) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Text(tr(context, 'no_parts_in_category'), textAlign: TextAlign.center, style: TextStyle(color: palette.muted)),
                          ),
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: parts.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final part = parts[i];
                          final partLabel = part.displayName(isAr);
                          final categoryLabel = (selectedCategory != null && selectedCategory.id.isNotEmpty) ? selectedCategory.displayName(isAr) : '';
                          return Container(
                            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: palette.line)),
                            child: ListTile(
                              title: Text(partLabel, style: TextStyle(color: palette.ink)),
                              trailing: Icon(Icons.chevron_right, color: palette.muted),
                              onTap: () => context.push(
                                '/category/$_selectedCategoryId',
                                extra: {'categoryName': categoryLabel, 'part': part.nameEn},
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
