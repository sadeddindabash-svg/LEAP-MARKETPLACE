import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/vehicle.dart';

// The picture of a saved vehicle: the YEAR photo first, then the model's, then the brand's (the year photo is new: backend migration 102).
Map<String, dynamic> baseJson() => {
      'generationId': 'gen_1',
      'year': 2023,
      'brand': 'Geely',
      'model': 'Coolray',
      'generation': 'First generation',
      'yearStart': 2019,
    };

void main() {
  group('the picture of a saved vehicle', () {
    test('the year photo comes first, then the model photo, then the brand photo', () {
      final all = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '/uploads/year.jpg', 'modelPhotoUrl': '/uploads/model.jpg', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(all.heroPhotoUrl, '/uploads/year.jpg');
      final noYear = Vehicle.fromJson({...baseJson(), 'modelPhotoUrl': '/uploads/model.jpg', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(noYear.heroPhotoUrl, '/uploads/model.jpg');
      final brandOnly = Vehicle.fromJson({...baseJson(), 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(brandOnly.heroPhotoUrl, '/uploads/brand.jpg');
    });

    test('with no photo at all there is no picture (the screens then show a generic car icon)', () {
      expect(Vehicle.fromJson(baseJson()).heroPhotoUrl, null);
    });

    test('an empty photo address counts as no photo, so the next one is used', () {
      final v = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '', 'modelPhotoUrl': '', 'brandPhotoUrl': '/uploads/brand.jpg'});
      expect(v.heroPhotoUrl, '/uploads/brand.jpg');
    });

    test('a reply from a server that does not send the year photo yet still works (older years have none)', () {
      final v = Vehicle.fromJson({...baseJson(), 'modelPhotoUrl': '/uploads/model.jpg'});
      expect(v.generationPhotoUrl, null);
      expect(v.heroPhotoUrl, '/uploads/model.jpg');
    });

    test('the year photo survives saving and loading the vehicle again', () {
      final v = Vehicle.fromJson({...baseJson(), 'generationPhotoUrl': '/uploads/year.jpg'});
      expect(v.toJson()['generationPhotoUrl'], '/uploads/year.jpg');
      expect(Vehicle.fromJson(v.toJson()).heroPhotoUrl, '/uploads/year.jpg');
    });
  });
}
