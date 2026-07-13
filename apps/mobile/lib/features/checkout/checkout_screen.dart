import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/config/app_config.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';

/// BUY-034: guided checkout flow. Guest checkout is enabled by default per
/// the product decision in the Charter — buyers are prompted to create an
/// account on the confirmation screen instead of being blocked here.
/// BUY-040: payment methods are rendered from a provider-agnostic list so
/// adding a region-specific method (e.g. Mada) is config, not a rewrite.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _guestEmailController = TextEditingController();
  String _selectedPayment = 'card';

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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
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
                  Expanded(child: Text('Ordering as ${auth.user!['email']}', style: const TextStyle(fontSize: 12.5))),
                ],
              ),
            )
          else if (AppConfig.guestCheckoutEnabled) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(10)),
              child: const Text(
                "Checking out as a guest — we'll email your confirmation. You can create an account after payment to track this order.",
                style: TextStyle(fontSize: 12.5, color: LeapColors.muted),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _guestEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email for order confirmation'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/login'),
              child: const Text('Have an account? Log in instead'),
            ),
          ],
          const SizedBox(height: 12),
          const Text('Payment method', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          ..._paymentMethods.map((m) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                value: m.id,
                groupValue: _selectedPayment,
                onChanged: (v) => setState(() => _selectedPayment = v!),
                title: Row(children: [Icon(m.icon, size: 18), const SizedBox(width: 10), Text(m.label)]),
              )),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: () {
            // TODO: submit the real cart via POST /order:
            // - if auth.isLoggedIn, send { userId: auth.user!['id'], items }
            // - else send { guestEmail: _guestEmailController.text, items }
            // Cart state isn't yet wired through a shared Provider in this
            // scaffold (see cart_screen.dart) — connect that before this
            // button does anything real.
            context.go('/orders');
          },
          child: const Text('Place order'),
        ),
      ),
    );
  }
}
