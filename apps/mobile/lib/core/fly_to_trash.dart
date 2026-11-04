import 'dart:async';
import 'dart:math' as math;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Removing a part from the basket: the same motion as "fly to cart", the other way (the same as the website). A red trash can appears near the bottom of the
/// screen, the part's photo arcs into it (tilting as it falls, 3/4 of a second), the lid opens as it drops in and closes, and the can fades away. The future
/// completes when the part is in the can, so the line can then fold away. With "Remove animations" on (or nothing to fly) it completes at once.
class FlyToTrash {
  FlyToTrash._();

  static Future<void> fly(BuildContext context, {required GlobalKey source, String? imageUrl}) {
    final box = source.currentContext?.findRenderObject();
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    final noMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (box is! RenderBox || !box.hasSize || !box.attached || overlay == null || noMotion) return Future.value();
    final from = box.localToGlobal(Offset.zero) & box.size;
    final screen = MediaQuery.of(context).size;
    // Above the basket's total and Checkout bar, in the middle.
    final canCenter = Offset(screen.width / 2, screen.height - 210);
    final landed = Completer<void>();
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _TrashFlight(
        from: from,
        can: canCenter,
        imageUrl: imageUrl,
        onLanded: () { if (!landed.isCompleted) landed.complete(); },
        onDone: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
    return landed.future;
  }
}

/// A point of the arc at [t]: from [a], up over a high point, down onto [b] (a quadratic curve, as "fly to cart").
Offset _arc(double t, Offset a, Offset b) {
  final c = Offset((a.dx + b.dx) / 2, math.min(a.dy, b.dy) - 80);
  final q = 1 - t;
  return Offset(q * q * a.dx + 2 * q * t * c.dx + t * t * b.dx, q * q * a.dy + 2 * q * t * c.dy + t * t * b.dy);
}

class _TrashFlight extends StatefulWidget {
  final Rect from;
  final Offset can;
  final String? imageUrl;
  final VoidCallback onLanded;
  final VoidCallback onDone;
  const _TrashFlight({required this.from, required this.can, required this.imageUrl, required this.onLanded, required this.onDone});

  @override
  State<_TrashFlight> createState() => _TrashFlightState();
}

class _TrashFlightState extends State<_TrashFlight> with SingleTickerProviderStateMixin {
  // 0 .. fly (0.75 s) .. then the can waits a moment and fades (0.7 s more).
  static const _flyMs = 750;
  static const _totalMs = 1450;
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: _totalMs))
    ..addListener(() {
      if (_c.value * _totalMs >= _flyMs) widget.onLanded();
    })
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        widget.onLanded();
        widget.onDone();
      }
    })
    ..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final ms = _c.value * _totalMs;
          final p = (ms / _flyMs).clamp(0.0, 1.0);
          final e = Curves.easeInOut.transform(p);
          final start = widget.from.center;
          final stop = widget.can - const Offset(0, 28);
          final at = _arc(e, start, stop);
          final startSize = math.max(math.min(widget.from.width, widget.from.height), 40.0);
          final size = startSize * (1 - 0.55 * e);
          final flyOpacity = p > 0.85 ? (1 - (p - 0.85) / 0.15).clamp(0.0, 1.0) : 1.0;
          final canIn = (ms / 200).clamp(0.0, 1.0);
          final canOut = ms > _flyMs + 450 ? (1 - (ms - _flyMs - 450) / 250).clamp(0.0, 1.0) : 1.0;
          final lidT = ((ms / (_flyMs + 300)) - 0.45) / 0.55;
          final lid = lidT > 0 && lidT < 1 ? math.sin(lidT * math.pi) * 35 * math.pi / 180 : 0.0;
          return Stack(children: [
            Positioned(
              left: widget.can.dx - 32,
              top: widget.can.dy - 38,
              width: 64,
              height: 76,
              child: Opacity(
                opacity: canIn * canOut,
                child: Transform.scale(scale: 0.6 + 0.4 * canIn, child: CustomPaint(painter: _CanPainter(lid))),
              ),
            ),
            if (p < 1)
              Positioned(
                left: at.dx - size / 2,
                top: at.dy - size / 2,
                width: size,
                height: size,
                child: Opacity(
                  opacity: flyOpacity,
                  child: Transform.rotate(
                    angle: -25 * e * math.pi / 180,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFA12A21), width: 2),
                        boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 20, offset: Offset(0, 8))],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: widget.imageUrl == null ? const Icon(Icons.inventory_2_outlined, color: Color(0xFF53636F)) : CachedNetworkImage(imageUrl: widget.imageUrl!, fit: BoxFit.cover),
                    ),
                  ),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

/// The red trash can (64 x 76), its lid turned open by [lid] radians around its left end.
class _CanPainter extends CustomPainter {
  final double lid;
  _CanPainter(this.lid);

  @override
  void paint(Canvas canvas, Size size) {
    final dark = Paint()..color = const Color(0xFFA12A21);
    final body = Paint()..color = const Color(0xFFC62F26);
    canvas.save();
    canvas.translate(8, 14);
    canvas.rotate(-lid);
    canvas.translate(-8, -14);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(4, 10, 56, 7), const Radius.circular(3)), dark);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(24, 4, 16, 7), const Radius.circular(3)), dark);
    canvas.restore();
    final path = Path()..moveTo(9, 21)..lineTo(55, 21)..lineTo(51, 72)..lineTo(13, 72)..close();
    canvas.drawPath(path, body);
    final stripe = Paint()..color = Colors.white.withValues(alpha: 0.6)..strokeWidth = 3..strokeCap = StrokeCap.round;
    for (final x in [22.0, 32.0, 42.0]) {
      canvas.drawLine(Offset(x, 30), Offset(x, 64), stripe);
    }
  }

  @override
  bool shouldRepaint(covariant _CanPainter old) => old.lid != lid;
}
