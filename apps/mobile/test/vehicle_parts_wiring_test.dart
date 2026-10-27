import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The "Parts for your car" screen is wired in: the garage button opens it with the car, the route exists, and every word it uses is in lib/core/app_strings.dart in English AND Arabic.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
String _read(String path) => File(path).readAsStringSync();

void main() {
  final garage = _read('lib/features/garage/garage_screen.dart');
  final app = _read('lib/app.dart');
  final screen = _read('lib/features/garage/vehicle_parts_screen.dart');
  final strings = _read('lib/core/app_strings.dart');

  group('the garage button', () {
    test('opens the parts of THAT car (the one whose button was pressed) instead of only closing the page', () {
      expect(garage.contains("onPressed: () => context.push('/vehicle-parts', extra: v),"), isTrue);
      expect(garage.contains('Navigator.of(context).pop(v)'), isFalse);
      expect(garage.contains("tr(context, 'view_compatible_parts')"), isTrue);
    });
  });

  group('the route', () {
    test('exists, builds the screen from the car it is given, and falls back to the garage without one', () {
      expect(app.contains("path: '/vehicle-parts'"), isTrue);
      expect(app.contains('vehicle is Vehicle ? VehiclePartsScreen(vehicle: vehicle) : const GarageScreen()'), isTrue);
      expect(app.contains("import 'features/garage/vehicle_parts_screen.dart';"), isTrue);
      expect(app.contains("import 'models/vehicle.dart';"), isTrue);
    });
  });

  group('the screen asks the server for the parts that fit that car', () {
    test('by the car\'s generation and year, in the page language', () {
      expect(screen.contains('fetchProducts(generationId: widget.vehicle.generationId, year: widget.vehicle.year'), isTrue);
      expect(screen.contains('lang: language'), isTrue);
    });
    test('each part opens its product page, and Change goes back to the garage', () {
      expect(screen.contains("context.push('/product/\${shown[i].id}')"), isTrue);
      expect(screen.contains('onPressed: () => context.pop()'), isTrue);
    });
  });

  group('the wording', () {
    final keys = RegExp(r"tr\(context, '(vparts_[a-z_]+)'\)").allMatches(screen).map((m) => m.group(1)!).toSet();
    String? entry(String key) => RegExp("    '$key': \\{(.*)\\},").firstMatch(strings)?.group(1);

    test('the screen uses the six keys we expect', () {
      for (final k in ['vparts_title', 'vparts_change', 'vparts_all', 'vparts_count', 'vparts_one', 'vparts_none']) {
        expect(keys.contains(k), isTrue, reason: k);
      }
    });
    test('every key it uses has an English and an Arabic text', () {
      for (final k in keys) {
        final e = entry(k);
        expect(e != null, isTrue, reason: 'missing key $k');
        expect(e!.contains("'en': '"), isTrue, reason: '$k has no English');
        expect(RegExp(r'[\u0600-\u06FF]').hasMatch(e), isTrue, reason: '$k Arabic is not Arabic');
      }
    });
    test('the count sentence carries the number in both languages', () {
      expect('{n}'.allMatches(entry('vparts_count')!).length, equals(2));
    });
  });
}
