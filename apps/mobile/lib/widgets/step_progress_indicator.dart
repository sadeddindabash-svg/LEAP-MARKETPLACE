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

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      color: Colors.white,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0)
              Expanded(
                child: Container(height: 2, color: i <= currentStep ? LeapColors.signal : LeapColors.line),
              ),
            Column(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i <= currentStep ? LeapColors.signal : LeapColors.line,
                  ),
                  alignment: Alignment.center,
                  child: i < currentStep
                      ? const Icon(Icons.check, size: 13, color: LeapColors.onSignal)
                      : Text('${i + 1}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: i == currentStep ? LeapColors.onSignal : LeapColors.muted)),
                ),
                const SizedBox(height: 4),
                Text(
                  labels[i],
                  style: TextStyle(fontSize: 9.5, fontWeight: i == currentStep ? FontWeight.w700 : FontWeight.w500, color: i <= currentStep ? LeapColors.ink : LeapColors.muted),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
