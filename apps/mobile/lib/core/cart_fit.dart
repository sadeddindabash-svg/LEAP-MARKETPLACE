import 'package:flutter/material.dart';
import '../models/fit_verdict.dart';
import '../models/product.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Does a basket line fit the buyer's car (the default car of their garage)? The same rule as the product screen (models/fit_verdict.dart). The garage and each
/// part are read once and remembered, so the basket does not ask again for every redraw. No signed-in buyer, no car, or a part that fits any car = nothing.
class CartFit {
  final bool fits;
  final String car; // the buyer's car, as shown
  final String forText; // what the part is for (when it does not fit)
  final String searchText; // what "Find it for my car" searches for
  const CartFit({required this.fits, required this.car, this.forText = '', this.searchText = ''});

  static Future<List<Vehicle>>? _garage;
  static String? _garageToken;
  static final Map<String, Future<Product?>> _products = {};

  /// Forgets the garage (a car was added, removed or made the default).
  static void forgetGarage() {
    _garage = null;
    _garageToken = null;
  }

  static Future<CartFit?> of(String productId, {required String? token, required bool arabic}) async {
    if (token == null) return null;
    if (_garageToken != token) {
      _garageToken = token;
      _garage = ApiClient().fetchMyGarage(token).catchError((_) => <Vehicle>[]);
    }
    final cars = await _garage!;
    if (cars.isEmpty) return null;
    final car = cars.firstWhere((v) => v.isDefault, orElse: () => cars.first);
    final lang = arabic ? 'ar' : 'en';
    final p = await (_products['$productId|$lang'] ??= ApiClient().fetchProductById(productId, lang: lang).then<Product?>((p) => p).catchError((_) => null));
    if (p == null || p.fitsVehicleIds.isEmpty) return null; // fits any car: nothing to say
    final verdict = fitVerdict(generationId: car.generationId, year: car.year, versionId: car.versionId, fitsVehicleIds: p.fitsVehicleIds, fitVersions: p.fitVersions);
    final carText = '${car.labelFor(arabic)} · ${car.year}';
    if (verdict.kind == FitKind.needVersion) return null; // cannot be checked until the car's version is chosen (the product screen asks for it)
    if (verdict.confirmed) return CartFit(fits: true, car: carText);
    final forText = verdict.kind == FitKind.wrongVersion
        ? verdict.versionIds.map((id) => versionNameOf(p.fitVersionNames, id, arabic)).join('، ')
        : [p.brand, p.model, if (p.year != null) '· ${p.year}'].whereType<String>().where((s) => s.trim().isNotEmpty).join(' ');
    return CartFit(fits: false, car: carText, forText: forText, searchText: (p.part != null && p.part!.isNotEmpty) ? p.part! : p.name);
  }
}

/// The ribbon across the corner of a basket line's photo: green "✓ FIT" / red "✕ NOT FIT" (Flutter's Banner: it moves to the other corner in Arabic by itself).
class FitRibbon extends StatelessWidget {
  final CartFit? fit;
  final Widget child;
  final bool arabic;
  const FitRibbon({super.key, required this.fit, required this.child, required this.arabic});

  @override
  Widget build(BuildContext context) {
    final f = fit;
    if (f == null) return child;
    final text = f.fits ? (arabic ? '✓ متوافقة' : '✓ FIT') : (arabic ? '✕ غير متوافقة' : '✕ NOT FIT');
    return Banner(
      message: text,
      location: BannerLocation.topStart,
      color: f.fits ? const Color(0xFF1E9D6B) : const Color(0xFFC62F26),
      textStyle: TextStyle(color: Colors.white, fontSize: arabic ? 7.5 : 8, fontWeight: FontWeight.w900, height: 1.0, letterSpacing: arabic ? 0 : 0.4),
      child: child,
    );
  }
}
