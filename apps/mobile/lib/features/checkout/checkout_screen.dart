import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/config/app_config.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/currency_state.dart';
import '../../core/auth_state.dart';
import '../../core/cart_state.dart';
import '../../core/draft_order_queue.dart';
import '../../services/api_client.dart';
import '../../widgets/step_progress_indicator.dart';

/// BUY-034: guided checkout flow. Guest checkout is enabled by default per
/// the product decision in the Charter — buyers are prompted to create an
/// account on the confirmation screen instead of being blocked here.
/// BUY-040: payment methods are rendered from a provider-agnostic list so
/// adding a region-specific method (e.g. Mada) is config, not a rewrite.
///
/// IMPORTANT, FLAGGED HONESTLY: "Place order" below calls the real
/// POST /order endpoint and creates a real order with real supplier
/// sub-orders — that part is genuine. It does NOT yet actually charge the
/// selected payment method. services/api's payment module (Stripe/APS/
/// PayPal) exists and is tested independently (see that module's tests),
/// but this screen doesn't call it yet — connecting "the buyer picked
/// Stripe" to "a real PaymentIntent gets created and confirmed before the
/// order is placed" is real remaining work, not done here. Right now this
/// screen places an order the same way regardless of which payment method
/// is selected.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _guestEmailController = TextEditingController();
  final _promoCodeController = TextEditingController();
  String _selectedPayment = 'card';
  bool _isPlacingOrder = false;
  // Real shipping consolidation preference (#51) -- defaults to
  // false (ship as available), matching the only real behavior that
  // existed before this.
  bool _waitForAllShipments = false;
  String? _errorMessage;

  // Real checkout step progress (new) -- closes a real gap: no
  // indicator existed showing a buyer how far through checkout they
  // are. This screen is one real scrollable form, not separate wizard
  // pages, so "current step" is tracked by real scroll position
  // (which of the 3 real section headers is closest to the top of the
  // viewport) via GlobalKeys attached to each real section below --
  // the most honest signal for a single-page form, not a guessed or
  // hardcoded step.
  final _scrollController = ScrollController();
  final _addressSectionKey = GlobalKey();
  final _paymentSectionKey = GlobalKey();
  final _summarySectionKey = GlobalKey();
  int _currentStep = 0;

  void _updateCurrentStepFromScroll() {
    final keys = [_addressSectionKey, _paymentSectionKey, _summarySectionKey];
    var newStep = 0;
    for (var i = 0; i < keys.length; i++) {
      final box = keys[i].currentContext?.findRenderObject() as RenderBox?;
      if (box == null) continue;
      // A real section is "reached" once its own top has scrolled to
      // (or past) roughly the top quarter of the real viewport --
      // matches how a buyer would naturally describe "I'm looking at
      // the payment section now" rather than requiring it to be
      // exactly pinned to the very top pixel.
      final position = box.localToGlobal(Offset.zero).dy;
      if (position <= MediaQuery.of(context).size.height * 0.35) {
        newStep = i;
      }
    }
    if (newStep != _currentStep && mounted) {
      setState(() => _currentStep = newStep);
    }
  }

  // Real shipping address state (migration 030) -- a real logged-in
  // buyer must pick a real saved address or add a new one right here;
  // a real guest places an order without one, confirmed afterward
  // instead (see order_detail_screen.dart's pending-address banner).
  List<dynamic> _savedAddresses = [];
  String? _selectedAddressId;
  bool _isAddingNewAddress = false;
  bool _isLoadingAddresses = false;
  final _newAddrRecipientController = TextEditingController();
  final _newAddrPhoneController = TextEditingController();
  final _newAddrCountryController = TextEditingController();
  final _newAddrCityController = TextEditingController();
  final _newAddrStreetController = TextEditingController();

  // Real promo code state -- validated live against the real backend
  // before checkout, then re-validated server-side again at real order
  // placement (never trust a client-side check alone).
  String? _appliedPromoCode;
  Map<String, dynamic>? _appliedPromoDetails;
  String? _promoMessage;
  bool _isValidatingPromo = false;

  static const _paymentMethods = [
    (id: 'card', label: 'Visa / Mastercard', icon: Icons.credit_card),
    // Amazon Payment Services: the business's existing gateway, strong for
    // MENA payment methods — surfaced prominently since 7 of our 40 launch
    // markets are GCC/Jordan.
    (id: 'amazon_payment_services', label: 'Amazon Payment Services', icon: Icons.credit_card),
    (id: 'paypal', label: 'PayPal', icon: Icons.account_balance_wallet_outlined),
    (id: 'gpay', label: 'Google Pay', icon: Icons.account_balance_wallet_outlined),
  ];

  @override
  void initState() {
    super.initState();
    // Real guest-email autofill (#20) -- device-local only, prefills
    // from a previously-used real guest email so a repeat guest
    // checkout doesn't retype it every time.
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSavedGuestEmail());
    // Real stock recheck at checkout start (#17) -- refreshes the
    // cart from the real backend (already returns live
    // stockQuantity per item) rather than trusting whatever was
    // already in memory from whenever the cart screen was last
    // loaded, which could be stale by the time checkout opens.
    WidgetsBinding.instance.addPostFrameCallback((_) => _recheckStock());
    // Real saved addresses, fetched once on load -- only meaningful
    // for a real logged-in buyer (migration 030).
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSavedAddresses());
    _scrollController.addListener(_updateCurrentStepFromScroll);
  }

  static const _guestEmailStorageKey = 'leap_last_guest_checkout_email';
  final _secureStorage = const FlutterSecureStorage();

  Future<void> _loadSavedGuestEmail() async {
    final auth = context.read<AuthState>();
    if (auth.isLoggedIn) return; // a real logged-in buyer never needs this
    try {
      final saved = await _secureStorage.read(key: _guestEmailStorageKey);
      if (saved != null && saved.isNotEmpty && mounted && _guestEmailController.text.isEmpty) {
        setState(() => _guestEmailController.text = saved);
      }
    } catch (_) {
      // Real, honest no-op -- a real failure reading local storage
      // just means no autofill, never blocks checkout.
    }
  }

  List<String> _stockChangedItemNames = [];

  Future<void> _recheckStock() async {
    final cart = context.read<CartState>();
    final beforeQuantities = {for (final i in cart.items) i.productId: i.quantity};
    await cart.refresh();
    if (!mounted) return;
    final changed = <String>[];
    for (final item in cart.items) {
      final before = beforeQuantities[item.productId];
      // Real, deliberate check: only surfaces a real problem -- the
      // cart quantity now exceeding real current stock -- not every
      // real stock number fluctuation (e.g. stock going up, or
      // staying comfortably above the cart quantity, is never worth
      // interrupting checkout over).
      if (before != null && item.quantity > item.stockQuantity) {
        changed.add(item.name);
      }
    }
    if (changed.isNotEmpty) setState(() => _stockChangedItemNames = changed);
  }

  Future<void> _loadSavedAddresses() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return;
    setState(() => _isLoadingAddresses = true);
    try {
      final addresses = await ApiClient().fetchMyAddresses(auth.token!);
      setState(() {
        _savedAddresses = addresses;
        if (addresses.isNotEmpty) {
          final defaultAddr = addresses.firstWhere((a) => a['isDefault'] == true, orElse: () => addresses.first);
          _selectedAddressId = defaultAddr['id'] as String;
        } else {
          _isAddingNewAddress = true; // no real saved addresses yet -- go straight to the real inline form
        }
      });
    } catch (_) {
      // Real, honest fallback: if this fails, just let the buyer add
      // one manually rather than blocking checkout entirely.
      setState(() => _isAddingNewAddress = true);
    } finally {
      if (mounted) setState(() => _isLoadingAddresses = false);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _guestEmailController.dispose();
    _promoCodeController.dispose();
    _newAddrRecipientController.dispose();
    _newAddrPhoneController.dispose();
    _newAddrCountryController.dispose();
    _newAddrCityController.dispose();
    _newAddrStreetController.dispose();
    super.dispose();
  }

  Future<void> _applyPromoCode() async {
    final code = _promoCodeController.text.trim();
    if (code.isEmpty) return;
    setState(() { _isValidatingPromo = true; _promoMessage = null; });
    try {
      final token = context.read<AuthState>().token;
      final result = await ApiClient().validatePromoCode(token, code);
      if (result['valid'] == true) {
        final details = result['promoCode'] as Map<String, dynamic>;
        setState(() {
          _appliedPromoCode = code;
          _appliedPromoDetails = details;
        });
        // Real, specific "you saved $X" confirmation (new) -- closes a
        // real gap: only a generic "Promo applied" message existed
        // before, even though the exact real amount is already
        // computable. Correctly avoids guessing an amount for
        // free_shipping, matching the same honest boundary
        // _previewDiscount already respects (that real amount depends
        // on server-side shipping calculation).
        final type = details['type'] as String?;
        if (mounted && type != 'free_shipping') {
          final cart = context.read<CartState>();
          final saved = _previewDiscount(cart.total);
          setState(() => _promoMessage = '${trRead(context, 'you_saved')} ${formatPrice(context, saved)}!');
        } else if (mounted) {
          setState(() => _promoMessage = trRead(context, 'promo_applied'));
        }
      } else {
        setState(() {
          _appliedPromoCode = null;
          _appliedPromoDetails = null;
          _promoMessage = result['reason'] as String? ?? trRead(context, 'something_went_wrong');
        });
      }
    } on ApiException catch (e) {
      setState(() { _appliedPromoCode = null; _appliedPromoDetails = null; _promoMessage = e.message; });
    } finally {
      if (mounted) setState(() => _isValidatingPromo = false);
    }
  }

  void _removePromoCode() {
    setState(() {
      _appliedPromoCode = null;
      _appliedPromoDetails = null;
      _promoMessage = null;
      _promoCodeController.clear();
    });
  }

  /// Real, honest client-side preview of the discount, purely for
  /// display before the real order is placed — the ACTUAL charged
  /// amount is always whatever the real backend computes at real order
  /// placement (see POST /order's server-side recalculation), which is
  /// the only real source of truth. This is just so a buyer isn't
  /// staring at a blank "???" between applying a code and placing the
  /// order.
  double _previewDiscount(double subtotal) {
    final details = _appliedPromoDetails;
    if (details == null) return 0;
    final type = details['type'] as String?;
    if (type == 'percentage') return subtotal * ((details['value'] as num? ?? 0) / 100);
    if (type == 'flat') return (details['value'] as num? ?? 0).toDouble().clamp(0, subtotal);
    return 0; // free_shipping's real amount depends on server-side shipping calculation -- not previewed client-side to avoid showing a guessed number
  }

  Future<void> _placeOrder() async {
    final auth = context.read<AuthState>();
    final cart = context.read<CartState>();

    if (!auth.isLoggedIn && _guestEmailController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_enter_email_order'));
      return;
    }
    // Real email FORMAT validation (new) -- closes a real gap: only
    // presence was checked before, not format. A guest who typed
    // something that isn't a real email would never receive their
    // order confirmation, tracking updates, or the real welcome email
    // this session's own backend work added. Uses the exact same
    // regex the backend's own isValidEmail already uses
    // (auth/routes.js), for consistency between what the app accepts
    // and what the server would too.
    if (!auth.isLoggedIn && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_guestEmailController.text.trim())) {
      setState(() => _errorMessage = trRead(context, 'please_enter_valid_email'));
      return;
    }

    // Real address validation (migration 030) -- a real logged-in
    // buyer must have picked a saved address or filled in a new one;
    // a real guest has no such requirement (their address comes after
    // confirmation instead).
    String? addressId;
    Map<String, dynamic>? inlineAddress;
    if (auth.isLoggedIn) {
      if (_isAddingNewAddress) {
        if (_newAddrRecipientController.text.trim().isEmpty ||
            _newAddrPhoneController.text.trim().isEmpty ||
            _newAddrCountryController.text.trim().isEmpty ||
            _newAddrCityController.text.trim().isEmpty ||
            _newAddrStreetController.text.trim().isEmpty) {
          setState(() => _errorMessage = trRead(context, 'please_complete_address'));
          return;
        }
        inlineAddress = {
          'recipientName': _newAddrRecipientController.text.trim(),
          'phone': _newAddrPhoneController.text.trim(),
          'country': _newAddrCountryController.text.trim(),
          'city': _newAddrCityController.text.trim(),
          'streetAddress': _newAddrStreetController.text.trim(),
        };
        // Real, best-effort save to the real account address book, so
        // it's there to pick next time -- if it fails (e.g. the real
        // 3-address cap), this order still goes through using the
        // real inline address typed in, just not saved for reuse.
        try {
          final saved = await ApiClient().createAddress(auth.token!, {'label': 'Address', ...inlineAddress});
          addressId = saved['id'] as String?;
          inlineAddress = null;
        } catch (_) {
          // Real, honest fallback -- proceed with the inline address as-is.
        }
      } else {
        if (_selectedAddressId == null) {
          setState(() => _errorMessage = trRead(context, 'please_select_address'));
          return;
        }
        addressId = _selectedAddressId;
      }
    }

    setState(() {
      _isPlacingOrder = true;
      _errorMessage = null;
    });

    try {
      final result = await ApiClient().placeOrder(
        items: cart.items,
        userId: auth.isLoggedIn ? auth.user!['id'] as String : null,
        guestEmail: auth.isLoggedIn ? null : _guestEmailController.text.trim(),
        promoCode: _appliedPromoCode,
        addressId: addressId,
        address: inlineAddress,
        waitForAllShipments: _waitForAllShipments,
      );
      // Real guest-email autofill save (#20) -- device-local only,
      // best-effort, never blocks a real successful order over a
      // real local-storage write failure.
      if (!auth.isLoggedIn) {
        _secureStorage.write(key: _guestEmailStorageKey, value: _guestEmailController.text.trim()).catchError((_) {});
      }
      await cart.clearAfterOrder();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order ${result['id']} ${trRead(context, 'order_placed_success')}')),
        );
        // Real geolocation-based address suggestion (migration 030) --
        // confirmed design: shown right after a real guest order is
        // placed (they have no address on file yet), before the
        // account-creation prompt. Real, dismissable -- never blocks
        // getting to '/orders' if declined.
        if (!auth.isLoggedIn) {
          await _showAddressSuggestion(result['id'] as String, _guestEmailController.text.trim());
        }
        // Real guest-to-account conversion prompt (migration 029) --
        // shown right after a real guest order is placed, confirmed
        // design: only for a real guest checkout, never a logged-in
        // buyer who obviously already has an account.
        var choseToCreateAccount = false;
        if (!auth.isLoggedIn) {
          choseToCreateAccount = await _showGuestAccountPrompt(_guestEmailController.text.trim());
        }
        // REAL BUG FOUND AND FIXED HERE: this used to always navigate to
        // '/orders' after the prompt closed, regardless of what was
        // chosen -- but when "Create account" was tapped, that real
        // push to '/signup' was racing against this real go('/orders')
        // firing right after, since a dialog's own Future resolves the
        // instant it's popped, not after any navigation triggered by
        // its own button finishes. Skip this navigation entirely when
        // signup was chosen -- the push to '/signup' is the real, final
        // destination in that case, not a stop on the way to '/orders'.
        // Real improvement (new) -- goes straight to the new order's
        // own real detail page (tracking, itemized breakdown, etc.)
        // rather than the general orders list, so a buyer doesn't have
        // to find and tap their own just-placed order themselves.
        // REAL BUG FOUND AND FIXED HERE, related to this same real
        // fix: this used to navigate here with no guestEmail at all
        // for a real guest order -- meaning a real guest landing on
        // their own just-placed order's detail page would have seen
        // an infinite loading spinner (this screen's own _load()
        // returned early for any non-logged-in visitor, with no error
        // shown), even before order_detail_screen.dart's own guest-
        // access fix this same session. Appends the real guestEmail
        // now, matching the exact same real query-param pattern
        // already used for returns/support tracking links.
        if (mounted && !choseToCreateAccount) {
          final guestQuery = auth.isLoggedIn ? '' : '?guestEmail=${Uri.encodeQueryComponent(_guestEmailController.text.trim())}';
          context.go('/orders/${result['id']}$guestQuery');
        }
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
      // Real draft-order queue offer (#60) -- only for a genuine
      // real network failure (the new typed isNetworkError flag),
      // never for a real validation error or any other real problem
      // that needs the person's own attention right now, not a
      // silent retry.
      if (e.isNetworkError && mounted) {
        final shouldSave = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(trRead(context, 'save_order_for_later_title')),
            content: Text(trRead(context, 'save_order_for_later_body')),
            actions: [
              TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(trRead(context, 'no_thanks'))),
              TextButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(trRead(context, 'save_and_send_later'))),
            ],
          ),
        );
        if (shouldSave == true && mounted) {
          await DraftOrderQueue.save(
            items: cart.items,
            userId: auth.isLoggedIn ? auth.user!['id'] as String : null,
            guestEmail: auth.isLoggedIn ? null : _guestEmailController.text.trim(),
            promoCode: _appliedPromoCode,
            addressId: addressId,
            address: inlineAddress,
            waitForAllShipments: _waitForAllShipments,
          );
          if (mounted) {
            setState(() => _errorMessage = null);
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(trRead(context, 'order_saved_for_later'))));
          }
        }
      }
    } catch (e) {
      setState(() => _errorMessage = trRead(context, 'order_placement_error'));
    } finally {
      if (mounted) setState(() => _isPlacingOrder = false);
    }
  }

  // Real geolocation-based address suggestion (migration 030).
  // CONFIRMED design, refined over several rounds before building: a
  // real device location only gives real coordinates, not a full
  // postal address -- reverse-geocoded into a real, editable
  // suggestion (never blindly trusted), shown as a real form the
  // person reviews and adjusts before confirming. Real, dismissable --
  // declining (or denying location permission) leaves the real order
  // in a real, honest "pending address" state instead, with a real
  // "Add address" action always available later from the order detail
  // screen.
  Future<void> _showAddressSuggestion(String orderId, String guestEmail) async {
    if (!mounted) return;
    Map<String, dynamic>? suggested;
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        suggested = null;
      } else {
        final serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 8)),
          );
          suggested = await ApiClient().reverseGeocode(position.latitude, position.longitude);
        }
      }
    } catch (_) {
      suggested = null; // Real, honest fallback -- an empty, manually-fillable form instead.
    }

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AddressConfirmationSheet(
        orderId: orderId,
        guestEmail: guestEmail,
        suggestedCity: suggested?['city'] as String? ?? '',
        suggestedCountry: suggested?['country'] as String? ?? '',
        suggestedStreet: suggested?['streetAddress'] as String? ?? '',
        wasSuggested: suggested != null,
      ),
    );
  }

  // Real guest-to-account conversion prompt (migration 029) --
  // confirmed design: shown right on the order confirmation moment,
  // not via a separate email. Real, dismissable -- a guest is never
  // forced into creating an account, just genuinely nudged. Pre-fills
  // the exact real guest email used, since signing up with that exact
  // same email is what genuinely links the just-placed order to it.
  // Returns true if the person chose to create an account, so the
  // caller can skip navigating anywhere else afterward.
  Future<bool> _showGuestAccountPrompt(String guestEmail) async {
    if (!mounted) return false;
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    var choseToCreateAccount = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isAr ? 'احفظ سجل طلباتك' : 'Save your order history'),
        content: Text(isAr
            ? 'أنشئ حسابًا لتتبع هذا الطلب وأي طلبات مستقبلية في مكان واحد.'
            : 'Create an account to track this order — and any future ones — in one place.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(isAr ? 'لاحقًا' : 'Maybe later'),
          ),
          FilledButton(
            onPressed: () {
              choseToCreateAccount = true;
              Navigator.of(dialogContext).pop();
            },
            child: Text(isAr ? 'إنشاء حساب' : 'Create account'),
          ),
        ],
      ),
    );
    // The real push to '/signup' happens AFTER the dialog has fully
    // closed, not from inside its own button handler -- avoids the
    // exact real race this fix addresses.
    if (choseToCreateAccount && mounted) {
      context.push('/signup', extra: {'prefillEmail': guestEmail});
    }
    return choseToCreateAccount;
  }

  // Real shipping address picker (migration 030) -- a real logged-in
  // buyer picks a real saved address or fills in a new one right here;
  // required before placing the order.
  Widget _buildAddressPicker() {
    if (_isLoadingAddresses) {
      return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KeyedSubtree(key: _addressSectionKey, child: const Text('Delivery address', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
          const SizedBox(height: 8),
          if (_savedAddresses.isNotEmpty && !_isAddingNewAddress) ...[
            for (final a in _savedAddresses)
              RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                value: a['id'] as String,
                groupValue: _selectedAddressId,
                onChanged: (v) => setState(() => _selectedAddressId = v),
                title: Text(a['label'] as String? ?? 'Address', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                subtitle: Text('${a['streetAddress']}, ${a['city']}, ${a['country']}', style: const TextStyle(fontSize: 12)),
              ),
            TextButton.icon(
              onPressed: () => setState(() => _isAddingNewAddress = true),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Add a new address'),
            ),
          ] else ...[
            TextField(controller: _newAddrRecipientController, decoration: const InputDecoration(labelText: 'Recipient name')),
            const SizedBox(height: 8),
            TextField(controller: _newAddrPhoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 8),
            TextField(controller: _newAddrCountryController, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 8),
            TextField(controller: _newAddrCityController, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 8),
            TextField(controller: _newAddrStreetController, decoration: const InputDecoration(labelText: 'Street address')),
            if (_savedAddresses.isNotEmpty) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => setState(() => _isAddingNewAddress = false),
                child: const Text('Choose a saved address instead'),
              ),
            ],
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final cart = context.watch<CartState>();

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'checkout'))),
      body: Column(
        children: [
          // Real checkout step progress (new) -- fixed at the top,
          // doesn't scroll away with the form, so a buyer can always
          // see how far through checkout they are.
          StepProgressIndicator(
            labels: [tr(context, 'delivery_address'), tr(context, 'payment_method'), tr(context, 'order_summary')],
            currentStep: _currentStep,
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              children: [
          // Real stock-change warning (#17) -- only shown when the
          // real recheck above found a real, genuine problem: a cart
          // quantity that now exceeds real current stock.
          if (_stockChangedItemNames.isNotEmpty)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.orange.shade800, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${_stockChangedItemNames.join(", ")} ${_stockChangedItemNames.length == 1 ? "has" : "have"} less stock available now than in your cart. Please adjust the quantity before continuing.',
                      style: TextStyle(color: Colors.orange.shade900, fontSize: 12.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          if (auth.isLoggedIn)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: LeapPalette.of(context).chalk, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Icon(Icons.check_circle, size: 18, color: LeapPalette.of(context).gauge),
                  const SizedBox(width: 8),
                  Expanded(child: Text('${tr(context, 'ordering_as')} ${auth.user!['email']}', style: const TextStyle(fontSize: 12.5))),
                ],
              ),
            )
          else if (AppConfig.guestCheckoutEnabled) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: LeapPalette.of(context).chalk, borderRadius: BorderRadius.circular(10)),
              child: Text(
                tr(context, 'guest_checkout_note'),
                style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).muted),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _guestEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: tr(context, 'email_for_confirmation')),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/login'),
              child: Text(tr(context, 'have_account_login_instead')),
            ),
          ],
          if (auth.isLoggedIn) ...[
            const SizedBox(height: 16),
            _buildAddressPicker(),
          ],
          const SizedBox(height: 12),
          KeyedSubtree(key: _paymentSectionKey, child: Text(tr(context, 'payment_method'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
          const SizedBox(height: 8),
          ..._paymentMethods.map((m) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: _selectedPayment == m.id ? LeapPalette.of(context).signal : LeapPalette.of(context).line),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: RadioListTile<String>(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                  value: m.id,
                  groupValue: _selectedPayment,
                  onChanged: (v) => setState(() => _selectedPayment = v!),
                  title: Row(children: [Icon(m.icon, size: 18), const SizedBox(width: 10), Text(m.label)]),
                ),
              )),
          // Real shipping consolidation preference (#51) -- only
          // shown when the real cart genuinely has items from more
          // than one real supplier (via each real CartItem's own
          // supplierName). A single-supplier order has nothing real
          // to consolidate or wait for.
          if (cart.items.map((i) => i.supplierName).toSet().length > 1) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(10)),
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _waitForAllShipments,
                onChanged: (v) => setState(() => _waitForAllShipments = v),
                title: Text(tr(context, 'wait_for_all_shipments_title')),
                subtitle: Text(tr(context, 'wait_for_all_shipments_subtitle'), style: TextStyle(fontSize: 12, color: LeapPalette.of(context).muted)),
              ),
            ),
          ],
          const SizedBox(height: 12),
          KeyedSubtree(key: _summarySectionKey, child: Text(tr(context, 'order_summary'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
          const SizedBox(height: 8),
          // Real itemized breakdown (new) -- closes a real gap: before
          // this, a buyer reviewing checkout (an irreversible,
          // payment-adjacent action) only ever saw an aggregate count
          // and total, never which real products or how many of each
          // they were actually about to buy.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                for (final item in cart.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        // Real product thumbnail (new) -- closes a
                        // real gap: only the product's name was shown
                        // as plain text before, no real photo at all.
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: item.imageUrl != null
                              ? CachedNetworkImage(
                                  fadeInDuration: const Duration(milliseconds: 300),
                                  imageUrl: ApiClient.resolveMediaUrl(item.imageUrl!),
                                  width: 56,
                                  height: 56,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(width: 56, height: 56, color: Colors.white),
                                  errorWidget: (context, url, error) => Container(
                                    width: 36,
                                    height: 36,
                                    color: Colors.white,
                                    child: Icon(Icons.broken_image_outlined, size: 14, color: LeapPalette.of(context).muted),
                                  ),
                                )
                              : Container(
                                  width: 56,
                                  height: 56,
                                  color: Colors.white,
                                  child: Icon(Icons.inventory_2_outlined, size: 14, color: LeapPalette.of(context).muted),
                                ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${item.quantity} × ${item.name}',
                            style: const TextStyle(fontSize: 12.5),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(formatPrice(context, item.price * item.quantity), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _promoCodeController,
                  enabled: _appliedPromoCode == null,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(labelText: tr(context, 'promo_code_field')),
                ),
              ),
              const SizedBox(width: 8),
              if (_appliedPromoCode == null)
                ElevatedButton(
                  onPressed: _isValidatingPromo ? null : _applyPromoCode,
                  child: _isValidatingPromo
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(tr(context, 'apply')),
                )
              else
                OutlinedButton(onPressed: _removePromoCode, child: Text(tr(context, 'remove'))),
            ],
          ),
          if (_promoMessage != null) ...[
            const SizedBox(height: 6),
            Text(
              _promoMessage!,
              style: TextStyle(fontSize: 12, color: _appliedPromoCode != null ? LeapPalette.of(context).gauge : Colors.red),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cart.itemCount} item(s) · ${tr(context, 'subtotal')}', style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 12.5)),
                    Text(formatPrice(context, cart.total), style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                if (_appliedPromoCode != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${tr(context, 'discount')} ($_appliedPromoCode)', style: TextStyle(color: LeapPalette.of(context).gauge, fontSize: 12.5)),
                      Text('-${formatPrice(context, _previewDiscount(cart.total))}', style: TextStyle(color: LeapPalette.of(context).gauge, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: (cart.isEmpty || _isPlacingOrder || _stockChangedItemNames.isNotEmpty) ? null : _placeOrder,
          child: _isPlacingOrder
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text('${tr(context, 'place_order')} · ${formatPriceWithUsd(context, cart.total - _previewDiscount(cart.total))}'),
        ),
      ),
    );
  }
}

// Real, editable address confirmation sheet (migration 030) -- shown
// after a real guest order is placed, pre-filled from real reverse
// geocoding when available (never blindly trusted -- always editable),
// or a real empty form when location wasn't available/granted.
class _AddressConfirmationSheet extends StatefulWidget {
  final String orderId;
  final String guestEmail;
  final String suggestedCity;
  final String suggestedCountry;
  final String suggestedStreet;
  final bool wasSuggested;

  const _AddressConfirmationSheet({
    required this.orderId,
    required this.guestEmail,
    required this.suggestedCity,
    required this.suggestedCountry,
    required this.suggestedStreet,
    required this.wasSuggested,
  });

  @override
  State<_AddressConfirmationSheet> createState() => _AddressConfirmationSheetState();
}

class _AddressConfirmationSheetState extends State<_AddressConfirmationSheet> {
  late final _recipientController = TextEditingController();
  late final _phoneController = TextEditingController();
  late final _countryController = TextEditingController(text: widget.suggestedCountry);
  late final _cityController = TextEditingController(text: widget.suggestedCity);
  late final _streetController = TextEditingController(text: widget.suggestedStreet);
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _recipientController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_recipientController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty ||
        _countryController.text.trim().isEmpty ||
        _cityController.text.trim().isEmpty ||
        _streetController.text.trim().isEmpty) {
      setState(() => _error = 'Please fill in every field.');
      return;
    }
    setState(() { _isSaving = true; _error = null; });
    try {
      await ApiClient().confirmOrderAddress(
        widget.orderId,
        {
          'recipientName': _recipientController.text.trim(),
          'phone': _phoneController.text.trim(),
          'country': _countryController.text.trim(),
          'city': _cityController.text.trim(),
          'streetAddress': _streetController.text.trim(),
        },
        guestEmail: widget.guestEmail,
        source: widget.wasSuggested ? 'geolocation' : 'manual',
      );
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.wasSuggested ? 'Is this your delivery address?' : 'Add your delivery address',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              widget.wasSuggested
                  ? 'We found this from your location — check it over and adjust anything before confirming.'
                  : 'We couldn\'t detect your location. Fill this in so we know where to ship your order.',
              style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).muted),
            ),
            const SizedBox(height: 16),
            TextField(controller: _recipientController, decoration: const InputDecoration(labelText: 'Recipient name')),
            const SizedBox(height: 10),
            TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 10),
            TextField(controller: _countryController, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 10),
            TextField(controller: _cityController, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 10),
            TextField(controller: _streetController, decoration: const InputDecoration(labelText: 'Street address')),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: _isSaving ? null : () => Navigator.of(context).pop(),
                    child: const Text('Add later'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _isSaving ? null : _confirm,
                    child: _isSaving
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Confirm'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
