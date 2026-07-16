import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/config/app_config.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/cart_state.dart';
import '../../services/api_client.dart';

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
  String? _errorMessage;

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
  void dispose() {
    _guestEmailController.dispose();
    _promoCodeController.dispose();
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
        setState(() {
          _appliedPromoCode = code;
          _appliedPromoDetails = result['promoCode'] as Map<String, dynamic>;
          _promoMessage = trRead(context, 'promo_applied');
        });
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
      );
      await cart.clearAfterOrder();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order ${result['id']} ${trRead(context, 'order_placed_success')}')),
        );
        context.go('/orders');
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = trRead(context, 'order_placement_error'));
    } finally {
      if (mounted) setState(() => _isPlacingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final cart = context.watch<CartState>();

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'checkout'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (auth.isLoggedIn)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, size: 18, color: LeapColors.gauge),
                  const SizedBox(width: 8),
                  Expanded(child: Text('${tr(context, 'ordering_as')} ${auth.user!['email']}', style: const TextStyle(fontSize: 12.5))),
                ],
              ),
            )
          else if (AppConfig.guestCheckoutEnabled) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(10)),
              child: Text(
                tr(context, 'guest_checkout_note'),
                style: const TextStyle(fontSize: 12.5, color: LeapColors.muted),
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
          const SizedBox(height: 12),
          Text(tr(context, 'payment_method'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          ..._paymentMethods.map((m) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                value: m.id,
                groupValue: _selectedPayment,
                onChanged: (v) => setState(() => _selectedPayment = v!),
                title: Row(children: [Icon(m.icon, size: 18), const SizedBox(width: 10), Text(m.label)]),
              )),
          const SizedBox(height: 12),
          Text(tr(context, 'order_summary'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
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
              style: TextStyle(fontSize: 12, color: _appliedPromoCode != null ? LeapColors.gauge : Colors.red),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cart.itemCount} item(s) · ${tr(context, 'subtotal')}', style: const TextStyle(color: LeapColors.muted, fontSize: 12.5)),
                    Text('\$${cart.total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                if (_appliedPromoCode != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${tr(context, 'discount')} ($_appliedPromoCode)', style: const TextStyle(color: LeapColors.gauge, fontSize: 12.5)),
                      Text('-\$${_previewDiscount(cart.total).toStringAsFixed(2)}', style: const TextStyle(color: LeapColors.gauge, fontWeight: FontWeight.w700)),
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
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: (cart.isEmpty || _isPlacingOrder) ? null : _placeOrder,
          child: _isPlacingOrder
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text('${tr(context, 'place_order')} · \$${(cart.total - _previewDiscount(cart.total)).toStringAsFixed(2)}'),
        ),
      ),
    );
  }
}
