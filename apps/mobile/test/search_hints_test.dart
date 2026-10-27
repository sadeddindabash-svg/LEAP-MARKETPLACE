import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/search_hints.dart';

// The suggestions that slide through the home search bar: the same four as the website, in both languages, going round in order. Plain Dart: no device needed.
void main() {
  group('the suggestions', () {
    test('there are four in each language, none empty, and Arabic is Arabic', () {
      expect(searchHintsEn.length, equals(4));
      expect(searchHintsAr.length, equals(4));
      for (final h in [...searchHintsEn, ...searchHintsAr]) {
        expect(h.trim().isNotEmpty, isTrue);
      }
      for (final h in searchHintsAr) {
        expect(RegExp(r'[\u0600-\u06FF]').hasMatch(h), isTrue);
      }
    });
    test('they are the website\'s words, in the website\'s order', () {
      expect(searchHintsEn[0], equals('Search “brake pads”'));
      expect(searchHintsEn[1], equals('Search “oil filter”'));
      expect(searchHintsEn[2], equals('Search by OEM number, e.g. 12345-67890'));
      expect(searchHintsEn[3], equals('Search by VIN or by car, e.g. BYD Seal'));
      expect(searchHintsAr[0], equals('ابحث عن «تيل فرامل»'));
      expect(searchHintsAr[3], equals('ابحث برقم الهيكل (VIN) أو بالسيارة، مثل BYD Seal'));
    });
  });

  group('going round', () {
    test('step 0, 1, 2, 3 show them in order and step 4 starts again', () {
      for (var i = 0; i < 8; i++) {
        expect(searchHintAt(false, i), equals(searchHintsEn[i % 4]));
        expect(searchHintAt(true, i), equals(searchHintsAr[i % 4]));
      }
    });
    test('a negative step still lands inside the list', () {
      expect(searchHintAt(false, -1), equals(searchHintsEn[3]));
      expect(searchHintAt(true, -5), equals(searchHintsAr[3]));
    });
    test('the language picks the list', () {
      expect(searchHints(true).first, equals(searchHintsAr.first));
      expect(searchHints(false).first, equals(searchHintsEn.first));
    });
  });

  group('the timing', () {
    test('each suggestion stays 3 seconds and the slide takes half a second (like the website)', () {
      expect(searchHintShowMs, equals(3000));
      expect(searchHintSlideMs, equals(500));
    });
    test('the slide is shorter than the time a suggestion stays', () {
      expect(searchHintSlideMs < searchHintShowMs, isTrue);
    });
  });
}
