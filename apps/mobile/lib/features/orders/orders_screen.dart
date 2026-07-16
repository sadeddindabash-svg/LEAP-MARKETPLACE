import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';

/// BUY-050–052: order history. Requires login (GET /order is auth-scoped
/// server-side — see services/api/src/modules/order/routes.js) since guest
/// checkout orders aren't otherwise listable without the buyer creating an
/// account. BUY-053: returns/warranty requests route to the Platform, never
/// directly to the supplier.
///
/// Real status filter tabs — confirmed scope, discussed before building:
/// only 3 of 5 originally-requested tabs (To ship / Shipped / Returns)
/// have a real system behind them today. "To pay" has no meaning yet (no
/// real payment capture exists — every order is already placed the
/// moment it's created) and "To review" has no meaning yet (no review
/// system exists) — both real, honest gaps, not silently faked here with
/// empty tabs that look broken. See services/api/README.md's order
/// module section for the full real bug this filtering is built on:
/// orders.status is frozen at 'to_ship' forever and never reflects real
/// progress — the backend now computes a real `displayStatus` from
/// actual sub-order/return-case state instead, which is what these tabs
/// filter and display.
const List<({String key, String labelKey})> kOrderTabs = [
  (key: 'all', labelKey: 'tab_all'),
  (key: 'to_ship', labelKey: 'status_to_ship'),
  (key: 'shipped', labelKey: 'status_shipped'),
  (key: 'returns', labelKey: 'status_returns'),
];

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String _selectedTab = 'all';
  Future<List<dynamic>>? _ordersFuture;
  String? _loadedForKey;

  void _ensureLoaded(bool isLoggedIn, String? token) {
    final key = '$_selectedTab|$isLoggedIn';
    if (_loadedForKey == key) return;
    _loadedForKey = key;
    if (!isLoggedIn) {
      _ordersFuture = Future.value(const []);
      return;
    }
    _ordersFuture = ApiClient().fetchMyOrders(token!, status: _selectedTab == 'all' ? null : _selectedTab);
  }

  void _selectTab(String tabKey) {
    if (_selectedTab == tabKey) return;
    setState(() => _selectedTab = tabKey);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    _ensureLoaded(auth.isLoggedIn, auth.token);

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'my_orders'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 40, color: LeapColors.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'login_to_see_orders'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: LeapColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => context.push('/login'), child: Text(tr(context, 'log_in'))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'my_orders'))),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: kOrderTabs.map((t) {
                final selected = _selectedTab == t.key;
                final label = tr(context, t.labelKey);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: () => _selectTab(t.key),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? LeapColors.signal : LeapColors.chalk,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: selected ? LeapColors.signal : LeapColors.line),
                      ),
                      child: Text(
                        label,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? Colors.white : LeapColors.ink),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: _ordersFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('${tr(context, 'could_not_load_orders')} ${snapshot.error}', style: const TextStyle(color: LeapColors.muted)));
                }
                final orders = snapshot.data ?? [];
                if (orders.isEmpty) {
                  return Center(child: Text(tr(context, 'no_orders_yet'), style: const TextStyle(color: LeapColors.muted)));
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: orders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final o = orders[i] as Map<String, dynamic>;
                    // displayStatus is the REAL, computed status (see the
                    // backend order module) -- the raw `status` field is
                    // frozen at 'to_ship' forever and never reflects
                    // actual real progress, so it is deliberately NOT
                    // used for display here.
                    final displayStatus = (o['displayStatus'] as String?) ?? (o['status'] as String);
                    return Card(
                      child: InkWell(
                        onTap: () => context.push('/orders/${o['id']}'),
                        child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                PlateChip(text: o['id'] as String, small: true),
                                Text(trStatus(context, displayStatus).toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: LeapColors.torque)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('\$${(o['total'] as num).toStringAsFixed(2)} ${o['currencyCode']}'),
                          ],
                        ),
                      ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
