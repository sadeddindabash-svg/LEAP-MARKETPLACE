import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// BUY-013: shows only (or clearly flags) parts confirmed to fit the active
/// vehicle. This screen currently renders placeholder rows — wire it to
/// ApiClient.fetchProductsByCategory once services/api/catalog exists.
class CategoryScreen extends StatelessWidget {
  final String categoryId;
  final String categoryName;
  const CategoryScreen({super.key, required this.categoryId, required this.categoryName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(categoryName)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 40, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'Products for "$categoryId" will render here once '
                'connected to services/api/catalog.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/product/sample'),
                child: const Text('Preview a product screen'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
