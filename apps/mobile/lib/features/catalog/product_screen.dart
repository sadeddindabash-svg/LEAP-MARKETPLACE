import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// BUY-022: product detail with fitment confirmation, stock, and delivery
/// estimate. BUY-030: adds to a cart that is later split by supplier at
/// checkout (see checkout_screen.dart).
class ProductScreen extends StatelessWidget {
  final String productId;
  const ProductScreen({super.key, required this.productId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Item details')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            height: 180,
            decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(12)),
            child: const Center(child: Icon(Icons.album_outlined, size: 64, color: LeapColors.ink)),
          ),
          const SizedBox(height: 16),
          const Text('RIDEX Front Brake Disc, Vented 300mm',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          const SizedBox(height: 6),
          const Text('Sold by Guangzhou AutoParts Co.', style: TextStyle(color: LeapColors.muted, fontSize: 12)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFE4F5EC), borderRadius: BorderRadius.circular(10)),
            child: const Row(
              children: [
                Icon(Icons.check_circle, color: LeapColors.gauge, size: 18),
                SizedBox(width: 8),
                Expanded(child: Text('Confirmed fit for your BMW 1 Hatchback (F20)', style: TextStyle(color: LeapColors.gauge))),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text('\$34.90', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: ElevatedButton(
          onPressed: () {
            // TODO: add to cart via app state, then show confirmation snackbar
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Added to cart')),
            );
          },
          child: const Text('Add to cart'),
        ),
      ),
    );
  }
}
