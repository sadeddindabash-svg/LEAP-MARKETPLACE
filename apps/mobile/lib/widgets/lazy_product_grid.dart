import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import 'product_card.dart';

/// Real, shared lazy-loading 2-column product grid, confirmed
/// directly with the person via a rendered mockup before building:
/// 2 cards side by side, next pair cascading below, more rows
/// fetched automatically as the person scrolls the outer page down
/// near this section's own bottom edge -- not a horizontal carousel,
/// and not a manual "load more" tap.
///
/// Used by SameModelSection, SameBrandSection, and
/// NewestProductsSection, which differ only in their own real
/// fetchPage function and header text -- this widget holds all the
/// shared real pagination/scroll-detection logic once.
class LazyProductGrid extends StatefulWidget {
  final Future<({List<Product> items, bool hasMore})> Function(int page) fetchPage;
  final String Function(List<Product> loadedSoFar) buildHeader;
  const LazyProductGrid({super.key, required this.fetchPage, required this.buildHeader});

  @override
  State<LazyProductGrid> createState() => _LazyProductGridState();
}

class _LazyProductGridState extends State<LazyProductGrid> {
  final List<Product> _items = [];
  int _nextPage = 1;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  bool _initialLoadDone = false;
  final GlobalKey _sentinelKey = GlobalKey();
  ScrollPosition? _scrollPosition;

  @override
  void initState() {
    super.initState();
    _loadMore();
  }

  // Real -- Scrollable.of(context) finds the nearest real ANCESTOR
  // scrollable (this page's own outer ListView) directly from this
  // descendant widget, confirmed as the correct real Flutter pattern
  // here: a real NotificationListener placed inside this widget would
  // never receive that outer ListView's own real scroll notifications
  // at all, since those bubble UP from the ListView to ITS OWN real
  // ancestors, never down into its children.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final newPosition = Scrollable.of(context).position;
    if (!identical(newPosition, _scrollPosition)) {
      _scrollPosition?.removeListener(_onScroll);
      _scrollPosition = newPosition;
      _scrollPosition!.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    _scrollPosition?.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (_isSentinelNearViewport()) _loadMore();
  }

  bool _isSentinelNearViewport() {
    final renderObject = _sentinelKey.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.attached) return false;
    final position = renderObject.localToGlobal(Offset.zero);
    final screenHeight = MediaQuery.of(context).size.height;
    // Real, deliberate 400px lookahead -- starts fetching the next
    // real page a little before the person actually reaches the
    // bottom, so the next real row is ready by the time they get
    // there rather than a visible pause.
    return position.dy < screenHeight + 400;
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() => _isLoadingMore = true);
    try {
      final result = await widget.fetchPage(_nextPage);
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _hasMore = result.hasMore;
        _nextPage++;
        _initialLoadDone = true;
      });
    } catch (_) {
      // Real, deliberate silent failure -- matches this app's own
      // established convention elsewhere on this page: a failed real
      // optional section simply stops loading further, rather than
      // surfacing a scary error on a secondary, non-critical part of
      // the page.
      if (mounted) setState(() { _hasMore = false; _initialLoadDone = true; });
    } finally {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Real, deliberate empty-state handling -- confirmed directly
    // with the person: still loading the first real batch, or
    // genuinely zero real results, both show nothing here, matching
    // every other real optional section's own established convention
    // on this page.
    if (!_initialLoadDone || _items.isEmpty) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.buildHeader(_items),
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink),
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              final cardWidth = (constraints.maxWidth - 10) / 2;
              final cardHeight = productCardHeightFor(cardWidth);
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _items.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: cardWidth / cardHeight,
                ),
                itemBuilder: (context, i) {
                  final p = _items[i];
                  return ProductCard(product: p, onTap: () => context.push('/product/${p.id}'));
                },
              );
            },
          ),
          // Real, invisible sentinel -- its own real on-screen
          // position (checked in _isSentinelNearViewport above) is
          // what actually triggers loading the next real page, not a
          // manual "load more" button.
          if (_hasMore) SizedBox(key: _sentinelKey, height: 1),
          if (_isLoadingMore)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            ),
        ],
      ),
    );
  }
}
