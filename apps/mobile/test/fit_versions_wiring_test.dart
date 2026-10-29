import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The product screen uses the version rule: the badge only for a real fit, and the version notes under the name. This reads the source text, so it needs no device.
void main() {
  final screen = File('lib/features/catalog/product_screen.dart').readAsStringSync();
  final note = File('lib/widgets/fit_version_note.dart').readAsStringSync();
  final strings = File('lib/core/app_strings.dart').readAsStringSync();
  test('the screen computes the verdict from the saved car (its generation, year AND version) and the part\'s version rules', () {
    expect(screen.contains("import '../../models/fit_verdict.dart';"), isTrue);
    expect(screen.contains('fitVerdict(generationId: defaultVehicle!.generationId, year: defaultVehicle!.year, versionId: defaultVehicle!.versionId, fitsVehicleIds: product.fitsVehicleIds, fitVersions: product.fitVersions)'), isTrue);
  });
  test('CRITICAL: the CONFIRMED FIT badge only shows for a real fit, and the old generation-only check is gone', () {
    expect(screen.contains('final isConfirmedFit = fitResult != null && fitResult.confirmed;'), isTrue);
    expect(screen.contains('product.fitsVehicleIds.contains(defaultVehicle!.generationId);'), isFalse);
  });
  test('the version note is placed right under the part\'s name, with the garage as the place to choose a version', () {
    final name = screen.indexOf('Text(product.name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18');
    final noteAt = screen.indexOf('FitVersionNote(verdict: fitResult, vehicle: defaultVehicle, versionNames: product.fitVersionNames, onChooseVersion: () => context.push(\'/garage\')),');
    expect(name > 0 && noteAt > name && noteAt - name < 400, isTrue);
  });
  test('the note shows nothing for a part that fits every version or does not list the car; the wrong-version and need-version boxes exist', () {
    expect(note.contains('v.kind == FitKind.fits || v.kind == FitKind.notListed) return const SizedBox.shrink();'), isTrue);
    expect(note.contains("'fit-wrong-version'"), isTrue);
    expect(note.contains("'fit-need-version'"), isTrue);
    expect(note.contains('onPressed: onChooseVersion'), isTrue);
  });
  test('every word the note uses exists in English and Arabic', () {
    for (final key in ['fit_part_is_for', 'fit_wrong_version', 'fit_wrong_version_detail', 'fit_need_version', 'fit_choose_version']) {
      final line = strings.split('\n').firstWhere((l) => l.contains("'$key':"), orElse: () => '');
      expect(line.contains("'en':"), isTrue, reason: '$key has English');
      expect(line.contains("'ar':"), isTrue, reason: '$key has Arabic');
    }
  });
}
