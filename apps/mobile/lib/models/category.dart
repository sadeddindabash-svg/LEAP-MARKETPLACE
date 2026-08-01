/// Real, admin-managed product category — fetched from
/// GET /catalog/categories (see services/api/src/modules/catalog/routes.js),
/// replacing what used to be a hardcoded list in home_screen.dart. An
/// admin adding a new category via the admin dashboard's Categories page
/// shows up here automatically, no app code change needed.
class ProductCategory {
  final String id;
  final String nameEn;
  final String? nameAr;
  // Real, admin-uploaded category photo (new) -- closes a real gap:
  // the backend's own toCategoryDto already included this real field
  // for every buyer-facing request, the mobile app just never parsed
  // or displayed it before.
  final String? photoUrl;

  const ProductCategory({required this.id, required this.nameEn, this.nameAr, this.photoUrl});

  /// Real name in whichever language is currently selected, falling back
  /// to English if no Arabic translation exists for this category yet.
  String displayName(bool isArabic) => (isArabic && nameAr != null && nameAr!.isNotEmpty) ? nameAr! : nameEn;

  factory ProductCategory.fromJson(Map<String, dynamic> json) => ProductCategory(
        id: json['id'] as String,
        nameEn: json['nameEn'] as String,
        nameAr: json['nameAr'] as String?,
        photoUrl: json['photoUrl'] as String?,
      );
}
