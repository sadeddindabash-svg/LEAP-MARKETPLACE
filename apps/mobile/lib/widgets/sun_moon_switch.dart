import 'dart:math' as math;
import 'package:flutter/material.dart';

/// The animated light / dark switch (Account > Appearance): a sun on a blue day sky that rolls to the right and becomes a moon on a
/// night sky; the clouds sink away and stars appear. 1 second, the same as the mockup. `onChanged` gets the new value and the switch's
/// centre on the screen, so the theme reveal can start its circle from there (see widgets/theme_reveal.dart).
class SunMoonSwitch extends StatefulWidget {
  final bool value;
  final void Function(bool value, Offset globalCenter) onChanged;
  final String? semanticLabel;

  const SunMoonSwitch({super.key, required this.value, required this.onChanged, this.semanticLabel});

  static const Size size = Size(56, 28);
  static const Duration duration = Duration(milliseconds: 1000);

  @override
  State<SunMoonSwitch> createState() => _SunMoonSwitchState();
}

class _SunMoonSwitchState extends State<SunMoonSwitch> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: SunMoonSwitch.duration,
    value: widget.value ? 1 : 0,
  );
  late final Animation<double> _t = CurvedAnimation(parent: _controller, curve: Curves.easeInOutCubic);

  @override
  void didUpdateWidget(covariant SunMoonSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
      if (reduceMotion) {
        _controller.value = widget.value ? 1 : 0;
      } else if (widget.value) {
        _controller.forward();
      } else {
        _controller.reverse();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _tap() {
    final box = context.findRenderObject() as RenderBox?;
    final center = box != null && box.hasSize ? box.localToGlobal(box.size.center(Offset.zero)) : Offset.zero;
    widget.onChanged(!widget.value, center);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: widget.value,
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        key: const ValueKey('sun-moon-switch'),
        behavior: HitTestBehavior.opaque,
        onTap: _tap,
        child: AnimatedBuilder(
          animation: _t,
          builder: (context, _) => CustomPaint(size: SunMoonSwitch.size, painter: _SunMoonPainter(_t.value)),
        ),
      ),
    );
  }
}

class _SunMoonPainter extends CustomPainter {
  final double t; // 0 = day (sun), 1 = night (moon)
  _SunMoonPainter(this.t);

  static const _day = [Color(0xFF7EC8F2), Color(0xFF4DA3E0)];
  static const _night = [Color(0xFF1E2A44), Color(0xFF0E1526)];

  @override
  void paint(Canvas canvas, Size size) {
    final track = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(size.height / 2));
    canvas.save();
    canvas.clipRRect(track);
    canvas.drawRRect(
      track,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color.lerp(_day[0], _night[0], t)!, Color.lerp(_day[1], _night[1], t)!],
        ).createShader(Offset.zero & size),
    );

    // clouds: sink and fade while the sun rolls away
    final cloudT = (t / 0.7).clamp(0.0, 1.0);
    final cloud = Paint()..color = Colors.white.withValues(alpha: 1 - cloudT);
    final drop = cloudT * 20;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(32, 15 + drop, 14, 6), const Radius.circular(3)), cloud);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(40, 8 + drop, 10, 5), const Radius.circular(2.5)), cloud);

    // stars: come down and appear in the second half
    final starT = ((t - 0.4) / 0.6).clamp(0.0, 1.0);
    final star = Paint()..color = Colors.white.withValues(alpha: starT);
    final rise = (1 - starT) * -10;
    for (final p in const [Offset(13.5, 8.5), Offset(19.5, 18.5), Offset(25.5, 11.5)]) {
      canvas.drawCircle(p.translate(0, rise), 1.5, star);
    }
    canvas.restore();

    // the knob: the sun rolling right (one full turn) and becoming the moon
    const knob = 22.0;
    final left = 3 + t * (size.width - knob - 6);
    final center = Offset(left + knob / 2, size.height / 2);
    final knobColor = Color.lerp(const Color(0xFFFFD43B), const Color(0xFFE4E7EC), t)!;
    canvas.drawCircle(center, knob / 2 + 3, Paint()..color = knobColor.withValues(alpha: 0.22));
    canvas.drawCircle(center, knob / 2, Paint()..color = knobColor);
    final craterT = ((t - 0.2) / 0.6).clamp(0.0, 1.0);
    if (craterT > 0) {
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(t * 2 * math.pi);
      final crater = Paint()..color = const Color(0xFFC3C8D0).withValues(alpha: craterT);
      canvas.drawCircle(const Offset(3, -3), 3, crater);
      canvas.drawCircle(const Offset(-3, 3), 2, crater);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _SunMoonPainter old) => old.t != t;
}
