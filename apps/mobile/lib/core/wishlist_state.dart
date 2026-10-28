import 'package:flutter/foundation.dart';
import '../models/wishlist_model.dart';
import '../services/api_client.dart';

/// The one shared wishlist of the app (see WishlistModel): the hearts on the cards, in the product screen's top bar and anywhere else read it, so opening a screen of cards does not ask the server once per card.
/// A single instance, so it needs no registration in the app's providers.
class WishlistState extends ChangeNotifier {
  WishlistState._() {
    _model = WishlistModel(onChanged: notifyListeners);
  }
  static final WishlistState instance = WishlistState._();

  late final WishlistModel _model;

  bool get ready => _model.ready;
  bool isSaved(String productId) => _model.isSaved(productId);

  /// Makes sure the list is that of the signed-in buyer ([token] null = signed out). Cheap to call often: it only asks the server when the list is missing or older than a minute.
  Future<void> ensureLoaded(String? token, {bool force = false}) =>
      _model.ensureLoaded(token, (t) async => (await ApiClient().fetchWishlist(t)).map((p) => p.id).toSet(), force: force);

  Future<bool> toggle(String productId, String token) => _model.toggle(
        productId,
        add: (id) => ApiClient().addToWishlist(token, id),
        remove: (id) => ApiClient().removeFromWishlist(token, id),
      );
}
