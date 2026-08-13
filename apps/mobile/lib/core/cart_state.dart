import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/cart_item.dart';
import '../services/api_client.dart';

/// Holds the buyer's cart and syncs every change to services/api/cart in
/// real time — there is no local-only cart state that later needs
/// reconciling with the server; every add/remove/quantity-change is a real
/// network call, and the UI reflects whatever the server actually has.
///
/// The cart ID is a per-device UUID persisted in secure storage (not tied
/// to login — this is deliberate, since guest checkout must work without
/// an account; see BUY-034 and the Charter's guest-checkout decision).
class CartState extends ChangeNotifier {
  static const _cartIdKey = 'leap_cart_id';
  final _secureStorage = const FlutterSecureStorage();
  final ApiClient _apiClient;

  String? _cartId;
  List<CartItem> _items = [];
  bool _isLoading = true;
  String? _errorMessage;

  CartState({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient() {
    _init();
  }

  bool get isLoading => _isLoading;
  List<CartItem> get items => List.unmodifiable(_items);
  String? get errorMessage => _errorMessage;
  String? get cartId => _cartId;

  double get total => _items.fold(0.0, (sum, i) => sum + i.lineTotal);
  int get itemCount => _items.fold(0, (sum, i) => sum + i.quantity);
  bool get isEmpty => _items.isEmpty;

  /// Groups items by supplier for display — mirrors BUY-031: the buyer
  /// sees one basket, but it's really heading to multiple suppliers.
  Map<String, List<CartItem>> get itemsBySupplier {
    final map = <String, List<CartItem>>{};
    for (final item in _items) {
      final key = item.supplierName ?? 'Unknown supplier';
      (map[key] ??= []).add(item);
    }
    return map;
  }

  Future<void> _init() async {
    var cartId = await _secureStorage.read(key: _cartIdKey);
    if (cartId == null) {
      cartId = const Uuid().v4();
      await _secureStorage.write(key: _cartIdKey, value: cartId);
    }
    _cartId = cartId;
    await refresh();
  }

  Future<void> refresh() async {
    if (_cartId == null) return;
    _isLoading = true;
    notifyListeners();
    try {
      _items = await _apiClient.fetchCart(_cartId!);
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Could not load your basket. Check your connection and try again.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addItem(String productId, int quantity) async {
    if (_cartId == null) return;
    _items = await _apiClient.addCartItem(_cartId!, productId, quantity);
    _errorMessage = null;
    notifyListeners();
  }

  /// Sets the exact quantity for a product already in the cart (used by
  /// the +/- stepper). A quantity of 0 or less removes the item.
  Future<void> setQuantity(String productId, int quantity) async {
    if (_cartId == null) return;
    _items = await _apiClient.setCartItemQuantity(_cartId!, productId, quantity);
    notifyListeners();
  }

  Future<void> removeItem(String productId) async {
    if (_cartId == null) return;
    _items = await _apiClient.removeCartItem(_cartId!, productId);
    notifyListeners();
  }

  /// Called after a successful order placement — clears the local view of
  /// the cart. Doesn't need to call the backend again per item since
  /// placing an order doesn't automatically empty the cart server-side
  /// (carts and orders are intentionally decoupled — see the data model);
  /// this removes each item explicitly so server state matches.
  Future<void> clearAfterOrder() async {
    if (_cartId == null) return;
    for (final item in List<CartItem>.from(_items)) {
      await _apiClient.removeCartItem(_cartId!, item.productId);
    }
    _items = [];
    notifyListeners();
  }
}
