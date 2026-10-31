import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';      // RenderRepaintBoundary (the picture of the screen)
import 'package:provider/provider.dart';
import '../core/theme_state.dart';

/// The animated theme change: when the user taps the light / dark switch, the NEW theme spreads over the whole app in a growing
/// circle that starts from the switch (1.2 seconds). How: a picture of the app in the OLD theme is taken, the theme is switched at
/// once underneath, and the old picture is drawn on top with a hole that grows from the switch until it covers the screen.
/// Phones set to reduce motion get a short fade instead. If the picture cannot be taken, the theme simply switches.
///
/// Wraps the app once (app.dart, MaterialApp.builder); any screen below calls ThemeReveal.switchTheme(context, mode, center).
class ThemeReveal extends StatefulWidget {
  final Widget child;
  const ThemeReveal({super.key, required this.child});

  static const Duration duration = Duration(milliseconds: 1200);
  static const Duration fadeDuration = Duration(milliseconds: 300);

  /// Switches to `mode` with the circle starting at `globalCenter` (the switch's centre on the screen).
  static Future<void> switchTheme(BuildContext context, ThemeMode mode, Offset globalCenter) async {
    final state = context.findAncestorStateOfType<_ThemeRevealState>();
    if (state == null) {
      await context.read<ThemeState>().setMode(mode);
      return;
    }
    await state._switch(mode, globalCenter);
  }

  @override
  State<ThemeReveal> createState() => _ThemeRevealState();
}

class _ThemeRevealState extends State<ThemeReveal> with SingleTickerProviderStateMixin {
  final GlobalKey _boundaryKey = GlobalKey();
  late final AnimationController _controller = AnimationController(vsync: this);
  ui.Image? _oldPicture;
  Offset _center = Offset.zero;
  bool _fadeOnly = false;

  @override
  void dispose() {
    _controller.dispose();
    _oldPicture?.dispose();
    super.dispose();
  }

  Future<void> _switch(ThemeMode mode, Offset globalCenter) async {
    final themeState = context.read<ThemeState>();
    if (_controller.isAnimating) return; // one change at a time
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    ui.Image? picture;
    try {
      final boundary = _boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary != null && boundary.hasSize) {
        final ratio = MediaQuery.maybeOf(context)?.devicePixelRatio ?? 1.0;
        picture = await boundary.toImage(pixelRatio: ratio);
      }
    } catch (_) {
      picture = null; // no picture: switch without the animation
    }
    if (!mounted || picture == null) {
      picture?.dispose();
      await themeState.setMode(mode);
      return;
    }
    final box = context.findRenderObject() as RenderBox?;
    setState(() {
      _oldPicture?.dispose();
      _oldPicture = picture;
      _center = box != null && box.hasSize ? box.globalToLocal(globalCenter) : globalCenter;
      _fadeOnly = reduceMotion;
    });
    await themeState.setMode(mode); // the new theme is drawn underneath the old picture
    _controller.duration = reduceMotion ? ThemeReveal.fadeDuration : ThemeReveal.duration;
    try {
      await _controller.forward(from: 0).orCancel;
    } on TickerCanceled {
      // the widget went away mid-animation: nothing to clean up on screen
    }
    if (!mounted) return;
    setState(() {
      _oldPicture?.dispose();
      _oldPicture = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final picture = _oldPicture;
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        RepaintBoundary(key: _boundaryKey, child: widget.child),
        if (picture != null)
          Positioned.fill(
            child: AbsorbPointer(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) => CustomPaint(
                  painter: _RevealPainter(
                    picture: picture,
                    center: _center,
                    progress: Curves.easeInOutCubic.transform(_controller.value),
                    fadeOnly: _fadeOnly,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Draws the old-theme picture everywhere except inside the growing circle (or fades it out, for reduce motion).
class _RevealPainter extends CustomPainter {
  final ui.Image picture;
  final Offset center;
  final double progress;
  final bool fadeOnly;

  _RevealPainter({required this.picture, required this.center, required this.progress, required this.fadeOnly});

  @override
  void paint(Canvas canvas, Size size) {
    final src = Rect.fromLTWH(0, 0, picture.width.toDouble(), picture.height.toDouble());
    final dst = Offset.zero & size;
    if (fadeOnly) {
      canvas.drawImageRect(picture, src, dst, Paint()..color = Colors.white.withValues(alpha: 1 - progress));
      return;
    }
    // the circle must end beyond the farthest corner from where it started
    final corners = [dst.topLeft, dst.topRight, dst.bottomLeft, dst.bottomRight];
    final maxRadius = corners.map((c) => (c - center).distance).reduce(math.max);
    final hole = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(dst)
      ..addOval(Rect.fromCircle(center: center, radius: maxRadius * progress));
    canvas.save();
    canvas.clipPath(hole);
    canvas.drawImageRect(picture, src, dst, Paint()..filterQuality = FilterQuality.medium);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _RevealPainter old) => old.progress != progress || old.picture != picture || old.center != center;
}
