import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/widgets/leap_logo_animation.dart';

// The logo drawn like an engraving: it finishes after about 3.4 seconds (and says so once), and for people whose phone asks for less movement it is
// finished straight away.
void main() {
  testWidgets('draws for about 3.4 seconds, then says it is finished, once', (tester) async {
    var finished = 0;
    await tester.pumpWidget(MaterialApp(home: Center(child: LeapLogoAnimation(size: 200, onFinished: () => finished++))));
    await tester.pump(const Duration(milliseconds: 1500));
    expect(finished, 0);
    await tester.pump(const Duration(milliseconds: 2000));
    expect(finished, 1);
    await tester.pump(const Duration(seconds: 2));
    expect(finished, 1);
  });

  testWidgets('with less movement asked for, it is finished straight away', (tester) async {
    var finished = 0;
    await tester.pumpWidget(MaterialApp(home: MediaQuery(data: const MediaQueryData(disableAnimations: true), child: Center(child: LeapLogoAnimation(size: 200, onFinished: () => finished++)))));
    await tester.pump();
    expect(finished, 1);
  });
}
