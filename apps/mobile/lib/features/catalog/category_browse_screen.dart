import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../widgets/slide_in.dart';
import '../../widgets/premium.dart';
import '../../core/app_strings.dart';
import '../../core/language_state.dart';
import '../../models/category.dart';
import '../../services/api_client.dart';
import '../../widgets/skeleton.dart';

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
              : const ListSkeleton())
          : SlideInScope(child: Row(
              children: [
                // Real sidebar -- every major category, tappable.
                // Confirmed with the person via mockup: the side column and the parts at 90%, each section shorter, the parts' arrow at the very end,
                // 6 between the cards and between the two columns, and the first part's top level with the chosen section's card.
                // 96 wide with less room inside each section, so the longest names (Transmission, الإكسسوارات) fit on one line
                SizedBox(
                  width: 96,
                  child: Container(
                    color: LeapPalette.of(context).chalk,
                    child: ListView.builder(
                      padding: const EdgeInsets.only(top: 3),
                      itemCount: _categories!.length,
                      itemBuilder: (context, i) {
                        final c = _categories![i];
                        final selected = c.id == _selectedCategoryId;
                        final palette = LeapPalette.of(context);
                        return SlideIn(index: i, child: InkWell(
                          onTap: () => _selectCategory(c.id),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 5),
                            // the chosen section rises out of the side column as a raised card
                            margin: selected ? const EdgeInsets.symmetric(horizontal: 4, vertical: 3) : EdgeInsets.zero,
                            decoration: selected ? Premium.card(context, radius: 12) : const BoxDecoration(),
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
                                  width: 48,
                                  height: 48,
                                  margin: const EdgeInsets.only(bottom: 4),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: palette.chalk,
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: c.photoUrl != null
                                      ? CachedNetworkImage(imageUrl: ApiClient.resolveMediaUrl(c.photoUrl!), fit: BoxFit.cover, fadeInDuration: const Duration(milliseconds: 300), errorWidget: (context, url, error) => Icon(Icons.category_outlined, size: 20, color: palette.muted))
                                      : Icon(Icons.category_outlined, size: 20, color: selected ? palette.signal : palette.muted),
                                ),
                                Text(
                                  c.displayName(isAr),
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  style: TextStyle(
                                    fontSize: 10.4,
                                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                                    color: selected ? palette.signal : palette.ink,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ));
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
                        return const ListSkeleton();
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
                      // the parts slide in again every time a section is chosen
                      return SlideInScope(key: ValueKey(_selectedCategoryId), child: ListView.separated(
                        padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 12, 12),
                        itemCount: parts.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 6),
                        itemBuilder: (context, i) {
                          final part = parts[i];
                          final partLabel = part.displayName(isAr);
                          final categoryLabel = (selectedCategory != null && selectedCategory.id.isNotEmpty) ? selectedCategory.displayName(isAr) : '';
                          return SlideIn(index: i, child: PressDown(child: Container(
                            decoration: Premium.card(context),
                            // the photo 6 from the card's edge, the name with all the room, the arrow at the very end
                            child: Material(
                              type: MaterialType.transparency,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => context.push(
                                  '/category/$_selectedCategoryId',
                                  extra: {'categoryName': categoryLabel, 'part': part.nameEn, 'partLabel': partLabel},
                                ),
                                child: Padding(
                                  padding: const EdgeInsetsDirectional.fromSTEB(6, 6, 4, 6),
                                  child: Row(
                                    children: [
                                      ClipOval(
                                        child: part.photoUrl != null
                                            ? CachedNetworkImage(
                                                imageUrl: ApiClient.resolveMediaUrl(part.photoUrl!),
                                                width: 47,
                                                height: 47,
                                                fit: BoxFit.cover,
                                                errorWidget: (context, url, error) => Container(width: 47, height: 47, color: palette.chalk, child: Icon(Icons.build_outlined, size: 21, color: palette.muted)),
                                              )
                                            : Container(width: 47, height: 47, color: palette.chalk, child: Icon(Icons.build_outlined, size: 21, color: palette.muted)),
                                      ),
                                      const SizedBox(width: 9),
                                      Expanded(child: Text(partLabel, style: TextStyle(fontSize: 13, height: 1.25, color: palette.ink))),
                                      Icon(Icons.chevron_right, size: 20, color: palette.muted),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          )));
                        },
                      ));
                    },
                  ),
                ),
              ],
            )),
    );
  }
}
