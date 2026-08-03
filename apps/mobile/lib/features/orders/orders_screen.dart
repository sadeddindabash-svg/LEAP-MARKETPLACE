import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';
import '../../widgets/skeleton.dart';

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
  (key: 'delivered', labelKey: 'status_delivered'),
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

  /// Real pull-to-refresh (new) -- bypasses _ensureLoaded's own cache
  /// key (which deliberately avoids refetching on every rebuild), since
  /// a real pull-to-refresh gesture is an explicit request for fresh
  /// data regardless of whether the tab/login state actually changed.
  Future<void> _handleRefresh() async {
    final auth = context.read<AuthState>();
    setState(() {
      _loadedForKey = null;
    });
    _ensureLoaded(auth.isLoggedIn, auth.token);
    await _ordersFuture;
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
              Icon(Icons.inventory_2_outlined, size: 40, color: LeapPalette.of(context).muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'login_to_see_orders'),
                textAlign: TextAlign.center,
                style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 13),
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
                final palette = LeapPalette.of(context);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: () => _selectTab(t.key),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? palette.signal : palette.chalk,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: selected ? palette.signal : palette.line),
                      ),
                      child: Text(
                        label,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? palette.onSignal : palette.ink),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Divider(height: 1, color: LeapPalette.of(context).line),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _handleRefresh,
              child: FutureBuilder<List<dynamic>>(
                future: _ordersFuture,
                builder: (context, snapshot) {
                  final palette = LeapPalette.of(context);
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const ListSkeleton();
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 80),
                          child: Center(child: Text('${tr(context, 'could_not_load_orders')} ${snapshot.error}', style: TextStyle(color: palette.muted))),
                        ),
                      ],
                    );
                  }
                  final orders = snapshot.data ?? [];
                  if (orders.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 80),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(tr(context, 'no_orders_yet'), style: TextStyle(color: palette.muted)),
                                const SizedBox(height: 16),
                                ElevatedButton(
                                  onPressed: () => context.go('/home'),
                                  child: Text(tr(context, 'browse_products')),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }
                  // Real, honestly-computed stat (new) -- matches the
                  // real Stitch reference's own "stats bento" concept,
                  // but only for the one stat genuinely computable from
                  // real, already-loaded order data. The reference's
                  // other two stats ("Pending Reviews", "Lifetime
                  // Parts") are deliberately NOT shown here -- neither
                  // a review-eligibility count nor a lifetime item
                  // count is available from this real data without
                  // fabricating a number.
                  final activeShipments = orders.where((o) {
                    final status = ((o as Map<String, dynamic>)['displayStatus'] as String?) ?? (o['status'] as String);
                    return status == 'shipped' || status == 'to_ship' || status == 'processing';
                  }).length;
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    itemCount: orders.length + (_selectedTab == 'all' ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      if (_selectedTab == 'all' && i == 0) {
                        return Container(
                          padding: const EdgeInsets.all(16),
                          margin: const EdgeInsets.only(bottom: 4),
                          decoration: BoxDecoration(color: palette.card, border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(12)),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(tr(context, 'active_shipments').toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 0.5)),
                                  const SizedBox(height: 4),
                                  Text('$activeShipments', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: palette.ink)),
                                ],
                              ),
                              Icon(Icons.local_shipping_outlined, color: palette.signal, size: 28),
                            ],
                          ),
                        );
                      }
                      final o = orders[i - (_selectedTab == 'all' ? 1 : 0)] as Map<String, dynamic>;
                      // displayStatus is the REAL, computed status (see the
                      // backend order module) -- the raw `status` field is
                      // frozen at 'to_ship' forever and never reflects
                      // actual real progress, so it is deliberately NOT
                      // used for display here.
                      final displayStatus = (o['displayStatus'] as String?) ?? (o['status'] as String);
                      // Real supplier names (new) -- closes a real gap:
                      // no supplier info was shown at all on this list
                      // before, only after opening an order's own
                      // detail page. Joined with commas since a single
                      // real order can be fulfilled by more than one
                      // real supplier.
                      final supplierNames = (o['supplierNames'] as List?)?.cast<String>() ?? [];
                      // Real color-coded status badge (new), matching
                      // the real Stitch reference's own color language
                      // (delivered = green, everything else = the
                      // brand accent) -- reuses the exact same real
                      // displayStatus values already computed above,
                      // not a new or guessed status set.
                      final badgeColor = displayStatus == 'delivered' ? palette.gauge : palette.signal;
                      return Card(
                        child: InkWell(
                          onTap: () => context.push('/orders/${o['id']}'),
                          child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  PlateChip(text: o['id'] as String, small: true),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(color: badgeColor.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
                                    child: Text(trStatus(context, displayStatus).toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeColor)),
                                  ),
                                ],
                              ),
                              if (supplierNames.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  supplierNames.join(', '),
                                  style: TextStyle(fontSize: 11.5, color: palette.muted),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              const SizedBox(height: 10),
                              Text('\$${(o['total'] as num).toStringAsFixed(2)} ${o['currencyCode']}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: palette.signal)),
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
          ),
        ],
      ),
    );
  }
}
