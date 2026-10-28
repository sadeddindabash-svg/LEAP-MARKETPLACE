import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The "Fits" row is wired into the app: the Product reads the server's list, the specifications use the new row (and keep the old rows for an older server), and every word it uses is in lib/core/app_strings.dart in English AND Arabic.
// This reads the source text, so it needs no device. Run from the mobile app's folder (as `flutter test` does).
String _read(String path) => File(path).readAsStringSync();

void main() {
  final product = _read('lib/models/product.dart');
  final screen = _read('lib/features/catalog/product_screen.dart');
  final widget = _read('lib/widgets/fits_spec_row.dart');
  final strings = _read('lib/core/app_strings.dart');

  group('the Product', () {
    test('reads the groups, the number of models and the number of vehicles from the server', () {
      expect(product.contains("fitGroups: FitGroup.listFromJson(json['fitGroups']),"), isTrue);
      expect(product.contains("fitGroupCount: json['fitGroupCount'] as int?,"), isTrue);
      expect(product.contains("fitVehicleCount: json['fitVehicleCount'] as int?,"), isTrue);
      expect(product.contains("import 'fit_group.dart';"), isTrue);
    });
    test('the new fields are optional (every place that builds a Product keeps working)', () {
      expect(product.contains('this.fitGroups,'), isTrue);
      expect(product.contains('required this.fitGroups'), isFalse);
    });
  });

  group('the specifications', () {
    test('with the list: ONE Fits row; without it (an older server): the three old rows, exactly as before', () {
      expect(screen.contains('if (fitGroups != null)\n                            FitsSpecRow(index: 0, groups: fitGroups, groupCount: product.fitGroupCount, vehicleCount: product.fitVehicleCount)'), isTrue);
      for (final old in ["_SpecRow(index: 0, label: _lBrand, value: product.brand ?? _lNotSpecified)", "_SpecRow(index: 1, label: _lModel, value: product.model ?? _lNotSpecified)", "_SpecRow(index: 2, label: _lYear, value: product.year?.toString() ?? _lNotSpecified)"]) {
        expect(screen.contains(old), isTrue, reason: old);
      }
    });
    test('the part number row follows the Fits row (index 1) or the three old rows (index 3), and later rows keep counting', () {
      expect(screen.contains('_SpecRow(index: fitGroups != null ? 1 : 3, label: _lPartNo'), isTrue);
      expect(screen.contains('index: rows.length, label: attr.name'), isTrue);
    });
    test('the screen imports the row', () {
      expect(screen.contains("import '../../widgets/fits_spec_row.dart';"), isTrue);
    });
  });

  group('the row', () {
    test('says universal for no fitment, shows the models, and has the link', () {
      expect(widget.contains("tr(context, 'fits_universal')"), isTrue);
      expect(widget.contains('fitsView(widget.groups, widget.groupCount, expanded: _open)'), isTrue);
      expect(widget.contains("tr(context, 'fits_show_fewer')"), isTrue);
    });
  });

  group('the wording', () {
    final keys = RegExp(r"tr\(context, '(fits_[a-z_]+)'\)").allMatches(widget).map((m) => m.group(1)!).toSet();
    String? entry(String key) => RegExp("    '$key': \\{(.*)\\},").firstMatch(strings)?.group(1);
    test('the row uses the six keys we expect', () {
      for (final k in ['fits_label_row', 'fits_universal', 'fits_more_model_one', 'fits_more_models', 'fits_vehicles_in_all', 'fits_show_fewer']) {
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
    test('the sentences that carry a number keep their {n} in both languages', () {
      expect('{n}'.allMatches(entry('fits_more_models')!).length, equals(2));
      expect('{n}'.allMatches(entry('fits_vehicles_in_all')!).length, equals(2));
    });
  });
}
