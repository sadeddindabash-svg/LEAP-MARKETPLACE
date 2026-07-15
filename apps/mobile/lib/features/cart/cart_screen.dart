import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/cart_state.dart';
import '../../models/cart_item.dart';

/// BUY-030–031: cart holds items from multiple suppliers but presents one
/// unified basket and total; splitting into supplier sub-orders happens at
/// checkout time (server-side), invisibly to the buyer. Every quantity
/// change and removal here is a real call to services/api/cart — there is
/// no local-only cart state to reconcile later.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'basket'))),
      body: _buildBody(context, cart),
      bottomNavigationBar: (cart.isLoading || cart.isEmpty)
          ? null
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(tr(context, 'total'), style: const TextStyle(color: LeapColors.muted)),
                      Text('\$${cart.total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: () => context.push('/checkout'),
                    child: Text(tr(context, 'checkout')),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildBody(BuildContext context, CartState cart) {
    if (cart.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (cart.errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(cart.errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: cart.refresh, child: Text(tr(context, 'retry'))),
            ],
          ),
        ),
      );
    }
    if (cart.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.shopping_cart_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              Text(tr(context, 'basket_empty'),
                  textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
            ],
          ),
        ),
      );
    }

    final grouped = cart.itemsBySupplier;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: grouped.entries.map((entry) => _SupplierGroup(supplierName: entry.key, items: entry.value)).toList(),
    );
  }
}

class _SupplierGroup extends StatelessWidget {
  final String supplierName;
  final List<CartItem> items;
  const _SupplierGroup({required this.supplierName, required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: LeapColors.chalk,
            child: Text('${tr(context, 'ships_from')} $supplierName',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: LeapColors.muted, letterSpacing: 0.3)),
          ),
          for (final item in items) _CartItemRow(item: item),
        ],
      ),
    );
  }
}

class _CartItemRow extends StatelessWidget {
  final CartItem item;
  const _CartItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartState>();
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: LeapColors.chalk, borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.album_outlined, color: LeapColors.ink),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(border: Border.all(color: LeapColors.line), borderRadius: BorderRadius.circular(7)),
                      child: Row(
                        children: [
                          IconButton(
                            iconSize: 14,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            onPressed: () => cart.setQuantity(item.productId, item.quantity - 1),
                            icon: const Icon(Icons.remove),
                          ),
                          SizedBox(width: 18, child: Text('${item.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                          IconButton(
                            iconSize: 14,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            onPressed: () => cart.setQuantity(item.productId, item.quantity + 1),
                            icon: const Icon(Icons.add),
                          ),
                        ],
                      ),
                    ),
                    Text('\$${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => cart.removeItem(item.productId),
            icon: const Icon(Icons.close, size: 16, color: LeapColors.muted),
          ),
        ],
      ),
    );
  }
}
