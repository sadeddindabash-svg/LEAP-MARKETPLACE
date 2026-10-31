import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// Track your package: the 7 steps from placed to delivered, even before the hub. Reads the source text.
void main() {
  test('the tracking screen draws the 7 steps', () {
    final src = File('lib/features/orders/tracking_screen.dart').readAsStringSync();
    expect(src.contains('class _StepsList extends StatelessWidget'), isTrue);
    expect(src.contains("'Preparing your order'"), isTrue);
    expect(src.contains("'جارٍ تجهيز طلبك'"), isTrue);
    expect(src.contains("_StepsList(stage: (so['stage'] as num?)?.toInt()"), isTrue);
  });
}
