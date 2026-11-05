import 'dart:async';
import 'package:flutter/material.dart';

/// Where a group of [SlideIn]s starts counting from (a screen, or one list: Shop's parts, one Orders tab). Give it a new key to play its list again
/// (another section, another tab). A [SlideIn] built more than [SlideInScope.window] after its scope opened (a row reached by scrolling) just appears,
/// so nothing slides again while scrolling.
class SlideInScope extends StatefulWidget {
  final Widget child;
  const SlideInScope({super.key, required this.child});

  static const window = Duration(milliseconds: 1200);

  static DateTime? startOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_SlideInStart>()?.start;

  @override
  State<SlideInScope> createState() => _SlideInScopeState();
}

class _SlideInScopeState extends State<SlideInScope> {
  final DateTime _start = DateTime.now();

  @override
  Widget build(BuildContext context) => _SlideInStart(start: _start, child: widget.child);
}

class _SlideInStart extends InheritedWidget {
  final DateTime start;
  const _SlideInStart({required this.start, required super.child});

  @override
  bool updateShouldNotify(_SlideInStart old) => old.start != start;
}

/// Slide in from the side, idea B (confirmed with the person via mockup): from the start side (from the right in Arabic), fading in, 0.45 s,
/// [index] x 0.055 s after its scope opened. A phone set to reduce motion shows it at once.
class SlideIn extends StatefulWidget {
  final int index;
  final Widget child;
  const SlideIn({super.key, required this.index, required this.child});

  @override
  State<SlideIn> createState() => _SlideInState();
}

class _SlideInState extends State<SlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 450));
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: const Cubic(0.2, 0.8, 0.2, 1));
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final start = SlideInScope.startOf(context);
    final elapsed = start == null ? 0 : DateTime.now().difference(start).inMilliseconds;
    if (MediaQuery.of(context).disableAnimations || elapsed > SlideInScope.window.inMilliseconds) {
      _c.value = 1;
      return;
    }
    final wait = 55 * widget.index - elapsed;
    if (wait <= 0) {
      _c.forward();
    } else {
      _wait = Timer(Duration(milliseconds: wait), () { if (mounted) _c.forward(); });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final from = Directionality.of(context) == TextDirection.rtl ? 40.0 : -40.0;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _t.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(from * (1 - _t.value), 0), child: child),
      ),
    );
  }
}
