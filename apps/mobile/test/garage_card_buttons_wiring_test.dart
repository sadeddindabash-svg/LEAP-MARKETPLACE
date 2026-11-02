import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String _read(String path) => File(path).readAsStringSync();

void main() {
  final garage = _read('lib/features/garage/garage_screen.dart');
  final strings = _read('lib/core/app_strings.dart');

  group('My Garage car card: the buttons sit under the details, the model name has the whole width', () {
    test('the model name is no longer in a row with the buttons', () {
      expect(garage.contains("Expanded(child: Text(v.labelFor(isAr)"), isFalse);
      expect(garage.contains("Text(v.labelFor(isAr), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17"), isTrue);
    });

    test('"Set as default" (or the Default badge) and "Remove vehicle" side by side, then "View compatible parts" across the card', () {
      final setDefault = garage.indexOf("tr(context, 'set_as_default_short')");
      final remove = garage.indexOf("onPressed: () => _confirmRemove(v),");
      final parts = garage.indexOf("tr(context, 'view_compatible_parts')");
      expect(setDefault, greaterThan(0));
      expect(remove, greaterThan(setDefault));
      expect(parts, greaterThan(remove));
      expect(garage.contains("tr(context, 'remove_vehicle'), maxLines: 1"), isTrue);
      expect(garage.contains('IconButton(icon: Icon(Icons.close'), isFalse);
    });

    test('the short label has English and Arabic', () {
      expect(strings.contains("'set_as_default_short': {'en': 'Set as default', 'ar': 'تعيين كإفتراضي'}"), isTrue);
    });
  });
}
