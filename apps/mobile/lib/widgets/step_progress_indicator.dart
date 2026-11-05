import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Real checkout step progress indicator (new) -- closes a real gap:
/// no way existed for a buyer to see how far through checkout they
/// are. Shows a real "circles connected by a line" progress bar,
/// matching a common, well-understood real checkout convention.
/// Deliberately generic (a real list of labels, not hardcoded to
/// checkout specifically) in case another real multi-section flow in
/// this app wants the same real pattern later.
class StepProgressIndicator extends StatelessWidget {
  final List<String> labels;
  final int currentStep;
  const StepProgressIndicator({super.key, required this.labels, required this.currentStep});

  // Raised (confirmed with the person via mockup, option B): a warm cream gold in light mode, the tab bar's navy in dark mode; the done and current
  // steps are raised gold.
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : const Color(0xFF0B3146);
    final soft = dark ? const Color(0x2EFFFFFF) : const Color(0xFFECD9AE);
    final softInk = dark ? const Color(0xB3FFFFFF) : const Color(0xFF8A5A12);
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: dark ? Alignment.topLeft : Alignment.topCenter,
          end: dark ? Alignment.bottomRight : Alignment.bottomCenter,
          colors: dark ? const [Color(0xFF0B3146), Color(0xFF164A66)] : const [Color(0xFFFFFAF0), Color(0xFFFFEFCF)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: dark ? const Color(0x1FFFFFFF) : Colors.white),
        boxShadow: dark
            ? const [BoxShadow(color: Color(0x73000000), blurRadius: 22, offset: Offset(0, 10))]
            : const [BoxShadow(color: Color(0x14E39F0C), blurRadius: 4, offset: Offset(0, 2)), BoxShadow(color: Color(0x38E39F0C), blurRadius: 22, spreadRadius: -4, offset: Offset(0, 10))],
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0)
              Expanded(
                child: Container(height: 3, decoration: BoxDecoration(color: i <= currentStep ? LeapColors.signal : soft, borderRadius: BorderRadius.circular(2))),
              ),
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: i <= currentStep
                      ? const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFFFD567), Color(0xFFF9B317), Color(0xFFE39F0C)]),
                          boxShadow: [BoxShadow(color: Color(0x73E39F0C), blurRadius: 7, offset: Offset(0, 3))],
                        )
                      : BoxDecoration(shape: BoxShape.circle, color: soft),
                  alignment: Alignment.center,
                  child: i < currentStep
                      ? const Icon(Icons.check, size: 13, color: Color(0xFF0B3146))
                      : Text('${i + 1}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: i == currentStep ? const Color(0xFF0B3146) : softInk)),
                ),
                const SizedBox(height: 4),
                Text(
                  labels[i],
                  style: TextStyle(fontSize: 9.5, fontWeight: i == currentStep ? FontWeight.w800 : FontWeight.w600, color: i <= currentStep ? ink : softInk),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
