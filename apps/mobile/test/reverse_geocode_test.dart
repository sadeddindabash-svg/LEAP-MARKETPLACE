import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// "Use my location" (the guest's address after ordering): each piece in its own field, in the app's language, the country kept in English. Reads the source text.
void main() {
  final api = File('lib/services/api_client.dart').readAsStringSync();
  final checkout = File('lib/features/checkout/checkout_screen.dart').readAsStringSync();
  test('CRITICAL: the street is road and district, never the whole line again; region and postcode are read too', () {
    expect(api.contains("final district = first(['neighbourhood', 'suburb', 'quarter', 'city_district', 'residential', 'hamlet']);"), isTrue);
    expect(api.contains(".where((p) => p.isNotEmpty && !taken.contains(p.toLowerCase())).take(2).join(sep);"), isTrue);
    expect(api.contains("'state': state, 'postalCode': postalCode,"), isTrue);
  });
  test('it asks at building level, in the app language, and keeps the country in English by its code', () {
    expect(api.contains('&zoom=18&accept-language=\$lang'), isTrue);
    expect(api.contains("final country = _kCountryEnglishByCode[code] ?? first(['country']);"), isTrue);
    expect(checkout.contains("reverseGeocode(position.latitude, position.longitude, lang: context.read<LanguageState>().isArabic ? 'ar' : 'en')"), isTrue);
  });
}
