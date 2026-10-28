import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/fit_group.dart';

// What a part fits, as the server sends it (fitGroups): how it is read, the years written as ranges, the names in each language, and what the "Fits" row shows collapsed and opened. Plain Dart: no device needed.
Map<String, dynamic> _g(String model, List<List<int>> ranges, {String brand = 'BYD', Object? brandAr, Object? modelAr, Object? count = 1}) => {'brand': brand, 'brandAr': brandAr, 'model': model, 'modelAr': modelAr, 'ranges': ranges, 'vehicleCount': count};
FitGroup _fg(String model) => FitGroup(brand: 'BYD', model: model, ranges: [[2022, 2022]]);

void main() {
  group('reading the server\'s list', () {
    test('a group keeps its names, its year ranges and its vehicle count', () {
      final g = FitGroup.tryParse(_g('Seal', [[2022, 2024], [2026, 2026]], brandAr: 'بي واي دي', modelAr: 'سيل', count: 4))!;
      expect(g.brand, equals('BYD'));
      expect(g.model, equals('Seal'));
      expect(g.ranges.length, equals(2));
      expect(g.ranges[0][1], equals(2024));
      expect(g.vehicleCount, equals(4));
      expect(g.years, equals('2022–2024, 2026'));
    });
    test('no list at all (an older server, or the fitment could not be read) is null, NEVER an empty list: the screen must not say universal', () {
      expect(FitGroup.listFromJson(null) == null, isTrue);
      expect(FitGroup.listFromJson('x') == null, isTrue);
      expect(FitGroup.listFromJson(5) == null, isTrue);
    });
    test('an empty list is a part with no fitment at all (universal)', () {
      final l = FitGroup.listFromJson([]);
      expect(l != null, isTrue);
      expect(l!.length, equals(0));
    });
    test('a damaged entry is skipped, the good ones are kept, and nothing crashes', () {
      final l = FitGroup.listFromJson([_g('Seal', [[2022, 2022]]), null, 'x', {'brand': 5, 'model': 'Z'}, {'brand': '', 'model': ''}, _g('Dolphin', [[2023, 2023]])])!;
      expect(l.map((g) => g.model).toList(), equals(['Seal', 'Dolphin']));
    });
    test('bad year ranges are dropped, the group stays', () {
      final g = FitGroup.tryParse({'brand': 'BYD', 'model': 'Seal', 'ranges': [[2024, 2022], [2023], ['a', 'b'], [2025, 2025]]})!;
      expect(g.years, equals('2025'));
      expect(FitGroup.tryParse({'brand': 'BYD', 'model': 'Seal'})!.years, equals(''));
    });
  });

  group('the years and the names', () {
    test('a run is one range with an en dash, a single year is the year, several are separated by commas', () {
      expect(formatRanges([[2022, 2024]]), equals('2022–2024'));
      expect(formatRanges([[2023, 2023]]), equals('2023'));
      expect(formatRanges([[2020, 2021], [2023, 2023], [2025, 2027]]), equals('2020–2021, 2023, 2025–2027'));
      expect(formatRanges([]), equals(''));
    });
    test('the name is brand and model, in Arabic when asked and the Arabic names exist, otherwise English', () {
      final g = FitGroup.tryParse(_g('Seal', [[2022, 2022]], brandAr: 'بي واي دي', modelAr: 'سيل'))!;
      expect(g.name(false), equals('BYD Seal'));
      expect(g.name(true), equals('بي واي دي سيل'));
      expect(FitGroup.tryParse(_g('Seal', [[2022, 2022]]))!.name(true), equals('BYD Seal'));
      expect(FitGroup.tryParse(_g('Seal', [[2022, 2022]], brandAr: 'بي واي دي'))!.name(true), equals('بي واي دي Seal'));
    });
  });

  group('what the Fits row shows', () {
    final five = [_fg('Seal'), _fg('Dolphin'), _fg('Han'), _fg('Tang'), _fg('Atto 3')];
    test('up to three models: all shown, no link', () {
      final v = fitsView(five.sublist(0, 3), 3, expanded: false);
      expect(v.shown.length, equals(3));
      expect(v.collapsible, isFalse);
    });
    test('more than three: three shown with a link saying how many are behind it; opened shows all', () {
      final closed = fitsView(five, 5, expanded: false);
      expect(closed.shown.length, equals(3));
      expect(closed.collapsible, isTrue);
      expect(closed.hiddenModels, equals(2));
      expect(closed.unlisted, equals(0));
      expect(fitsView(five, 5, expanded: true).shown.length, equals(5));
    });
    test('one model behind the link is 1', () {
      expect(fitsView(five.sublist(0, 4), 4, expanded: false).hiddenModels, equals(1));
    });
    test('when the server sent only part of a very long list, the real number is used and the rest is counted as not listed', () {
      final v = fitsView(five, 80, expanded: false);
      expect(v.hiddenModels, equals(77));
      expect(v.unlisted, equals(75));
    });
    test('a count smaller than the list (a bad answer) never gives a negative number of unlisted models', () {
      expect(fitsView(five, 2, expanded: false).unlisted, equals(0));
      expect(fitsView(five, null, expanded: false).hiddenModels, equals(2));
    });
    test('three lines to start with, like the website', () {
      expect(fitCollapsedLines, equals(3));
    });
  });
}
