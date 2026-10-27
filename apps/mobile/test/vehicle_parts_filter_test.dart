import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/vehicle_parts_filter.dart';

// The chips of the "Parts for your car" screen: the categories of the parts that fit the car with their counts, the parts of one category, and the category written for people. Plain Dart: no device needed.
void main() {
  group('the categories with their counts', () {
    test('in the order they first appear, each counted', () {
      final c = categoryCounts(['brake', 'filters', 'brake', 'lighting', 'brake', 'filters']);
      expect(c.map((e) => e.key).toList(), equals(['brake', 'filters', 'lighting']));
      expect(c.map((e) => e.value).toList(), equals([3, 2, 1]));
    });
    test('blank categories are not chips, and spaces around a name do not make a second chip', () {
      final c = categoryCounts(['brake', ' brake ', '', '   ', 'brake']);
      expect(c.length, equals(1));
      expect(c.first.key, equals('brake'));
      expect(c.first.value, equals(3));
    });
    test('no parts, no chips', () {
      expect(categoryCounts(<String>[]).length, equals(0));
    });
  });

  group('the parts of one category', () {
    final items = ['brake:1', 'filters:2', 'brake:3', 'lighting:4'];
    String cat(String s) => s.split(':').first;
    test('no category (All) is every part, in the same order', () {
      expect(filterByCategory<String>(items, null, cat), equals(items));
    });
    test('a category keeps only its parts, in order', () {
      expect(filterByCategory<String>(items, 'brake', cat), equals(['brake:1', 'brake:3']));
      expect(filterByCategory<String>(items, 'lighting', cat), equals(['lighting:4']));
    });
    test('a category nothing is in gives an empty list', () {
      expect(filterByCategory<String>(items, 'glass', cat).length, equals(0));
    });
    test('spaces around the stored category do not hide a part', () {
      expect(filterByCategory<String>(['brake :1'], 'brake', cat).length, equals(1));
    });
    test('the chips and the filter agree: every chip count is the number of parts its filter gives', () {
      for (final e in categoryCounts(items.map(cat))) {
        expect(filterByCategory<String>(items, e.key, cat).length, equals(e.value));
      }
    });
  });

  group('a category written for people', () {
    test('underscores and dashes become spaces and the first letter is a capital', () {
      expect(prettyCategory('brake_system'), equals('Brake system'));
      expect(prettyCategory('brake-pads'), equals('Brake pads'));
      expect(prettyCategory('  filters '), equals('Filters'));
    });
    test('a readable name is left as it is, and nothing stays nothing', () {
      expect(prettyCategory('Brake System'), equals('Brake System'));
      expect(prettyCategory(''), equals(''));
    });
  });
}
