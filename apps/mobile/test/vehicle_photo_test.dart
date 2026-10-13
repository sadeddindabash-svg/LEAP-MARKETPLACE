import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/vehicle.dart';

// A vehicle is added in three steps (Brand with a photo, Model without one, Year with a photo). The picture of a saved vehicle is its YEAR photo, else its
// BRAND photo; a year entry holding one year is written as just the year.
Map<String, dynamic> baseJson() => {
      'generationId': 'gen_1',
      'year': 2021,
      'brand': 'Geely',
      'model': 'Coolray',
      'generation': '2021',
      'yearStart': 2021,
      'yearEnd': 2021,
    };

void main() {
  group('the picture of a saved vehicle', () {
    test('the year photo comes first, then the brand photo; the model photo is never used', () {
      final all = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '/uploads/year.jpg', 'modelPhotoUrl': '/uploads/model.jpg', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(all.heroPhotoUrl, '/uploads/year.jpg');
      final noYear = Vehicle.fromJson({...baseJson(), 'modelPhotoUrl': '/uploads/model.jpg', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(noYear.heroPhotoUrl, '/uploads/brand.jpg');
      final modelOnly = Vehicle.fromJson({...baseJson(), 'modelPhotoUrl': '/uploads/model.jpg'});
      expect(modelOnly.heroPhotoUrl, null);
    });

    test('with no photo at all there is no picture (the screens then show a generic car icon)', () {
      expect(Vehicle.fromJson(baseJson()).heroPhotoUrl, null);
    });

    test('an empty photo address counts as no photo, so the next one is used', () {
      final v = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(v.heroPhotoUrl, '/uploads/brand.jpg');
    });

    test('a reply from a server that does not send the year photo yet still works', () {
      final v = Vehicle.fromJson({...baseJson(), 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(v.generationPhotoUrl, null);
      expect(v.heroPhotoUrl, '/uploads/brand.jpg');
    });

    test('the year photo survives saving and loading the vehicle again', () {
      final v = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '/uploads/year.jpg'});
      expect(v.toJson()['generationPhotoUrl'], '/uploads/year.jpg');
      expect(Vehicle.fromJson(v.toJson()).heroPhotoUrl, '/uploads/year.jpg');
    });
  });

  group('how a vehicle year is written', () {
    test('a one-year entry named by its year is just the year, in the garage and in the picker', () {
      expect(Vehicle.fromJson(baseJson()).subLabel, '2021');
      expect(generationDisplay('2021', 2021, 2021), '2021');
    });

    test('an older entry keeps its name and range', () {
      final older = Vehicle.fromJson({...baseJson(), 'generation': 'F20', 'year': 2017, 'yearStart': 2015, 'yearEnd': 2019});
      expect(older.subLabel, 'F20 · 2017');
      expect(generationDisplay('F20', 2015, 2019), 'F20 (2015–2019)');
      expect(generationDisplay('G20', 2019, null), 'G20 (2019–present)');
    });

    test('an entry whose name is not its year, or whose range is longer, is still shown with its range', () {
      expect(generationDisplay('Facelift', 2021, 2021), 'Facelift (2021–2021)');
      expect(generationDisplay('2021', 2021, 2022), '2021 (2021–2022)');
    });
  });
}
