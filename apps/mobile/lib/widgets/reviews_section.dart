import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../core/theme.dart';
import '../core/auth_state.dart';
import '../models/review.dart';
import '../services/api_client.dart';
import '../core/config/app_config.dart';

/// Real reviews section for the product detail screen (new). Shows the
/// real average rating and real approved reviews (see
/// ApiClient.fetchProductReviews — public, only ever real 'approved'
/// reviews). A logged-in buyer can write or edit their own real review;
/// CONFIRMED SCOPE: every submission requires real admin moderation
/// before it's ever visible, and whether a real verified purchase is
/// required is an admin-toggled setting, not fixed either way — if
/// this buyer hasn't received the product and that setting is on, the
/// real backend's own message is shown, not a generic error.
class ReviewsSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const ReviewsSection({super.key, required this.productId, required this.isAr});

  @override
  State<ReviewsSection> createState() => _ReviewsSectionState();
}

class _ReviewsSectionState extends State<ReviewsSection> {
  Future<ReviewsSummary>? _summaryFuture;
  MyReview? _myReview; // this buyer's own real review for this product, if any
  bool _showForm = false;
  int _formRating = 5;
  final _commentController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _loadedForProductId;

  // Real review photos (migration 031) -- confirmed cap of 3, optional.
  final List<String> _selectedPhotos = [];
  bool _isUploadingPhoto = false;

  void _ensureLoaded(String? token) {
    if (_loadedForProductId == widget.productId) return;
    _loadedForProductId = widget.productId;
    _summaryFuture = ApiClient().fetchProductReviews(widget.productId);
    if (token != null) {
      ApiClient().fetchMyReviews(token).then((reviews) {
        final mine = reviews.where((r) => r.productId == widget.productId).toList();
        if (mounted && mine.isNotEmpty) {
          setState(() {
            _myReview = mine.first;
            _formRating = _myReview!.rating;
            _commentController.text = _myReview!.comment ?? '';
            _selectedPhotos
              ..clear()
              ..addAll(_myReview!.photos);
          });
        }
      }).catchError((_) {}); // real, non-fatal -- the public summary above still renders either way
    }
  }

  Future<void> _submit(String token) async {
    setState(() { _isSubmitting = true; _errorMessage = null; });
    try {
      final result = await ApiClient().submitReview(
        token,
        productId: widget.productId,
        rating: _formRating,
        comment: _commentController.text.trim(),
        photos: _selectedPhotos,
      );
      if (!mounted) return;
      setState(() {
        _myReview = result;
        _showForm = false;
        _loadedForProductId = null; // force a real refresh of the public summary below
      });
      _ensureLoaded(token);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  static const _maxReviewPhotos = 3;

  Future<void> _pickAndUploadPhoto(String token) async {
    if (_selectedPhotos.length >= _maxReviewPhotos) return;
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _isUploadingPhoto = true);
    try {
      final url = await ApiClient().uploadReviewPhoto(token, picked);
      if (mounted) setState(() => _selectedPhotos.add(url));
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _removePhoto(int index) {
    setState(() => _selectedPhotos.removeAt(index));
  }

  // Real report/flag a review (migration 033) -- confirmed scope:
  // requires a real short reason, one real flag per buyer per review.
  Future<void> _showReportDialog(String token, int reviewId) async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(widget.isAr ? 'الإفادة عن هذا التقييم' : 'Report this review'),
        content: TextField(
          controller: reasonController,
          maxLines: 2,
          decoration: InputDecoration(hintText: widget.isAr ? 'سبب الإفادة' : 'Why are you reporting this?'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(widget.isAr ? 'إلغاء' : 'Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(reasonController.text.trim()),
            child: Text(widget.isAr ? 'إرسال' : 'Submit'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty || !mounted) return;
    try {
      await ApiClient().flagReview(token, reviewId, reason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(widget.isAr ? 'تم إرسال إفادتك.' : 'Your report was submitted.')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  String get _lReviews => widget.isAr ? 'التقييمات' : 'Reviews';
  String get _lNoReviews => widget.isAr ? 'لا توجد تقييمات حتى الآن.' : 'No reviews yet.';
  String get _lWriteReview => widget.isAr ? 'اكتب تقييمًا' : 'Write a review';
  String get _lYourReviewPending => widget.isAr ? 'تقييمك قيد المراجعة.' : 'Your review is awaiting review.';
  String get _lYourReviewRejected => widget.isAr ? 'لم تتم الموافقة على تقييمك.' : 'Your review was not approved.';
  String get _lEditReview => widget.isAr ? 'تعديل تقييمك' : 'Edit your review';
  String get _lCommentHint => widget.isAr ? 'اكتب تعليقًا (اختياري)' : 'Add a comment (optional)';
  String get _lSubmit => widget.isAr ? 'إرسال' : 'Submit';
  String get _lCancel => widget.isAr ? 'إلغاء' : 'Cancel';
  String get _lLoginToReview => widget.isAr ? 'سجّل الدخول لكتابة تقييم.' : 'Log in to write a review.';

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    _ensureLoaded(auth.token);

    return FutureBuilder<ReviewsSummary>(
      future: _summaryFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return const SizedBox.shrink(); // real, non-fatal -- the rest of the product page still works
        }
        final summary = snapshot.data!;

        return Container(
          margin: const EdgeInsets.only(top: 20),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(_lReviews, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(width: 8),
                  if (summary.averageRating != null) ...[
                    _StarRow(rating: summary.averageRating!.round()),
                    const SizedBox(width: 6),
                    Text('${summary.averageRating!.toStringAsFixed(1)} (${summary.reviewCount})', style: const TextStyle(color: LeapColors.muted, fontSize: 12.5)),
                  ],
                ],
              ),
              const SizedBox(height: 12),

              if (summary.reviews.isEmpty)
                Text(_lNoReviews, style: const TextStyle(color: LeapColors.muted, fontSize: 13))
              else
                ...summary.reviews.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              _StarRow(rating: r.rating, size: 13),
                              const SizedBox(width: 8),
                              Text(r.buyerName ?? (widget.isAr ? 'مشترٍ' : 'Buyer'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                            ],
                          ),
                          if (r.comment != null && r.comment!.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(r.comment!, style: const TextStyle(fontSize: 13)),
                          ],
                          if (r.photos.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                for (final url in r.photos)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.network('${AppConfig.apiBaseUrl}$url', width: 56, height: 56, fit: BoxFit.cover),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          if (auth.isLoggedIn) ...[
                            const SizedBox(height: 4),
                            GestureDetector(
                              onTap: () => _showReportDialog(auth.token!, r.id),
                              child: Text(
                                widget.isAr ? 'إفادة' : 'Report',
                                style: const TextStyle(fontSize: 11.5, color: LeapColors.muted, decoration: TextDecoration.underline),
                              ),
                            ),
                          ],
                        ],
                      ),
                    )),

              const Divider(height: 24),

              if (_myReview != null && !_showForm) ...[
                if (_myReview!.status == 'pending')
                  Text(_lYourReviewPending, style: const TextStyle(color: LeapColors.amber, fontSize: 12.5, fontWeight: FontWeight.w600)),
                if (_myReview!.status == 'rejected')
                  Text(_lYourReviewRejected, style: const TextStyle(color: LeapColors.muted, fontSize: 12.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: () => setState(() => _showForm = true), child: Text(_lEditReview)),
              ] else if (!_showForm && auth.isLoggedIn) ...[
                OutlinedButton(onPressed: () => setState(() => _showForm = true), child: Text(_lWriteReview)),
              ] else if (!auth.isLoggedIn) ...[
                Text(_lLoginToReview, style: const TextStyle(color: LeapColors.muted, fontSize: 12.5)),
              ],

              if (_showForm) ...[
                _StarPicker(rating: _formRating, onChanged: (r) => setState(() => _formRating = r)),
                const SizedBox(height: 10),
                TextField(
                  controller: _commentController,
                  maxLines: 3,
                  decoration: InputDecoration(hintText: _lCommentHint, border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: [
                    for (var i = 0; i < _selectedPhotos.length; i++)
                      Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network('${AppConfig.apiBaseUrl}${_selectedPhotos[i]}', width: 64, height: 64, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: -6, right: -6,
                            child: IconButton(
                              icon: const Icon(Icons.cancel, size: 18, color: LeapColors.muted),
                              onPressed: () => _removePhoto(i),
                              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              padding: EdgeInsets.zero,
                            ),
                          ),
                        ],
                      ),
                    if (_selectedPhotos.length < _maxReviewPhotos)
                      InkWell(
                        onTap: _isUploadingPhoto ? null : () => _pickAndUploadPhoto(auth.token!),
                        child: Container(
                          width: 64, height: 64,
                          decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(8)),
                          child: _isUploadingPhoto
                              ? const Center(child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                              : const Icon(Icons.add_a_photo_outlined, color: LeapColors.muted, size: 22),
                        ),
                      ),
                  ],
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 8),
                  Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _submit(auth.token!),
                      child: _isSubmitting
                          ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(_lSubmit),
                    ),
                    const SizedBox(width: 8),
                    TextButton(onPressed: () => setState(() => _showForm = false), child: Text(_lCancel)),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _StarRow extends StatelessWidget {
  final int rating;
  final double size;
  const _StarRow({required this.rating, this.size = 16});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) => Icon(
            i < rating ? Icons.star : Icons.star_border,
            size: size,
            color: LeapColors.amber,
          )),
    );
  }
}

/// A real, tappable 1-5 star picker for writing/editing a review.
class _StarPicker extends StatelessWidget {
  final int rating;
  final ValueChanged<int> onChanged;
  const _StarPicker({required this.rating, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) => GestureDetector(
            onTap: () => onChanged(i + 1),
            child: Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Icon(
                i < rating ? Icons.star : Icons.star_border,
                size: 28,
                color: LeapColors.amber,
              ),
            ),
          )),
    );
  }
}
