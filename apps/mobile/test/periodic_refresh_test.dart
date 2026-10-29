import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/core/periodic_refresh.dart';

// The quiet 5-second refresh: while the app is visible, at once when it comes back, never two at a time, errors ignored. Plain Dart (short real timers): no device needed.
const _tick = Duration(milliseconds: 30);
Future<void> _wait(int ms) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  test('the default is every 5 seconds', () {
    expect(PeriodicRefresh.defaultInterval, const Duration(seconds: 5));
    expect(PeriodicRefresh(() async {}).interval, const Duration(seconds: 5));
  });
  test('CRITICAL: it runs again and again while started, and stops when stopped', () async {
    var calls = 0;
    final r = PeriodicRefresh(() async => calls++, interval: _tick)..start();
    await _wait(140);
    expect(calls >= 3, isTrue);
    r.stop();
    final after = calls;
    await _wait(120);
    expect(calls, after);
    expect(r.isStarted, isFalse);
  });
  test('it does nothing before start()', () async {
    var calls = 0;
    PeriodicRefresh(() async => calls++, interval: _tick);
    await _wait(100);
    expect(calls, 0);
  });
  test('CRITICAL: nothing runs while the app is in the background; coming back to the foreground loads AT ONCE', () async {
    var calls = 0;
    final r = PeriodicRefresh(() async => calls++, interval: const Duration(seconds: 5))..start();
    r.setVisible(false);
    await r.tick();
    expect(calls, 0);
    r.setVisible(true);
    await _wait(20);
    expect(calls, 1);
    r.stop();
  });
  test('CRITICAL: never two at a time: a slow answer is waited for, not piled up', () async {
    var started = 0;
    final slow = Completer<void>();
    final r = PeriodicRefresh(() {
      started++;
      return slow.future;
    }, interval: _tick)
      ..start();
    await _wait(200);
    expect(started, 1);
    slow.complete();
    await _wait(100);
    expect(started >= 2, isTrue);
    r.stop();
  });
  test('CRITICAL: an error is ignored and the next tick still runs', () async {
    var calls = 0;
    final r = PeriodicRefresh(() async {
      calls++;
      if (calls == 1) throw Exception('down');
    }, interval: _tick)
      ..start();
    await _wait(160);
    expect(calls >= 3, isTrue);
    r.stop();
  });
  test('starting twice does not double the refreshes', () async {
    var calls = 0;
    final r = PeriodicRefresh(() async => calls++, interval: _tick)
      ..start()
      ..start();
    await _wait(100);
    expect(calls <= 4, isTrue);
    r.stop();
  });
  test('a tick after stop() does nothing', () async {
    var calls = 0;
    final r = PeriodicRefresh(() async => calls++, interval: _tick)..start();
    r.stop();
    await r.tick();
    expect(calls, 0);
  });
}
