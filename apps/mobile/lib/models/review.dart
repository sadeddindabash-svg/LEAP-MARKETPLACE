/// A single real, approved review on a product — see
/// services/api/src/modules/reviews/routes.js and
/// GET /catalog/products/:id/reviews (public, only ever returns real
/// 'approved' reviews, never pending or rejected ones).
class Review {
  final int id;
  final String? buyerName;
  final int rating;
  final String? comment;
  final DateTime createdAt;
  final List<String> photos;

  Review({
    required this.id,
    required this.buyerName,
    required this.rating,
    required this.comment,
    required this.createdAt,
    this.photos = const [],
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: json['id'] as int,
        buyerName: json['buyerName'] as String?,
        rating: json['rating'] as int,
        comment: json['comment'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        photos: (json['photos'] as List?)?.cast<String>() ?? const [],
      );
}

/// The real average rating + real approved review list for one product.
/// A null [averageRating] means genuinely zero real approved reviews
/// exist yet — never a fabricated placeholder rating.
class ReviewsSummary {
  final double? averageRating;
  final int reviewCount;
  final List<Review> reviews;

  ReviewsSummary({required this.averageRating, required this.reviewCount, required this.reviews});

  factory ReviewsSummary.fromJson(Map<String, dynamic> json) => ReviewsSummary(
        averageRating: json['averageRating'] == null ? null : (json['averageRating'] as num).toDouble(),
        reviewCount: json['reviewCount'] as int,
        reviews: (json['reviews'] as List).map((e) => Review.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

/// A buyer's own real review, any real status ('pending'/'approved'/
/// 'rejected') — see GET /reviews/me. Used so a buyer can see where
/// their own submitted review currently stands, even before an admin
/// has moderated it.
class MyReview {
  final int id;
  final String productId;
  final int rating;
  final String? comment;
  final String status;
  final List<String> photos;

  MyReview({required this.id, required this.productId, required this.rating, required this.comment, required this.status, this.photos = const []});

  factory MyReview.fromJson(Map<String, dynamic> json) => MyReview(
        id: json['id'] as int,
        productId: json['productId'] as String,
        rating: json['rating'] as int,
        comment: json['comment'] as String?,
        status: json['status'] as String,
        photos: (json['photos'] as List?)?.cast<String>() ?? const [],
      );
}
