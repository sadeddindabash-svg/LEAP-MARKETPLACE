import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'product_card.dart';

/// Real skeleton loading placeholders (new) -- closes a real gap: this
/// app only ever used a plain spinner while loading, never a content-
/// shaped placeholder. Deliberately built with only Flutter's own
/// built-in animation (a simple, repeating opacity pulse via
/// AnimationController) rather than adding a new shimmer package
/// dependency -- no new pub dependency to verify/install, and no risk
/// of a version mismatch on a machine this session can't directly
/// test on.

/// A single pulsing grey box -- the real building block every skeleton
/// layout below is made of.
class SkeletonBox extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadiusGeometry borderRadius;

  const SkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = const BorderRadius.all(Radius.circular(6)),
  });

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.4, end: 1.0).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) => Opacity(
        opacity: _opacity.value,
        child: Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: widget.borderRadius),
        ),
      ),
    );
  }
}

/// A single skeleton product card -- matches ProductCard's own real
/// layout closely enough to feel like a genuine placeholder for it,
/// not a generic unrelated shape.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(aspectRatio: 1, child: SkeletonBox(width: double.infinity, height: double.infinity, borderRadius: BorderRadius.circular(10))),
        const SizedBox(height: 8),
        const SkeletonBox(width: double.infinity, height: 12),
        const SizedBox(height: 6),
        const SkeletonBox(width: 80, height: 12),
        const SizedBox(height: 8),
        const SkeletonBox(width: 60, height: 14),
      ],
    );
  }
}

/// A real grid of skeleton product cards -- matches the real product
/// grid's own 2-column layout, so the loading state doesn't visually
/// jump when the real content replaces it.
class ProductGridSkeleton extends StatelessWidget {
  final int itemCount;
  const ProductGridSkeleton({super.key, this.itemCount = 6});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, gridConstraints) {
        final cardWidth = (gridConstraints.maxWidth - 16 * 2 - 10) / 2;
        final cardHeight = productCardHeightFor(cardWidth);
        return GridView.builder(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: cardWidth / cardHeight,
      ),
      itemCount: itemCount,
      itemBuilder: (context, i) => const ProductCardSkeleton(),
        );
      },
    );
  }
}

/// A single skeleton list row -- for order/notification/ticket-style
/// list screens (a title-shaped bar, a subtitle-shaped bar, a trailing
/// badge-shaped box).
class ListRowSkeleton extends StatelessWidget {
  const ListRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SkeletonBox(width: 100, height: 14),
                  const SizedBox(height: 8),
                  SkeletonBox(width: MediaQuery.of(context).size.width * 0.4, height: 11),
                ],
              ),
            ),
            const SizedBox(width: 12),
            const SkeletonBox(width: 60, height: 20, borderRadius: BorderRadius.all(Radius.circular(10))),
          ],
        ),
      ),
    );
  }
}

/// A real list of skeleton rows -- for order/notification/ticket-style
/// list screens while their real data is loading.
class ListSkeleton extends StatelessWidget {
  final int itemCount;
  const ListSkeleton({super.key, this.itemCount = 6});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: itemCount,
      itemBuilder: (context, i) => const ListRowSkeleton(),
    );
  }
}
