import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';

/// BUY-050–052: order history. Requires login (GET /order is auth-scoped
/// server-side — see services/api/src/modules/order/routes.js) since guest
/// checkout orders aren't otherwise listable without the buyer creating an
/// account. BUY-053: returns/warranty requests route to the Platform, never
/// directly to the supplier.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<dynamic>> _ordersFuture;

  @override
  void initState() {
    super.initState();
    _ordersFuture = _load();
  }

  Future<List<dynamic>> _load() async {
    final auth = context.read<AuthState>();
    if (!auth.isLoggedIn) return [];
    return ApiClient().fetchMyOrders(auth.token!);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('My orders')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              const Text(
                'Log in to see your order history.\n(Guest checkout orders are confirmed by email, but aren\'t listed here unless you have an account.)',
                textAlign: TextAlign.center,
                style: TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: const Text('Log in')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: FutureBuilder<List<dynamic>>(
        future: _ordersFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Could not load orders: ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
          }
          final orders = snapshot.data ?? [];
          if (orders.isEmpty) {
            return const Center(child: Text('No orders yet.', style: TextStyle(color: LeapColors.muted)));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: orders.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final o = orders[i] as Map<String, dynamic>;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          PlateChip(text: o['id'] as String, small: true),
                          Text((o['status'] as String).toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: LeapColors.torque)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text('\$${(o['total'] as num).toStringAsFixed(2)} ${o['currencyCode']}'),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
