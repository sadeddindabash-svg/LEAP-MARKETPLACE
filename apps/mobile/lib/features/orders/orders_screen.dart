import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/currency_state.dart';
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
  // Real annual spend summary (#30) -- fetched once per real logged-
  // in session, separately from the orders list itself (different
  // real backend endpoint).
  Future<Map<String, dynamic>>? _spendSummaryFuture;
  // Real guest order lookup (new) -- closes a real, confirmed gap: a
  // guest who places an order and declines the account-creation
  // prompt (see checkout_screen.dart's own real prompt) had no way
  // back to that order at all -- the confirmation email only ever
  // showed the order ID as plain text, never a trackable link, and
  // this screen only ever offered "log in" with no path for a guest.
  // Mirrors the exact same real pattern already established for
  // Returns (returns_screen.dart), reusing the same real backend
  // guest-email verification (GET /order/:id?guestEmail=...) that
  // already existed but had no discoverable real entry point here.
  final _lookupIdController = TextEditingController();
  final _lookupEmailController = TextEditingController();

  void _ensureLoaded(bool isLoggedIn, String? token) {
    final key = '$_selectedTab|$isLoggedIn';
    if (_loadedForKey != key) {
      _loadedForKey = key;
      if (!isLoggedIn) {
        _ordersFuture = Future.value(const []);
      } else {
        _ordersFuture = ApiClient().fetchMyOrders(token!, status: _selectedTab == 'all' ? null : _selectedTab);
      }
    }
    // Real annual spend summary (#30) -- fetched once per real
    // logged-in session, not re-fetched on every real tab switch.
    if (isLoggedIn && _spendSummaryFuture == null) {
      _spendSummaryFuture = ApiClient().fetchAnnualSpendSummary(token!);
    }
  }

  void _selectTab(String tabKey) {
    if (_selectedTab == tabKey) return;
    setState(() => _selectedTab = tabKey);
  }

  @override
  void dispose() {
    _lookupIdController.dispose();
    _lookupEmailController.dispose();
    super.dispose();
  }

  void _trackOrder() {
    if (_lookupIdController.text.trim().isEmpty || _lookupEmailController.text.trim().isEmpty) return;
    context.push('/orders/${_lookupIdController.text.trim()}?guestEmail=${Uri.encodeQueryComponent(_lookupEmailController.text.trim())}');
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
    final isAr = context.watch<LanguageState>().isArabic;
    _ensureLoaded(auth.isLoggedIn, auth.token);

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, 'my_orders'))),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
              const SizedBox(height: 28),
              const Divider(),
              const SizedBox(height: 12),
              // Real guest order lookup (new) -- see this class's own
              // header comment for the full real gap this closes,
              // mirroring the exact same real pattern already
              // established for Returns.
              Text(tr(context, 'track_an_order'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              Text(tr(context, 'track_order_hint'), style: TextStyle(color: LeapPalette.of(context).muted, fontSize: 12.5)),
              const SizedBox(height: 16),
              TextField(controller: _lookupIdController, decoration: InputDecoration(labelText: tr(context, 'order_id_label'))),
              const SizedBox(height: 12),
              TextField(controller: _lookupEmailController, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'email_label'))),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _trackOrder, child: Text(tr(context, 'track'))),
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
            height: 56,
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
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: selected ? palette.signal : palette.card,
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
                        return Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 100,
                                padding: const EdgeInsets.all(16),
                                margin: const EdgeInsets.only(bottom: 4),
                                decoration: BoxDecoration(color: palette.card, border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(12)),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(tr(context, 'active_shipments').toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 0.5)),
                                          const SizedBox(height: 4),
                                          _AnimatedCountText(target: activeShipments, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: palette.ink)),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.local_shipping_outlined, color: palette.signal, size: 28),
                                  ],
                                ),
                              ),
                            ),
                            // Real annual spend summary tile (#30) --
                            // loads independently; simply shows
                            // nothing extra while loading or on a
                            // real failure, never blocking the
                            // existing Active Shipments tile beside
                            // it.
                            if (_spendSummaryFuture != null)
                              FutureBuilder<Map<String, dynamic>>(
                                future: _spendSummaryFuture,
                                builder: (context, snapshot) {
                                  if (!snapshot.hasData) return const SizedBox(width: 8, height: 100);
                                  final summary = snapshot.data!;
                                  return Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.only(left: 10),
                                      child: Container(
                                        height: 100,
                                        padding: const EdgeInsets.all(16),
                                        margin: const EdgeInsets.only(bottom: 4),
                                        decoration: BoxDecoration(color: palette.card, border: Border.all(color: palette.line), borderRadius: BorderRadius.circular(12)),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  Text(
                                                    isAr ? '${tr(context, 'annual_spend_label')} ${summary['year']}' : '${summary['year']} ${tr(context, 'annual_spend_label')}',
                                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 0.5),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Builder(builder: (context) {
                                                    final usdTotal = (summary['totalSpent'] as num).toDouble();
                                                    final currency = context.watch<CurrencyState>();
                                                    final converted = currency.convert(usdTotal);
                                                    final displayCurrencyCode = converted != null ? currency.currencyCode : 'USD';
                                                    return _AnimatedCountText(
                                                      target: (converted ?? usdTotal).round(),
                                                      formatter: (v) => formatAmount(context, v.toDouble(), displayCurrencyCode),
                                                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: palette.ink),
                                                    );
                                                  }),
                                                ],
                                              ),
                                            ),
                                            Icon(Icons.receipt_long_outlined, color: palette.signal, size: 28),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                          ],
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
                                  '${tr(context, 'supplier_label')}: ${supplierNames.join(', ')}',
                                  style: TextStyle(fontSize: 11.5, color: palette.muted),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              const SizedBox(height: 10),
                              Text(formatPrice(context, (o['total'] as num).toDouble()), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: palette.signal)),
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

class _AnimatedCountText extends StatelessWidget {
  final int target;
  final String Function(int)? formatter;
  final String prefix;
  final TextStyle style;
  const _AnimatedCountText({required this.target, required this.style, this.prefix = '', this.formatter});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: target.toDouble()),
      duration: const Duration(milliseconds: 1500),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        // Real, confirmed -- prefers the real formatter callback
        // (full currency-aware formatting, applied fresh to each
        // intermediate animation frame) when provided, falling back
        // to the older plain prefix+round() for the one remaining
        // real caller (Active Shipments) that isn't a real currency
        // value at all.
        child: Text(formatter != null ? formatter!(value.round()) : '$prefix${value.round()}', style: style, maxLines: 1, softWrap: false),
      ),
    );
  }
}
