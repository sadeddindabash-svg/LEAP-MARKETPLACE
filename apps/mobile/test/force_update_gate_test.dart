import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/widgets/force_update_gate.dart';

/// Real, checked-in test for `isVersionBelow` (see
/// lib/widgets/force_update_gate.dart's own header comment for why
/// this exists and what it protects: the force-update gate that
/// blocks a genuinely outdated real app).
///
/// HONEST NOTE: this sandbox has no real Flutter/Dart SDK to actually
/// run `flutter test` against, so this hasn't been executed here --
/// it was written against the exact same 6 cases already manually
/// verified correct via a Python mirror of this same real logic
/// earlier in this session (see that session's own real output).
/// Please run `flutter test` for real the first time to confirm.
void main() {
  group('isVersionBelow', () {
    test('a real, genuinely older version is below the minimum', () {
      expect(isVersionBelow('1.0.0', '1.5.0'), isTrue);
    });

    test('a real, genuinely newer version is not below the minimum', () {
      expect(isVersionBelow('2.0.0', '1.9.9'), isFalse);
    });

    test('equal real versions are not below each other', () {
      expect(isVersionBelow('1.5.0', '1.5.0'), isFalse);
    });

    test(
      'CRITICAL: the classic string-comparison trap this exists to avoid -- '
      '"1.10.0" is genuinely NOT below "1.9.0" numerically, even though a '
      'plain string comparison would incorrectly say otherwise (comparing '
      '"1" vs "9" character by character)',
      () {
        expect(isVersionBelow('1.10.0', '1.9.0'), isFalse);
      },
    );

    test('a real patch-level difference is caught correctly', () {
      expect(isVersionBelow('1.4.9', '1.5.0'), isTrue);
    });

    test('a real short-form version ("1.5") is treated as "1.5.0"', () {
      expect(isVersionBelow('1.5', '1.5.0'), isFalse);
    });
  });
}
