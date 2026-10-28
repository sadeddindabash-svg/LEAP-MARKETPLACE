import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/compare_limit.dart';

// The app compares 2 items at a time. Plain Dart: no device needed.
void main() {
  group('how many items can be compared', () {
    test('two, the size of a phone screen (110 + 2 x 140 = 390 px)', () {
      expect(compareMaxItems, equals(2));
      expect(110 + compareMaxItems * 140, equals(390));
    });
    test('the first and the second can be ticked, the third cannot', () {
      expect(canSelectForCompare(0), isTrue);
      expect(canSelectForCompare(1), isTrue);
      expect(canSelectForCompare(2), isFalse);
    });
    test('more than that (a bad count) cannot be ticked either', () {
      expect(canSelectForCompare(3), isFalse);
      expect(canSelectForCompare(4), isFalse);
      expect(canSelectForCompare(99), isFalse);
    });
  });
}
