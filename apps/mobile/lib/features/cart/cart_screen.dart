import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

/// BUY-030–031: cart holds items from multiple suppliers but presents one
/// unified basket and total; splitting into supplier sub-orders happens at
/// checkout time, invisibly to the buyer.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Basket')),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_cart_outlined, size: 40, color: LeapColors.muted),
              SizedBox(height: 12),
              Text(
                'Cart items grouped by supplier will render here once '
                'wired to app state (Provider) and services/api/cart.',
                textAlign: TextAlign.center,
                style: TextStyle(color: LeapColors.muted),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: () => context.push('/checkout'),
          child: const Text('Checkout'),
        ),
      ),
    );
  }
}
