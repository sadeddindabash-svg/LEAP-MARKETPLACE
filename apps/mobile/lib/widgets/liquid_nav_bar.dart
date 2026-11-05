import 'dart:math' as math;
import 'package:flutter/material.dart';

/// One tab of [LiquidNavBar]: its icon (a Badge around it is fine) and its name.
class LiquidNavItem {
  final Widget icon;
  final String label;
  const LiquidNavItem({required this.icon, required this.label});
}

/// The bottom menu with a liquid indicator (the same as the website on a phone; confirmed with the person via mockup): the bar is navy and bulges
/// up under the chosen tab like a drop; the drop stretches as it slides to the next tab, and the gold circle under it shrinks and pops back,
/// holding that tab's icon. Right to left in Arabic by itself. A phone set to reduce motion just switches, without movement.
class LiquidNavBar extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<LiquidNavItem> items;
  const LiquidNavBar({super.key, required this.currentIndex, required this.onTap, required this.items});

  @override
  State<LiquidNavBar> createState() => _LiquidNavBarState();
}

class _LiquidNavBarState extends State<LiquidNavBar> with SingleTickerProviderStateMixin {
  static const navy = Color(0xFF0B3146);
  static const gold = Color(0xFFF9B317);
  static const idle = Color(0xFF9FB3C2);
  static const _bump = 22.0;   // how high the drop rises above the bar
  static const _bar = 60.0;
  static const _circle = 46.0;
  static const _curve = Cubic(0.65, 0, 0.25, 1);

  late final AnimationController _move = AnimationController(vsync: this, duration: const Duration(milliseconds: 200), value: 1);
  late double _from = widget.currentIndex.toDouble();
  late double _to = widget.currentIndex.toDouble();

  @override
  void didUpdateWidget(LiquidNavBar old) {
    super.didUpdateWidget(old);
    if (widget.currentIndex != _to) {
      final t = _curve.transform(_move.value);
      _from = _from + (_to - _from) * t;   // starts from where the drop is now, even in the middle of a move
      _to = widget.currentIndex.toDouble();
      if (MediaQuery.of(context).disableAnimations) {
        _move.value = 1;
      } else {
        _move.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _move.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final bottom = MediaQuery.of(context).padding.bottom;
    final n = widget.items.length;
    return SizedBox(
      height: _bump + _bar + bottom,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth / n;
          return AnimatedBuilder(
            animation: _move,
            builder: (context, _) {
              final t = _curve.transform(_move.value);
              final pos = _from + (_to - _from) * t;
              final wave = math.sin(math.pi * _move.value);    // 0 when still, 1 in the middle of a move
              final logical = (pos + 0.5) * w;
              final x = rtl ? box.maxWidth - logical : logical;
              final circleScale = 1 - 0.45 * wave;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(child: CustomPaint(painter: _LiquidPainter(x: x, top: _bump, stretchX: 1 + 0.55 * wave, stretchY: 1 - 0.28 * wave, color: navy))),
                  Positioned(
                    left: x - _circle / 2,
                    top: _bump - 16,
                    child: Transform.scale(
                      scale: circleScale,
                      child: Container(
                        width: _circle,
                        height: _circle,
                        decoration: const BoxDecoration(color: gold, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x73F9B317), blurRadius: 16, offset: Offset(0, 6))]),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    top: _bump,
                    height: _bar,
                    child: Row(
                      children: [
                        for (var i = 0; i < n; i++)
                          Expanded(
                            child: Semantics(
                              selected: i == widget.currentIndex,
                              button: true,
                              label: widget.items[i].label,
                              child: InkResponse(
                                key: Key('liquid-tab-$i'),
                                onTap: () => widget.onTap(i),
                                radius: 32,
                                child: ExcludeSemantics(child: _tab(widget.items[i], i == widget.currentIndex)),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _tab(LiquidNavItem item, bool on) {
    final still = MediaQuery.of(context).disableAnimations;
    final d = Duration(milliseconds: still ? 0 : 164);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedSlide(
          duration: d,
          curve: _curve,
          offset: on ? const Offset(0, -0.62) : Offset.zero,   // up into the gold circle
          child: IconTheme(data: IconThemeData(color: on ? navy : idle, size: 23), child: item.icon),
        ),
        const SizedBox(height: 3),
        AnimatedDefaultTextStyle(
          duration: d,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: on ? gold : idle),
          child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

/// The navy bar with the drop rising from its top edge at [x].
class _LiquidPainter extends CustomPainter {
  final double x, top, stretchX, stretchY;
  final Color color;
  const _LiquidPainter({required this.x, required this.top, required this.stretchX, required this.stretchY, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final half = 55 * stretchX;
    final h = top * stretchY;
    final path = Path()
      ..moveTo(0, top)
      ..lineTo(x - half, top)
      ..cubicTo(x - half * 0.55, top, x - half * 0.45, top - h, x, top - h)
      ..cubicTo(x + half * 0.45, top - h, x + half * 0.55, top, x + half, top)
      ..lineTo(size.width, top)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawShadow(path, const Color(0x2E07202F), 4, false);
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_LiquidPainter old) => old.x != x || old.stretchX != stretchX || old.stretchY != stretchY || old.color != color;
}
