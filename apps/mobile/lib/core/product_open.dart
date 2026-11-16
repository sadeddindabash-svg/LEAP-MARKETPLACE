import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// "Open container" (confirmed with the person via mockup): a product card remembers where it is on the screen just before it opens its product, and the
/// product page grows out of that card (its corners straightening as it fills the screen) and shrinks back into it on the way back. A product opened any
/// other way (a link, a notification, a screen that is not a card) gets the usual page.
class ProductOpen {
  static Rect? _origin;
  static DateTime? _at;
  // the decision for each product page, kept by its page key: the router can build the same page again, and it must stay the same kind of page
  static final Map<Object, Rect?> _byPage = {};

  /// Called by a card just before it opens its product.
  static void remember(BuildContext context) {
    final box = context.findRenderObject();
    if (box is RenderBox && box.attached && box.hasSize) {
      _origin = box.localToGlobal(Offset.zero) & box.size;
      _at = DateTime.now();
    }
  }

  static Rect? _take() {
    final origin = _origin;
    final fresh = _at != null && DateTime.now().difference(_at!) < const Duration(seconds: 2);
    _origin = null;
    _at = null;
    return fresh ? origin : null;
  }

  /// The product route's page.
  static Page<void> page(GoRouterState state, Widget child) {
    final key = state.pageKey;
    final origin = _byPage.containsKey(key.value) ? _byPage[key.value] : (_byPage[key.value] = _take());
    if (_byPage.length > 40) _byPage.remove(_byPage.keys.first);
    if (origin == null) return MaterialPage<void>(key: key, child: child);
    return CustomTransitionPage<void>(
      key: key,
      child: child,
      transitionDuration: const Duration(milliseconds: 380),
      reverseTransitionDuration: const Duration(milliseconds: 320),
      transitionsBuilder: (context, animation, secondaryAnimation, child) => _Grow(origin: origin, animation: animation, child: child),
    );
  }
}

/// The page drawn at its full size, seen through a rounded window that grows from the card to the whole screen; the page's content fades in as it grows.
class _Grow extends StatelessWidget {
  final Rect origin;
  final Animation<double> animation;
  final Widget child;
  const _Grow({required this.origin, required this.animation, required this.child});

  @override
  Widget build(BuildContext context) {
    final fade = CurvedAnimation(parent: animation, curve: const Interval(0.25, 0.65, curve: Curves.easeOut));
    final background = Theme.of(context).scaffoldBackgroundColor;
    return AnimatedBuilder(
      animation: animation,
      child: FadeTransition(opacity: fade, child: child),
      builder: (context, page) {
        final t = Curves.easeInOutCubic.transform(animation.value.clamp(0.0, 1.0).toDouble());
        return ClipPath(
          clipper: _Window(origin: origin, t: t),
          child: ColoredBox(color: background, child: page),
        );
      },
    );
  }
}

class _Window extends CustomClipper<Path> {
  final Rect origin;
  final double t;
  const _Window({required this.origin, required this.t});

  @override
  Path getClip(Size size) {
    final rect = Rect.lerp(origin, Offset.zero & size, t)!;
    return Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(12 * (1 - t))));
  }

  @override
  bool shouldReclip(_Window old) => old.t != t || old.origin != origin;
}
