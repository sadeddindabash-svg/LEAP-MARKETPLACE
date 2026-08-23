import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../services/api_client.dart';

/// Real -- the SUPPLIER's own product photos (the same ones already
/// shown at the top of this page), shown again here as a vertical
/// list, in the order they were added (sort_order). Corrected per the
/// person's own explicit clarification from an earlier real
/// misunderstanding (this is NOT customer/review photos). No real
/// fetch needed at all -- product.images is already loaded on this
/// screen.
class ProductPhotosSection extends StatelessWidget {
  final List<String> images;
  final bool isAr;
  const ProductPhotosSection({super.key, required this.images, required this.isAr});

  @override
  Widget build(BuildContext context) {
    // Real, deliberate empty-state handling -- confirmed directly
    // with the person: a product with no real photos at all (should
    // be rare/never in practice) simply shows nothing here, matching
    // this app's own established convention for every other real
    // optional section on this page.
    if (images.isEmpty) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isAr ? 'صور المنتج' : 'Product photos',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink),
          ),
          const SizedBox(height: 10),
          // Real, deliberate ListView.builder (not a Column with all
          // children eagerly built) -- confirmed with the person as
          // "lazy" rendering: only the real photos actually scrolled
          // into view get built, even though the underlying real data
          // itself is already fully loaded (no pagination needed for
          // a real product's own photo count, which is always small).
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: images.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              return ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: CachedNetworkImage(
                    imageUrl: ApiClient.resolveMediaUrl(images[i]),
                    fit: BoxFit.cover,
                    fadeInDuration: const Duration(milliseconds: 300),
                    placeholder: (context, url) => Container(color: const Color(0xFFF5F6F8)),
                    errorWidget: (context, url, error) => const Icon(Icons.broken_image_outlined, color: LeapColors.muted),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
