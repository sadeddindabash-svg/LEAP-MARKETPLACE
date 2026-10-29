import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/fit_verdict.dart';
import 'package:leap_mobile/models/product.dart';

// Does the part fit the buyer's car, using the buyer's VERSION only when the part is narrowed to some versions. Plain Dart: no device needed.
FitVerdict _v({String gen = 'g', int year = 2023, String? version = 'v2', List<String> listed = const ['g'], Map<String, List<String>> rules = const {}}) =>
    fitVerdict(generationId: gen, year: year, versionId: version, fitsVehicleIds: listed, fitVersions: rules);

void main() {
  group('a part that is NOT narrowed (every part before versions, and the default)', () {
    test('CRITICAL: fits every version of a listed car: with or without a version, whatever the version', () {
      expect(_v().kind, FitKind.fits);
      expect(_v(version: null).kind, FitKind.fits);
      expect(_v(version: '').kind, FitKind.fits);
      expect(_v(version: 'anything').kind, FitKind.fits);
      expect(_v(rules: {'g|2023': []}).kind, FitKind.fits);
    });
    test('a car that is not on the list is not_listed (the screen keeps its own message)', () {
      expect(_v(listed: ['x']).kind, FitKind.notListed);
      expect(_v(listed: const []).kind, FitKind.notListed);
      expect(_v(listed: ['x'], rules: {'g|2023': ['v1']}).kind, FitKind.notListed);
    });
  });
  group('a part narrowed to some versions', () {
    test('CRITICAL: the buyer\'s version is one of them: fits, with the versions', () {
      final r = _v(rules: {'g|2023': ['v2', 'v3']});
      expect(r.kind, FitKind.fitsVersions);
      expect(r.versionIds, ['v2', 'v3']);
      expect(r.confirmed, isTrue);
    });
    test('CRITICAL: the buyer\'s version is NOT one of them: wrong version, NOT a confirmed fit', () {
      final r = _v(version: 'v1', rules: {'g|2023': ['v2', 'v3']});
      expect(r.kind, FitKind.wrongVersion);
      expect(r.versionIds, ['v2', 'v3']);
      expect(r.confirmed, isFalse);
    });
    test('CRITICAL: the saved car has no version yet: it cannot be checked, so it is not confirmed either', () {
      for (final none in [null, '']) {
        final r = _v(version: none, rules: {'g|2023': ['v2']});
        expect(r.kind, FitKind.needVersion);
        expect(r.confirmed, isFalse);
      }
    });
    test('the narrowing only applies to the car (generation and year) it is for', () {
      final rules = {'g|2023': ['v3']};
      expect(_v(year: 2024, rules: rules).kind, FitKind.fits);
      expect(_v(year: 2023, rules: rules).kind, FitKind.wrongVersion);
    });
  });
  group('reading what the server sends', () {
    test('fitVersions: the right shape is kept, anything else is ignored (an older server sends none)', () {
      expect(parseFitVersions({'g|2023': ['a', 'b'], 'h|2022': [], 'bad': 'x', 5: ['a']}), {'g|2023': ['a', 'b']});
      expect(parseFitVersions(null), isEmpty);
      expect(parseFitVersions('x'), isEmpty);
      expect(parseFitVersions({'g|2023': ['a', 7]}), {'g|2023': ['a']});
    });
    test('fitVersionNames and versionNameOf: Arabic when the app is Arabic and there is one, else English, else the id', () {
      final names = parseFitVersionNames({'a': {'name': 'AWD', 'nameAr': 'دفع رباعي'}, 'b': {'name': 'RWD', 'nameAr': null}, 'c': 5});
      expect(versionNameOf(names, 'a', false), 'AWD');
      expect(versionNameOf(names, 'a', true), 'دفع رباعي');
      expect(versionNameOf(names, 'b', true), 'RWD');
      expect(versionNameOf(names, 'zz', true), 'zz');
      expect(parseFitVersionNames(null), isEmpty);
    });
    test('the product model reads them, and a product from an older server has none (so it fits every version)', () {
      final base = <String, dynamic>{'id': 'p1', 'name': 'Disc', 'category': 'brake', 'price': 10, 'fitsVehicleIds': ['g']};
      final withRules = Product.fromJson({...base, 'fitVersions': {'g|2023': ['v2']}, 'fitVersionNames': {'v2': {'name': 'AWD', 'nameAr': null}}});
      expect(withRules.fitVersions, {'g|2023': ['v2']});
      expect(withRules.fitVersionNames['v2']?['name'], 'AWD');
      final old = Product.fromJson(base);
      expect(old.fitVersions, isEmpty);
      expect(old.fitVersionNames, isEmpty);
    });
  });
}
