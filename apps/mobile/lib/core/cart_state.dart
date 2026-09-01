import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/cart_item.dart';
import '../models/cart.dart';
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
  // Confirmed with the person: a real, persisted promo code -- lives
  // on the real backend cart record itself (not just this in-memory
  // state), so it survives navigating away from checkout entirely,
  // even closing and reopening the app.
  String? _appliedPromoCode;
  PromoDetails? _appliedPromoDetails;
  double _promoDiscountUsd = 0;
  // Confirmed with the person: whole-basket checkout price lock,
  // starts when checkout genuinely begins (not when an item is
  // added).
  bool _lockActive = false;
  DateTime? _lockExpiresAt;
  bool _isLoading = true;
  String? _errorMessage;

  CartState({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient() {
    _init();
  }

  bool get isLoading => _isLoading;
  List<CartItem> get items => List.unmodifiable(_items);
  String? get errorMessage => _errorMessage;
  String? get cartId => _cartId;
  String? get appliedPromoCode => _appliedPromoCode;
  PromoDetails? get appliedPromoDetails => _appliedPromoDetails;
  double get promoDiscountUsd => _promoDiscountUsd;
  bool get lockActive => _lockActive;
  DateTime? get lockExpiresAt => _lockExpiresAt;

  double get total => _items.fold(0.0, (sum, i) => sum + i.lineTotal);
  // Confirmed with the person: sum of every real item's own
  // pre-discount total -- what the cart would cost with no product
  // discounts applied at all.
  double get totalBeforeDiscount => _items.fold(0.0, (sum, i) => sum + i.lineOriginalTotal);
  double get totalSaved => totalBeforeDiscount - total;
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

  // Confirmed with the person: single, shared place every real cart
  // response gets applied from, so every method (refresh, add,
  // remove, quantity change, promo apply/clear) consistently updates
  // the real, full state -- items AND the real, persisted promo
  // fields together, never one without the other.
  void _applyCart(Cart cart) {
    _items = cart.items;
    _appliedPromoCode = cart.appliedPromoCode;
    _appliedPromoDetails = cart.appliedPromoDetails;
    _promoDiscountUsd = cart.promoDiscountUsd;
    _lockActive = cart.lockActive;
    _lockExpiresAt = cart.lockExpiresAt;
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
      _applyCart(await _apiClient.fetchCart(_cartId!));
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
    _applyCart(await _apiClient.addCartItem(_cartId!, productId, quantity));
    _errorMessage = null;
    notifyListeners();
  }

  /// Sets the exact quantity for a product already in the cart (used by
  /// the +/- stepper). A quantity of 0 or less removes the item.
  Future<void> setQuantity(String productId, int quantity) async {
    if (_cartId == null) return;
    _applyCart(await _apiClient.setCartItemQuantity(_cartId!, productId, quantity));
    notifyListeners();
  }

  Future<void> removeItem(String productId) async {
    if (_cartId == null) return;
    _applyCart(await _apiClient.removeCartItem(_cartId!, productId));
    notifyListeners();
  }

  /// Confirmed with the person: applies a real promo code, persisted
  /// on the real backend cart -- throws ApiException with the real
  /// backend's own reason (e.g. expired, already used) on an invalid
  /// code, leaving whatever was already applied untouched, matching
  /// the real, already-confirmed and tested backend behavior.
  Future<void> applyPromoCode(String code) async {
    if (_cartId == null) return;
    _applyCart(await _apiClient.applyPromoCode(_cartId!, code));
    notifyListeners();
  }

  /// Clears the real, currently-applied promo code.
  Future<void> removePromoCode() async {
    if (_cartId == null) return;
    _applyCart(await _apiClient.applyPromoCode(_cartId!, null));
    notifyListeners();
  }

  /// Confirmed with the person: called when the buyer genuinely
  /// enters checkout, not when an item is added to the cart. Starts
  /// a fresh 60-minute lock, or does nothing (continues the existing
  /// countdown) if one's already active -- explicitly confirmed:
  /// leaving checkout and returning before it expires does NOT reset
  /// it.
  Future<void> lockPrices() async {
    if (_cartId == null) return;
    _applyCart(await _apiClient.lockPrices(_cartId!));
    notifyListeners();
  }

  /// Called after a successful order placement — clears the local view of
  /// the cart. Doesn't need to call the backend again per item since
  /// placing an order doesn't automatically empty the cart server-side
  /// (carts and orders are intentionally decoupled — see the data model);
  /// this removes each item explicitly so server state matches.
  ///
  /// Confirmed with the person: a placed order also ends the real
  /// promo code's own applied lifetime, same as items -- cleared here
  /// too, matching the real "until he place the order" boundary.
  Future<void> clearAfterOrder() async {
    if (_cartId == null) return;
    for (final item in List<CartItem>.from(_items)) {
      await _apiClient.removeCartItem(_cartId!, item.productId);
    }
    if (_appliedPromoCode != null) {
      await _apiClient.applyPromoCode(_cartId!, null);
    }
    _items = [];
    _appliedPromoCode = null;
    _appliedPromoDetails = null;
    _promoDiscountUsd = 0;
    _lockActive = false;
    _lockExpiresAt = null;
    notifyListeners();
  }
}
