import 'dart:async';
import 'package:flutter/material.dart';

/// The product screen's deal countdown: a flip clock (confirmed with the person via mockups: the flip-clock design, colour set A "Navy & gold").
/// "⏱ Deal ends in", then days, hours, minutes and seconds on split tiles, ticking every second. It disappears when the discount ends.
/// Light: navy tiles with gold numbers, navy label. Dark: gold tiles with navy numbers, gold label.
class DealCountdown extends StatefulWidget {
  final DateTime endsAt;
  final bool isAr;
  const DealCountdown({super.key, required this.endsAt, required this.isAr});

  @override
  State<DealCountdown> createState() => _DealCountdownState();
}

class _DealCountdownState extends State<DealCountdown> {
  Timer? _timer;
  late Duration _left;

  @override
  void initState() {
    super.initState();
    _left = _compute();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final next = _compute();
      setState(() => _left = next);
      if (next <= Duration.zero) _timer?.cancel();
    });
  }

  Duration _compute() {
    final d = widget.endsAt.difference(DateTime.now());
    return d.isNegative ? Duration.zero : d;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_left <= Duration.zero) return const SizedBox.shrink();
    final dark = Theme.of(context).brightness == Brightness.dark;
    final top = dark ? const Color(0xFFFFC53D) : const Color(0xFF123F5A);
    final bottom = dark ? const Color(0xFFF9B317) : const Color(0xFF0B3146);
    final number = dark ? const Color(0xFF0B3146) : const Color(0xFFF9B317);
    final unit = dark ? const Color(0xFF5A4200) : const Color(0xFFC9D6E0);
    final accent = dark ? const Color(0xFFF9B317) : const Color(0xFF0B3146);      // the label and the colons
    final shadow = dark ? const Color(0x40F9B317) : const Color(0x4D0B3146);
    final ar = widget.isAr;
    final parts = <List<Object>>[
      [_left.inDays, ar ? 'يوم' : 'days'],
      [_left.inHours % 24, ar ? 'ساعة' : 'hrs'],
      [_left.inMinutes % 60, ar ? 'دقيقة' : 'min'],
      [_left.inSeconds % 60, ar ? 'ثانية' : 'sec'],
    ];
    Widget tile(int n, String label) => Container(
          constraints: const BoxConstraints(minWidth: 42),
          padding: const EdgeInsets.fromLTRB(3, 6, 3, 3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(7),
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [top, top, bottom, bottom], stops: const [0, 0.5, 0.5, 1]),
            boxShadow: [BoxShadow(color: shadow, blurRadius: dark ? 10 : 6, offset: const Offset(0, 3))],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(n.toString().padLeft(2, '0'), style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, height: 1, color: number, fontFeatures: const [FontFeature.tabularFigures()])),
                  const SizedBox(height: 2),
                  Text(label, style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w600, height: 1.1, color: unit)),
                ],
              ),
              Positioned(left: -3, right: -3, child: Container(height: 1, color: Colors.black.withValues(alpha: dark ? 0.25 : 0.45))),
            ],
          ),
        );
    final ordered = ar ? parts.reversed.toList() : parts;      // the tiles always read left to right; in Arabic the days are on the right
    return Semantics(
      label: ar ? 'ينتهي العرض خلال ${_left.inDays} يوم و ${_left.inHours % 24} ساعة' : 'Deal ends in ${_left.inDays} days ${_left.inHours % 24} hours',
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 10,
        runSpacing: 6,
        children: [
          Text('⏱ ${ar ? 'ينتهي العرض خلال' : 'Deal ends in'}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: accent)),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < ordered.length; i++) ...[
                  if (i > 0) Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: Text(':', style: TextStyle(fontWeight: FontWeight.w900, color: accent))),
                  tile(ordered[i][0] as int, ordered[i][1] as String),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
