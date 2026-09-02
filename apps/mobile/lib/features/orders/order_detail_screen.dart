import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/config/app_config.dart';
import '../../core/review_prompt_state.dart';
import '../../services/api_client.dart';
import '../../widgets/plate_chip.dart';
import '../../widgets/order_status_timeline.dart';
import '../../core/cart_state.dart';

/// BUY-052/053: order detail, showing the real per-supplier split (the
/// buyer placed one order, but it's fulfilled by potentially multiple
/// suppliers — same structure the admin dashboard and supplier portal
/// already show). Each supplier's line lets the buyer request a return
/// for that specific portion via POST /returns — routed through the
/// Platform, never contacting the supplier directly (see the backend
/// module's header comment for why that's structural, not just UI).
class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  // Real guest access (new) -- see fetchOrderDetail's own header
  // comment and this screen's own _load() for the full real fix.
  final String? guestEmail;
  const OrderDetailScreen({super.key, required this.orderId, this.guestEmail});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? _order;
  String? _errorMessage;
  bool _isLoading = true;
  bool _isReordering = false;
  // Real periodic refresh (new) -- a real, lighter-weight improvement
  // over a bare one-time load, without needing a new real websocket
  // server. Polls only while this real screen is genuinely open AND
  // the real order still has active progress left -- stops itself
  // once delivered/cancelled/returns (nothing left to meaningfully
  // change), and pauses while the real app is backgrounded (see
  // didChangeAppLifecycleState below) to avoid real, wasted network
  // calls for a screen the person isn't even looking at right now.
  Timer? _pollTimer;
  static const _pollInterval = Duration(seconds: 20);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _maybeStartPolling();
    } else {
      _pollTimer?.cancel();
    }
  }

  /// Real, deliberate stop condition (new) -- a delivered, cancelled,
  /// or returns-in-progress order has no real, meaningfully-changing
  /// state left for a real periodic refresh to actually catch, so
  /// polling stops itself rather than running forever for no reason.
  void _maybeStartPolling() {
    _pollTimer?.cancel();
    final status = (_order?['displayStatus'] as String?) ?? (_order?['status'] as String?);
    if (status == 'delivered' || status == 'cancelled' || status == 'returns') return;
    _pollTimer = Timer.periodic(_pollInterval, (_) => _load(silent: true));
  }

  Future<void> _load({bool silent = false}) async {
    final auth = context.read<AuthState>();
    // Real fix: previously returned early here unconditionally for
    // any non-logged-in visitor -- but a real guest with a real,
    // matching guestEmail should be able to load their own real
    // order too (the backend's own real optionalAuth + guestEmail
    // check already allows this, see fetchOrderDetail's own header
    // comment). Only bail out entirely when there's neither a real
    // logged-in session NOR a real guestEmail to try.
    if (!auth.isLoggedIn && widget.guestEmail == null) {
      setState(() {
        _isLoading = false;
        _errorMessage = trRead(context, 'not_found');
      });
      return;
    }
    // Real, deliberate UX choice: a silent poll never shows the full-
    // screen loading spinner -- that would be jarring for a real
    // background refresh the person didn't ask for, unlike the real
    // first load or an explicit pull-to-refresh.
    if (!silent) setState(() => _isLoading = true);
    try {
      final order = await ApiClient().fetchOrderDetail(auth.token, widget.orderId, guestEmail: widget.guestEmail);
      setState(() {
        _order = order;
        _isLoading = false;
      });
      // Real periodic refresh (new) -- (re)evaluate after every real
      // load, using the just-fetched real status, so polling
      // genuinely stops itself the moment an order reaches a real
      // final state, not just once at screen-open time.
      _maybeStartPolling();
      // Real app-store review prompt (new) -- only after a genuinely
      // positive real moment: this real order has actually reached
      // delivered status. Depends directly on this same session's
      // own earlier real fix that made displayStatus able to reach
      // 'delivered' at all -- see ReviewPromptState's own header
      // comment for the honest scope (this decides when it's
      // reasonable to ask; the OS itself decides whether a real
      // prompt actually appears).
      if ((order['displayStatus'] as String?) == 'delivered') {
        ReviewPromptState.maybePromptAfterDelivery(widget.orderId);
      }
    } catch (e) {
      // Real, deliberate choice: a silent poll that fails (e.g. a
      // real, momentary network blip) must never clobber the real,
      // already-loaded order data on screen with an error -- only a
      // real first load or explicit refresh should ever show one.
      if (!silent) {
        setState(() {
          _errorMessage = trRead(context, 'could_not_load_order');
          _isLoading = false;
        });
      }
    }
  }

  void _openReturnRequest(int subOrderId, String supplierLabel) {
    // Real fix: capture THIS page's own context explicitly, before the
    // showModalBottomSheet builder below shadows the name `context` with
    // the bottom sheet's own (about-to-be-popped) context. The original
    // code used the shadowed, sheet-owned context for both the pop() and
    // the ScaffoldMessenger call after it -- which silently showed no
    // SnackBar at all, since that context belongs to the very route being
    // removed. Confirmed live in a real browser, not just reasoned about.
    final pageContext = context;
    showModalBottomSheet(
      context: pageContext,
      isScrollControlled: true,
      builder: (sheetContext) => _ReturnRequestSheet(
        subOrderId: subOrderId,
        supplierLabel: supplierLabel,
        onSubmitted: () {
          Navigator.of(sheetContext).pop();
          ScaffoldMessenger.of(pageContext).showSnackBar(
            SnackBar(
              content: Text(trRead(pageContext, 'return_request_sent')),
              // Real deep link straight to the new case in My Returns
              // (see returns_screen.dart) -- otherwise a buyer who just
              // filed a return has no obvious next step to go check on it.
              action: SnackBarAction(label: trRead(pageContext, 'view'), onPressed: () => pageContext.push('/returns')),
            ),
          );
        },
      ),
    );
  }

  // Real "pending address" banner (migration 030) -- a real, honest
  // state shown instead of a silently missing shipping address. Real
  // guests reach this after declining/skipping the geolocation
  // suggestion at checkout; a real logged-in buyer should never
  // actually see this (their address is required at checkout), but
  // it's handled here too in case of any real edge case.
  Widget _buildPendingAddressBanner() {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFDF1EB), borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(Icons.location_off_outlined, size: 18, color: LeapPalette.of(context).signal),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isAr ? 'الطلب معلّق حتى تؤكد عنوان التسليم.' : 'Order pending — add your delivery address to continue.',
              style: TextStyle(fontSize: 12.5, color: LeapPalette.of(context).ink),
            ),
          ),
          TextButton(
            onPressed: _openAddAddress,
            child: Text(isAr ? 'إضافة عنوان' : 'Add address'),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmedAddress(Map<String, dynamic> address) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.location_on_outlined, size: 18, color: LeapPalette.of(context).muted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${address['recipientName']}\n${address['streetAddress']}, ${address['city']}, ${address['country']}',
              style: const TextStyle(fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  void _openAddAddress() {
    final auth = context.read<AuthState>();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AddAddressSheet(
        orderId: widget.orderId,
        guestEmail: _order?['guestEmail'] as String?,
        token: auth.token,
        onSaved: () {
          Navigator.of(context).pop();
          _load();
        },
      ),
    );
  }

  bool _isCancellable() {
    // Confirmed with the person: matches the real backend's own
    // whole-order check exactly -- cancellable only while every real
    // sub-order is still cancellable by real hub status, not the old
    // disconnected supplier_sub_orders.status field.
    if (_order == null) return false;
    if (_order!['status'] == 'cancelled') return false;
    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    return subOrders.every(isSubOrderCancellable);
  }

  /// Confirmed with the person: true when the order is a genuine mix
  /// -- some real parts still cancellable, others already shipped --
  /// the case where the whole-order button is replaced by individual
  /// per-supplier ones instead.
  bool _isPartiallyCancellable() {
    if (_order == null) return false;
    if (_order!['status'] == 'cancelled') return false;
    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    final cancellableCount = subOrders.where(isSubOrderCancellable).length;
    return cancellableCount > 0 && cancellableCount < subOrders.length;
  }

  Future<void> _confirmAndCancelOrder() async {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isAr ? 'إلغاء الطلب؟' : 'Cancel this order?'),
        content: Text(isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(isAr ? 'رجوع' : 'Back')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(isAr ? 'إلغاء الطلب' : 'Cancel order')),
        ],
      ),
    );
    if (confirmed != true) return;

    final auth = context.read<AuthState>();
    try {
      await ApiClient().cancelOrder(auth.token!, widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isAr ? 'تم إلغاء الطلب.' : 'Order cancelled.')),
        );
        _load();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  /// Confirmed with the person: cancels just one real supplier's
  /// part -- same real confirm-dialog and feedback pattern as
  /// _confirmAndCancelOrder above, scoped to a single sub-order.
  Future<void> _confirmAndCancelSubOrder(int subOrderId, String supplierLabel) async {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isAr ? 'إلغاء هذا الجزء؟' : 'Cancel this part?'),
        content: Text(isAr ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(isAr ? 'رجوع' : 'Back')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(isAr ? 'إلغاء' : 'Cancel')),
        ],
      ),
    );
    if (confirmed != true) return;

    final auth = context.read<AuthState>();
    try {
      await ApiClient().cancelSubOrder(auth.token!, widget.orderId, subOrderId.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isAr ? 'تم الإلغاء.' : 'Cancelled.')),
        );
        _load();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  /// Real "reorder" (new) -- adds every real item from every real
  /// supplier sub-order back into the real cart, one item at a time
  /// rather than a single bulk call, so a genuine per-item failure
  /// (out of stock since this order, or the product no longer exists/
  /// isn't active) doesn't silently block every other item too. Uses
  /// the real cart's own real stock validation (already enforced by
  /// CartState.addItem) rather than re-checking stock here -- the
  /// backend is the one real source of truth for what's actually
  /// available right now.
  Future<void> _reorder() async {
    if (_order == null) return;
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    final allItems = <Map<String, dynamic>>[];
    for (final so in subOrders) {
      allItems.addAll((so['items'] as List).cast<Map<String, dynamic>>());
    }
    if (allItems.isEmpty) return;

    setState(() => _isReordering = true);
    final cart = context.read<CartState>();
    var addedCount = 0;
    final failedNames = <String>[];
    for (final item in allItems) {
      try {
        await cart.addItem(item['productId'] as String, item['quantity'] as int);
        addedCount++;
      } catch (_) {
        // Real, honest per-item failure -- most likely a real
        // out-of-stock rejection from the real cart's own stock
        // validation, or the product no longer existing/being active.
        // Continue with the rest of the real items regardless.
        failedNames.add(item['name'] as String? ?? item['productId'] as String);
      }
    }
    if (!mounted) return;
    setState(() => _isReordering = false);

    if (addedCount > 0 && failedNames.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isAr ? 'تمت إضافة $addedCount عنصرًا إلى سلتك.' : '$addedCount item${addedCount == 1 ? '' : 's'} added to your cart.'),
          action: SnackBarAction(label: isAr ? 'عرض السلة' : 'View cart', onPressed: () => context.go('/cart')),
        ),
      );
    } else if (addedCount > 0 && failedNames.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isAr
                ? 'تمت إضافة $addedCount عنصرًا. تعذر إضافة: ${failedNames.join('، ')}'
                : '$addedCount item${addedCount == 1 ? '' : 's'} added. Could not add: ${failedNames.join(', ')}',
          ),
          duration: const Duration(seconds: 6),
          action: SnackBarAction(label: isAr ? 'عرض السلة' : 'View cart', onPressed: () => context.go('/cart')),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isAr ? 'تعذرت إضافة أي عنصر من هذا الطلب.' : 'Could not add any item from this order right now.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'order'))), body: const Center(child: CircularProgressIndicator()));
    }
    if (_errorMessage != null || _order == null) {
      return Scaffold(appBar: AppBar(title: Text(tr(context, 'order'))), body: Center(child: Text(_errorMessage ?? tr(context, 'not_found'), style: TextStyle(color: LeapPalette.of(context).muted))));
    }

    final subOrders = (_order!['supplierSubOrders'] as List).cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(title: Text(_order!['id'] as String)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              PlateChip(text: _order!['id'] as String),
              Text(trStatus(context, (_order!['displayStatus'] as String?) ?? (_order!['status'] as String)).toUpperCase(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: LeapPalette.of(context).torque)),
            ],
          ),
          const SizedBox(height: 6),
          Text('\$${(_order!['total'] as num).toStringAsFixed(2)} ${_order!['currencyCode']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
          const SizedBox(height: 16),
          if (_order!['address'] == null)
            _buildPendingAddressBanner()
          else
            _buildConfirmedAddress(_order!['address'] as Map<String, dynamic>),
          const SizedBox(height: 20),
          Text(tr(context, 'shipped_by'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          for (final so in subOrders) _SupplierSubOrderCard(
            subOrder: so,
            onRequestReturn: _openReturnRequest,
            onCancelSubOrder: _confirmAndCancelSubOrder,
            showCancelButton: _isPartiallyCancellable() && isSubOrderCancellable(so),
          ),
          const SizedBox(height: 8),
          // Real fix (confirmed directly): don't show "Track your
          // package" once every real sub-order has genuinely been
          // delivered -- there's nothing left to actively track.
          // Uses the same real _buyerFacingStage already confirmed for
          // the timeline above, which correctly checks the real
          // hubShipment status -- the backend's own computeDisplayStatus
          // gap this comment used to flag is now fixed too (separate
          // real commit), so this no longer needs its own workaround.
          if (subOrders.isNotEmpty && !subOrders.every((so) => _buyerFacingStage(so) == 'delivered'))
            OutlinedButton.icon(
              onPressed: () => context.push('/orders/${widget.orderId}/tracking'),
              icon: const Icon(Icons.local_shipping_outlined, size: 18),
              label: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'تتبع الطلب' : 'Track your package'),
            ),
          const SizedBox(height: 10),
          // Real Download receipt button (#150) -- opens the real
          // receipt PDF in the device's own browser/PDF viewer. Real
          // token-via-query-param auth (since url_launcher can't
          // attach a real Authorization header), matching the exact
          // same real auth support just added on the backend.
          OutlinedButton.icon(
            onPressed: () async {
              final auth = context.read<AuthState>();
              final query = auth.isLoggedIn
                  ? 'token=${auth.token}'
                  : 'guestEmail=${Uri.encodeQueryComponent(widget.guestEmail ?? '')}';
              final url = Uri.parse('${ApiClient().baseUrl}/order/${widget.orderId}/receipt?$query');
              await launchUrl(url, mode: LaunchMode.externalApplication);
            },
            icon: const Icon(Icons.receipt_long_outlined, size: 18),
            label: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'تنزيل الإيصال' : 'Download receipt'),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _isReordering ? null : _reorder,
            icon: _isReordering
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.replay, size: 18),
            label: Text(
              _isReordering
                  ? (Localizations.localeOf(context).languageCode == 'ar' ? 'جارٍ الإضافة…' : 'Adding…')
                  : (Localizations.localeOf(context).languageCode == 'ar' ? 'إعادة الطلب' : 'Reorder'),
            ),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
          if (_isCancellable()) ...[
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: _confirmAndCancelOrder,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), minimumSize: const Size.fromHeight(48)),
              child: Text(Localizations.localeOf(context).languageCode == 'ar' ? 'إلغاء الطلب' : 'Cancel order'),
            ),
          ],
        ],
      ),
    );
  }
}

/// Confirmed with the person: the real buyer-facing timeline stage
/// -- "shipped" now genuinely means the hub shipped to the buyer
/// (hub_shipments.status == 'shipped_to_buyer'), not just the
/// supplier shipping to the hub, which is an internal step the
/// buyer has no way to know happened and would otherwise wrongly
/// read as their package already being on its way to them. A real,
/// genuine top-level function (not a class method) since it's used
/// from _SupplierSubOrderCard below and doesn't depend on any
/// instance state at all, only its own parameter.
String _buyerFacingStage(Map<String, dynamic> subOrder) {
  final rawStatus = subOrder['status'] as String;
  if (rawStatus == 'dispute' || rawStatus == 'pending' || rawStatus == 'preparing') return rawStatus;
  final hubShipment = subOrder['hubShipment'] as Map<String, dynamic>?;
  if (hubShipment == null) {
    // Confirmed with the person: rawStatus 'shipped' here
    // specifically means shipped to the hub, not the buyer -- with
    // no real hub shipment record at all, the package definitely
    // hasn't reached the buyer yet, regardless of the supplier's own
    // real status. Only a genuinely different real status (e.g.
    // 'delivered' on an older real order from before the hub
    // workflow existed) falls through to the raw value below.
    if (rawStatus == 'shipped') return 'preparing';
    return rawStatus;
  }
  final hubStatus = hubShipment['status'] as String;
  if (hubStatus == 'shipped_to_buyer') return 'shipped';
  if (hubStatus == 'delivered') return 'delivered';
  if (hubStatus == 'flagged') return 'dispute';
  return 'preparing';
}

/// Confirmed with the person: matches the real backend's own
/// isSubOrderCancellable exactly -- no real hub shipment yet, or any
/// real hub stage before 'shipped_to_buyer' (including 'flagged'),
/// counts as cancellable.
bool isSubOrderCancellable(Map<String, dynamic> subOrder) {
  if (subOrder['status'] == 'cancelled') return false;
  final hubShipment = subOrder['hubShipment'] as Map<String, dynamic>?;
  final hubStatus = hubShipment?['status'] as String?;
  if (hubStatus == 'shipped_to_buyer' || hubStatus == 'delivered') return false;
  return true;
}

class _SupplierSubOrderCard extends StatelessWidget {
  final Map<String, dynamic> subOrder;
  final void Function(int subOrderId, String supplierLabel) onRequestReturn;
  final void Function(int subOrderId, String supplierLabel)? onCancelSubOrder;
  final bool showCancelButton;
  const _SupplierSubOrderCard({required this.subOrder, required this.onRequestReturn, this.onCancelSubOrder, this.showCancelButton = false});

  @override
  Widget build(BuildContext context) {
    final items = (subOrder['items'] as List).cast<Map<String, dynamic>>();
    final supplierName = (subOrder['supplierName'] as String?) ?? (subOrder['supplierId'] as String);
    final trackingNumber = subOrder['trackingNumber'] as String?;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(supplierName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 10),
            OrderStatusTimeline(status: _buyerFacingStage(subOrder)),
            const SizedBox(height: 4),
            if (trackingNumber != null) ...[
              const SizedBox(height: 4),
              Text('${tr(context, 'tracking_label')} $trackingNumber', style: TextStyle(fontSize: 11.5, color: LeapPalette.of(context).muted)),
            ],
            const SizedBox(height: 8),
            for (final item in items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                // Real, new -- tapping this item opens its own
                // product page.
                child: Material(
                  type: MaterialType.transparency,
                  child: InkWell(
                    onTap: () => context.push('/product/${item['productId']}'),
                    child: Row(
                  children: [
                    // Real product thumbnail (new) -- closes a real
                    // gap: items were shown as plain text only before,
                    // no real photo at all.
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: item['imageUrl'] != null
                          ? CachedNetworkImage(
                              fadeInDuration: const Duration(milliseconds: 300),
                              imageUrl: ApiClient.resolveMediaUrl(item['imageUrl'] as String),
                              width: 40,
                              height: 40,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(width: 40, height: 40, color: Colors.white),
                              errorWidget: (context, url, error) => Container(width: 40, height: 40, color: Colors.white, child: Icon(Icons.broken_image_outlined, size: 14, color: LeapPalette.of(context).muted)),
                            )
                          : Container(width: 40, height: 40, color: Colors.white, child: Icon(Icons.inventory_2_outlined, size: 14, color: LeapPalette.of(context).muted)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text('${item['name']} × ${item['quantity']}', style: const TextStyle(fontSize: 12.5))),
                    const SizedBox(width: 4),
                    Icon(Icons.chevron_right, size: 16, color: LeapPalette.of(context).muted),
                  ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            if (showCancelButton && onCancelSubOrder != null)
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(
                  onPressed: () => onCancelSubOrder!(subOrder['subOrderId'] as int, supplierName),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red)),
                  child: Text(tr(context, 'cancel_this_part'), style: const TextStyle(fontSize: 12.5)),
                ),
              ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => onRequestReturn(subOrder['subOrderId'] as int, supplierName),
                child: Text(tr(context, 'request_a_return'), style: const TextStyle(fontSize: 12.5)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Real "Add address" sheet (migration 030) -- used both for a real
// guest completing a real "pending" order, and available generically
// for any order missing an address. Plain manual entry here -- the
// real geolocation-based suggestion only happens once, right at
// checkout (see checkout_screen.dart's _AddressConfirmationSheet).
class _AddAddressSheet extends StatefulWidget {
  final String orderId;
  final String? guestEmail;
  final String? token;
  final VoidCallback onSaved;

  const _AddAddressSheet({required this.orderId, required this.guestEmail, required this.token, required this.onSaved});

  @override
  State<_AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends State<_AddAddressSheet> {
  final _recipientController = TextEditingController();
  final _phoneController = TextEditingController();
  final _countryController = TextEditingController();
  final _cityController = TextEditingController();
  final _streetController = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _recipientController.dispose();
    _phoneController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_recipientController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty ||
        _countryController.text.trim().isEmpty ||
        _cityController.text.trim().isEmpty ||
        _streetController.text.trim().isEmpty) {
      setState(() => _error = 'Please fill in every field.');
      return;
    }
    setState(() { _isSaving = true; _error = null; });
    try {
      await ApiClient().confirmOrderAddress(
        widget.orderId,
        {
          'recipientName': _recipientController.text.trim(),
          'phone': _phoneController.text.trim(),
          'country': _countryController.text.trim(),
          'city': _cityController.text.trim(),
          'streetAddress': _streetController.text.trim(),
        },
        guestEmail: widget.guestEmail,
        token: widget.token,
        source: 'manual',
      );
      widget.onSaved();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add your delivery address', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            TextField(controller: _recipientController, decoration: const InputDecoration(labelText: 'Recipient name')),
            const SizedBox(height: 10),
            TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 10),
            TextField(controller: _countryController, decoration: const InputDecoration(labelText: 'Country')),
            const SizedBox(height: 10),
            TextField(controller: _cityController, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 10),
            TextField(controller: _streetController, decoration: const InputDecoration(labelText: 'Street address')),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save address'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReturnRequestSheet extends StatefulWidget {
  final int subOrderId;
  final String supplierLabel;
  final VoidCallback onSubmitted;
  const _ReturnRequestSheet({required this.subOrderId, required this.supplierLabel, required this.onSubmitted});

  @override
  State<_ReturnRequestSheet> createState() => _ReturnRequestSheetState();
}

class _ReturnRequestSheetState extends State<_ReturnRequestSheet> {
  final _reasonController = TextEditingController();
  final _messageController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  // Real, optional evidence photos (migration 043) -- same "up to 3,
  // optional" pattern as reviews_section.dart's photo picker, reusing
  // the identical generic upload endpoint. Genuinely optional: a return
  // request has no equivalent business rule forcing one (see the
  // backend route's own comment for why).
  static const _maxPhotos = 3;
  final List<String> _uploadedPhotoUrls = [];
  bool _isUploadingPhoto = false;

  @override
  void dispose() {
    _reasonController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadPhoto() async {
    if (_uploadedPhotoUrls.length >= _maxPhotos) return;
    final token = context.read<AuthState>().token;
    if (token == null) return; // Photo evidence requires a real logged-in buyer -- see uploadReturnPhoto's own comment.
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _isUploadingPhoto = true);
    try {
      final url = await ApiClient().uploadReturnPhoto(token, picked);
      if (mounted) setState(() => _uploadedPhotoUrls.add(url));
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } catch (e) {
      // Defense in depth: the previous bug in this exact spot (fromPath
      // failing on Flutter Web) threw a non-ApiException exception that
      // was never caught anywhere, so the picker silently did nothing.
      // A future failure of this same class should at least surface
      // something, not repeat that silence.
      if (mounted) setState(() => _errorMessage = 'Could not upload photo: $e');
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _removePhoto(int index) {
    setState(() => _uploadedPhotoUrls.removeAt(index));
  }

  Future<void> _submit() async {
    if (_reasonController.text.trim().isEmpty || _messageController.text.trim().isEmpty) {
      setState(() => _errorMessage = trRead(context, 'please_fill_both_fields'));
      return;
    }
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    final auth = context.read<AuthState>();
    try {
      await ApiClient().createReturnCase(
        token: auth.token,
        subOrderId: widget.subOrderId,
        reason: _reasonController.text.trim(),
        message: _messageController.text.trim(),
        photos: _uploadedPhotoUrls.isEmpty ? null : _uploadedPhotoUrls,
      );
      widget.onSubmitted();
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${tr(context, 'request_a_return')} — ${widget.supplierLabel}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(
            tr(context, 'return_goes_to_leap'),
            style: TextStyle(fontSize: 12, color: LeapPalette.of(context).muted),
          ),
          const SizedBox(height: 16),
          TextField(controller: _reasonController, decoration: InputDecoration(labelText: tr(context, 'reason_label'))),
          const SizedBox(height: 12),
          TextField(
            controller: _messageController,
            maxLines: 4,
            decoration: InputDecoration(labelText: tr(context, 'details_label'), alignLabelWithHint: true),
          ),
          const SizedBox(height: 12),
          Text(tr(context, 'attach_photos_optional'), style: TextStyle(fontSize: 12, color: LeapPalette.of(context).muted)),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 0; i < _uploadedPhotoUrls.length; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(
                          fadeInDuration: const Duration(milliseconds: 300),
                          imageUrl: '${AppConfig.apiBaseUrl}${_uploadedPhotoUrls[i]}',
                          width: 64,
                          height: 64,
                          fit: BoxFit.cover,
                          // Real placeholder/error handling (new) --
                          // closes a real, small inconsistency: every
                          // other real image display in this app
                          // already has both; this one (return-
                          // evidence photo previews) didn't.
                          placeholder: (context, url) => Container(width: 64, height: 64, color: Colors.white),
                          errorWidget: (context, url, error) => Container(
                            width: 64,
                            height: 64,
                            color: Colors.white,
                            child: Icon(Icons.broken_image_outlined, size: 20, color: LeapPalette.of(context).muted),
                          ),
                        ),
                      ),
                      Positioned(
                        top: -6, right: -6,
                        child: IconButton(
                          icon: Icon(Icons.cancel, size: 18, color: LeapPalette.of(context).muted),
                          tooltip: 'Remove photo',
                          onPressed: () => _removePhoto(i),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_uploadedPhotoUrls.length < _maxPhotos)
                InkWell(
                  onTap: _isUploadingPhoto ? null : _pickAndUploadPhoto,
                  child: Container(
                    width: 64, height: 64,
                    decoration: BoxDecoration(border: Border.all(color: LeapPalette.of(context).line), borderRadius: BorderRadius.circular(8)),
                    child: Center(
                      child: _isUploadingPhoto
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : Icon(Icons.add_a_photo_outlined, color: LeapPalette.of(context).muted, size: 22),
                    ),
                  ),
                ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(tr(context, 'submit_request')),
          ),
        ],
      ),
    );
  }
}
