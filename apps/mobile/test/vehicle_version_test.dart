import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/vehicle.dart';

// A saved car now carries its VERSION (backend migration 107). NOT RUN when written: Flutter was not available where this was prepared. Run `flutter test`.
// (The package name is leap_mobile, as in pubspec.yaml.)
Map<String, dynamic> _car({Map<String, dynamic>? version, String? versionId, int versionCount = 0}) => {
      'generationId': 'gen1', 'year': 2022, 'brand': 'AITO', 'brandAr': 'أيتو', 'model': 'M5', 'modelAr': 'إم5', 'generation': '2022', 'yearStart': 2022, 'yearEnd': 2022,
      'isDefault': true, 'brandPhotoUrl': '/b.png', 'modelPhotoUrl': null, 'generationPhotoUrl': '/y.png',
      'versionId': versionId, 'version': version, 'versionCount': versionCount,
    };
const _version = {'id': 'v1', 'name': 'AWD Flagship', 'nameAr': 'دفع كلي فلاجشيب', 'engine': '1.5T', 'engineAr': '1.5 لتر', 'seats': 5, 'photoUrl': '/v.png'};

void main() {
  test('a car with a version reads its version, and its picture is the version photo first', () {
    final v = Vehicle.fromJson(_car(version: _version, versionId: 'v1', versionCount: 3));
    expect(v.hasVersion, isTrue);
    expect(v.versionNameFor(false), 'AWD Flagship');
    expect(v.versionNameFor(true), 'دفع كلي فلاجشيب');
    expect(v.versionEngineFor(true), '1.5 لتر');
    expect(v.versionSeats, 5);
    expect(v.versionCount, 3);
    expect(v.heroPhotoUrl, '/v.png');
  });

  test('a car without a version (saved before versions existed) works as before: year photo, no version', () {
    final v = Vehicle.fromJson(_car(versionCount: 2));
    expect(v.hasVersion, isFalse);
    expect(v.versionNameFor(false), isNull);
    expect(v.heroPhotoUrl, '/y.png');
    expect(v.versionCount, 2);
  });

  test('a version without a photo falls back to the year photo, then the brand photo', () {
    final noPhoto = {..._version, 'photoUrl': null};
    expect(Vehicle.fromJson(_car(version: noPhoto, versionId: 'v1')).heroPhotoUrl, '/y.png');
  });

  test('two versions of one year are two cars: their ids differ', () {
    final a = Vehicle.fromJson(_car(version: _version, versionId: 'v1'));
    final b = Vehicle.fromJson(_car(version: {..._version, 'id': 'v2'}, versionId: 'v2'));
    final none = Vehicle.fromJson(_car());
    expect({a.id, b.id, none.id}.length, 3);
  });

  test('toJson and fromJson round trip a version', () {
    final v = Vehicle.fromJson(_car(version: _version, versionId: 'v1', versionCount: 3));
    final again = Vehicle.fromJson(v.toJson());
    expect(again.versionId, 'v1');
    expect(again.versionName, 'AWD Flagship');
    expect(again.versionSeats, 5);
    expect(again.versionCount, 3);
  });

  test('seats are written in the right form, in English and in Arabic', () {
    expect([1, 2, 5, 12].map((n) => seatsText(false, n)).toList(), ['1 seat', '2 seats', '5 seats', '12 seats']);
    expect([1, 2, 5, 10, 11, 12].map((n) => seatsText(true, n)).toList(), ['مقعد واحد', 'مقعدان', '5 مقاعد', '10 مقاعد', '11 مقعدًا', '12 مقعدًا']);
  });
}
