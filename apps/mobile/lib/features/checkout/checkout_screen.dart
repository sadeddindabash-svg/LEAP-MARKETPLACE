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
  String _selectedPayment = 'card';
  bool _isPlacingOrder = false;
  String? _errorMessage;

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
    super.dispose();
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
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${cart.itemCount} item(s)', style: const TextStyle(color: LeapColors.muted, fontSize: 12.5)),
                    Text('\$${cart.total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
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
              : Text('${tr(context, 'place_order')} · \$${cart.total.toStringAsFixed(2)}'),
        ),
      ),
    );
  }
}
