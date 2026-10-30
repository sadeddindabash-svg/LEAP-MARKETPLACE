import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/widgets/sun_moon_switch.dart';
import 'package:leap_mobile/widgets/theme_reveal.dart';

// The animated light / dark switch, and where it is used.
void main() {
  testWidgets('tapping the switch asks for the other mode, with its centre on the screen', (tester) async {
    bool? asked;
    Offset? at;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SunMoonSwitch(value: false, onChanged: (v, c) { asked = v; at = c; }),
        ),
      ),
    ));
    await tester.tap(find.byKey(const ValueKey('sun-moon-switch')));
    expect(asked, isTrue);
    expect(at, tester.getCenter(find.byType(SunMoonSwitch)));
  });

  testWidgets('the switch animates to the moon and back (1 second each way)', (tester) async {
    var value = false;
    late StateSetter set;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: StatefulBuilder(builder: (context, s) {
            set = s;
            return SunMoonSwitch(value: value, onChanged: (v, _) => s(() => value = v));
          }),
        ),
      ),
    ));
    await tester.tap(find.byType(SunMoonSwitch));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpAndSettle();
    expect(value, isTrue);
    set(() => value = false);
    await tester.pumpAndSettle();
    expect(SunMoonSwitch.duration, const Duration(milliseconds: 1000));
    expect(ThemeReveal.duration, const Duration(milliseconds: 1200));
  });

  test('Account uses the animated switch, and the whole app can reveal the new theme', () {
    final account = File('lib/features/account/account_screen.dart').readAsStringSync();
    expect(account.contains('SunMoonSwitch('), isTrue);
    expect(account.contains('ThemeReveal.switchTheme(context'), isTrue);
    final app = File('lib/app.dart').readAsStringSync();
    expect(app.contains('child: ThemeReveal('), isTrue);
  });
}
