import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The product page slides in from the side (confirmed with the person via mockup): from the right in English, from the left in Arabic, in 0.3 s, over the
/// page behind, which dims a little. Back slides it out the same way. (It replaces the "open container" growing card.)
class ProductSlide {
  static Page<void> page(GoRouterState state, Widget child) {
    return CustomTransitionPage<void>(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 300),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
        return Stack(
          fit: StackFit.expand,
          children: [
            // the page behind dims a little while the new one comes over it
            IgnorePointer(child: FadeTransition(opacity: Tween<double>(begin: 0, end: 0.25).animate(curved), child: const ColoredBox(color: Colors.black))),
            SlideTransition(
              // Offset(1, 0) is the end side: the right in English; textDirection turns it to the left in Arabic
              position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(curved),
              textDirection: Directionality.of(context),
              child: DecoratedBox(
                decoration: const BoxDecoration(boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 24)]),
                child: child,
              ),
            ),
          ],
        );
      },
    );
  }
}
