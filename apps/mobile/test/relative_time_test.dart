import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/features/saved_searches/saved_searches_screen.dart';

/// Real, checked-in test for `relativeTime` (see
/// saved_searches_screen.dart's own header comment on the function
/// itself). Uses the function's own real injectable `now` parameter
/// so every case below is genuinely deterministic, regardless of
/// exactly when a real test run happens to execute.
///
/// HONEST NOTE, same as force_update_gate_test.dart: this sandbox has
/// no real Flutter/Dart SDK to execute `flutter test` against, so
/// this hasn't been run here -- written carefully against the real
/// function's own real logic, but a real `flutter test` run is worth
/// doing to confirm.
void main() {
  final fixedNow = DateTime(2026, 1, 15, 12, 0, 0);

  group('relativeTime', () {
    test('a real null lastCheckedAt (never checked yet)', () {
      expect(relativeTime(null, false), 'Not checked yet');
      expect(relativeTime(null, true), 'لم يُفحص بعد');
    });

    test('under a real minute ago reads as "just now"', () {
      final dt = fixedNow.subtract(const Duration(seconds: 30));
      expect(relativeTime(dt, false, now: fixedNow), 'just now');
    });

    test('a real number of minutes ago', () {
      final dt = fixedNow.subtract(const Duration(minutes: 45));
      expect(relativeTime(dt, false, now: fixedNow), '45m ago');
    });

    test('a real number of hours ago', () {
      final dt = fixedNow.subtract(const Duration(hours: 5));
      expect(relativeTime(dt, false, now: fixedNow), '5h ago');
    });

    test('a real number of days ago', () {
      final dt = fixedNow.subtract(const Duration(days: 3));
      expect(relativeTime(dt, false, now: fixedNow), '3d ago');
    });

    test('the real Arabic strings for each same case', () {
      expect(relativeTime(fixedNow.subtract(const Duration(seconds: 10)), true, now: fixedNow), 'الآن');
      expect(relativeTime(fixedNow.subtract(const Duration(minutes: 20)), true, now: fixedNow), 'منذ 20 د');
      expect(relativeTime(fixedNow.subtract(const Duration(hours: 2)), true, now: fixedNow), 'منذ 2 س');
      expect(relativeTime(fixedNow.subtract(const Duration(days: 1)), true, now: fixedNow), 'منذ 1 يوم');
    });
  });
}
