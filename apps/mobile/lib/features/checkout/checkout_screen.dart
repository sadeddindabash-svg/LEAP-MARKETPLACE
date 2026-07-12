import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/config/app_config.dart';

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
  bool _isGuest = AppConfig.guestCheckoutEnabled;
  String _selectedPayment = 'card';

  static const _paymentMethods = [
    (id: 'card', label: 'Visa / Mastercard', icon: Icons.credit_card),
    (id: 'paypal', label: 'PayPal', icon: Icons.account_balance_wallet_outlined),
    (id: 'gpay', label: 'Google Pay', icon: Icons.account_balance_wallet_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (AppConfig.guestCheckoutEnabled)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Check out as guest'),
              subtitle: const Text("You'll be offered an account after payment"),
              value: _isGuest,
              onChanged: (v) => setState(() => _isGuest = v),
            ),
          const SizedBox(height: 8),
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
            // TODO: submit order via services/api/order, then:
            // - if _isGuest, show account-creation nudge on confirmation
            // - else attach to the signed-in user
            context.go('/orders');
          },
          child: const Text('Place order'),
        ),
      ),
    );
  }
}
