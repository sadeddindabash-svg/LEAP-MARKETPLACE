/// Real saved search (migration 039) -- a buyer's own saved search
/// term/category, checked periodically on the backend for genuinely
/// new matching products, notifying the buyer when one appears.
class SavedSearch {
  final int id;
  final String label;
  final String? searchTerm;
  final String? category;
  final DateTime createdAt;
  final DateTime? lastCheckedAt;

  SavedSearch({
    required this.id,
    required this.label,
    required this.searchTerm,
    required this.category,
    required this.createdAt,
    required this.lastCheckedAt,
  });

  factory SavedSearch.fromJson(Map<String, dynamic> json) => SavedSearch(
        id: json['id'] as int,
        label: json['label'] as String,
        searchTerm: json['searchTerm'] as String?,
        category: json['category'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        lastCheckedAt: json['lastCheckedAt'] == null ? null : DateTime.parse(json['lastCheckedAt'] as String),
      );
}
