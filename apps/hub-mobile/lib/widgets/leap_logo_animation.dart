import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The Leap Auto Parts logo, drawn like an engraving (the same as the website's animated logo): one steady pen draws the "L", then "E", "A" and "P"
/// as one unbroken line, at the same speed with no pause; "AUTO PARTS" glides up as the "P" is finished, then the (R). About 3.4 seconds in all.
/// The letters are the logo's own lines (traced from the logo, in the logo's 1664 x 1664 frame), so it matches the logo at any size.
/// People whose phone asks for less movement see the finished logo straight away.
class LeapLogoAnimation extends StatefulWidget {
  const LeapLogoAnimation({super.key, this.size = 240, this.showCircle = true, this.onFinished});

  /// The width and height of the logo.
  final double size;

  /// The gold circle behind the letters (off when the screen behind is already gold).
  final bool showCircle;

  /// Called once the logo is complete.
  final VoidCallback? onFinished;

  @override
  State<LeapLogoAnimation> createState() => _LeapLogoAnimationState();
}

class _LeapLogoAnimationState extends State<LeapLogoAnimation> with SingleTickerProviderStateMixin {
  static const _total = Duration(milliseconds: 3400);
  late final AnimationController _controller = AnimationController(vsync: this, duration: _total);
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onFinished?.call();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.of(context).disableAnimations) {
      _controller.value = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) widget.onFinished?.call(); });
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Leap Auto Parts',
      image: true,
      child: SizedBox.square(
        dimension: widget.size,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => CustomPaint(painter: _LeapLogoPainter(seconds: _controller.value * _total.inMilliseconds / 1000, showCircle: widget.showCircle)),
        ),
      ),
    );
  }
}

class _LeapLogoPainter extends CustomPainter {
  _LeapLogoPainter({required this.seconds, required this.showCircle});

  final double seconds;
  final bool showCircle;

  static const _navy = Color(0xFF0A3144);
  static const _gold = Color(0xFFF9B317);
  static const _frame = 1664.0;
  static const _start = 0.2;      // the pen starts
  static const _draw = 2.3;       // ... and has drawn the whole word this many seconds later

  // The logo's own lines: the "L", then "E", "A" and "P" as one unbroken line.
  static final Path _l = Path()
    ..moveTo(246, 590)
    ..lineTo(246, 955)
    ..lineTo(459, 955);
  static final Path _eap = Path()
    ..moveTo(771, 590)
    ..lineTo(550, 590)
    ..lineTo(550, 733)
    ..lineTo(738, 733)
    ..lineTo(738, 801)
    ..lineTo(550, 801)
    ..lineTo(550, 955)
    ..lineTo(805, 955)
    ..lineTo(956, 578)
    ..lineTo(1107, 955)
    ..lineTo(1185, 955)
    ..lineTo(1185, 590)
    ..lineTo(1325, 590)
    ..cubicTo(1395, 590, 1434, 640, 1434, 700)
    ..cubicTo(1434, 760, 1395, 810, 1325, 810)
    ..lineTo(1257, 810)
    ..lineTo(1257, 955);
  static final _lLine = _l.computeMetrics().first;
  static final _eapLine = _eap.computeMetrics().first;

  static double _easeOut(double t) => 1 - math.pow(1 - t, 3).toDouble();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / _frame);
    if (showCircle) canvas.drawCircle(const Offset(832, 832), 801, Paint()..color = _gold);

    // The pen: one steady speed over both lines.
    final pen = Paint()
      ..color = _navy
      ..style = PaintingStyle.stroke
      ..strokeWidth = 36
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    final whole = _lLine.length + _eapLine.length;
    final drawn = ((seconds - _start) / _draw).clamp(0.0, 1.0) * whole;
    if (drawn > 0) canvas.drawPath(_lLine.extractPath(0, math.min(drawn, _lLine.length)), pen);
    if (drawn > _lLine.length) canvas.drawPath(_eapLine.extractPath(0, drawn - _lLine.length), pen);

    final wordDone = _start + _draw;
    // "AUTO PARTS": glides up into its place (from x 369 to 1312, standing on the line at y 1181), as the "P" is finished.
    final a = _easeOut(((seconds - (wordDone - 0.25)) / 0.9).clamp(0.0, 1.0));
    if (a > 0) {
      const text = 'AUTO PARTS';
      TextPainter layout(double spacing) => TextPainter(
            text: TextSpan(text: text, style: TextStyle(color: _navy.withOpacity(a), fontSize: 90, fontWeight: FontWeight.w500, letterSpacing: spacing, height: 1)),
            textDirection: TextDirection.ltr,
          )..layout();
      final natural = layout(0).width;
      final spacing = math.max(0.0, (943 - natural) / (text.length - 1));
      final painter = layout(spacing);
      final width = painter.width - spacing;      // the spacing after the last letter is not part of the word
      final baseline = painter.computeDistanceToActualBaseline(TextBaseline.alphabetic);
      painter.paint(canvas, Offset(840.5 - width / 2, 1181 - baseline + 36 * (1 - a)));
    }
    // The (R): grows into place last.
    final r = _easeOut(((seconds - (wordDone + 0.35)) / 0.5).clamp(0.0, 1.0));
    if (r > 0) {
      canvas.save();
      canvas.translate(1435, 532);
      canvas.scale(0.4 + 0.6 * r);
      canvas.drawCircle(Offset.zero, 33, Paint()
        ..color = _navy.withOpacity(r)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5);
      final mark = TextPainter(text: TextSpan(text: 'R', style: TextStyle(color: _navy.withOpacity(r), fontSize: 42, fontWeight: FontWeight.w600, height: 1)), textDirection: TextDirection.ltr)..layout();
      mark.paint(canvas, Offset(-mark.width / 2, -mark.height / 2));
      canvas.restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_LeapLogoPainter old) => old.seconds != seconds || old.showCircle != showCircle;
}
