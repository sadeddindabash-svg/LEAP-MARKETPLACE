import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

// The 5-second refresh in the app's screens and the cart. Reads the source text, so it needs no device.
void main() {
  String read(String p) => File(p).readAsStringSync();
  final cart = read('lib/core/cart_state.dart');
  final orders = read('lib/features/orders/orders_screen.dart');
  final notes = read('lib/features/account/notifications_screen.dart');
  final ticket = read('lib/features/support/ticket_detail_screen.dart');
  final detail = read('lib/features/orders/order_detail_screen.dart');
  final tracking = read('lib/features/orders/tracking_screen.dart');
  final helper = read('lib/core/auto_refresher.dart');

  test('the helper runs only while the app is in the foreground and checks it when it starts', () {
    expect(helper.contains('with WidgetsBindingObserver'), isTrue);
    expect(helper.contains('state == null || state == AppLifecycleState.resumed'), isTrue);
    expect(helper.contains('_refresh.setVisible(state == AppLifecycleState.resumed);'), isTrue);
    expect(helper.contains('removeObserver(this)'), isTrue);
  });
  test('CRITICAL: the cart refreshes by itself for a signed-in buyer only, quietly, and drops an answer that was overtaken', () {
    expect(cart.contains('late final AutoRefresher _refresher = AutoRefresher(_quietRefresh);'), isTrue);
    expect(cart.contains('if (_token == null) return;'), isTrue);
    expect(cart.contains('await refresh(silent: true);'), isTrue);
    expect(cart.contains('if (!silent || _applied == before) _applyCart(cart);'), isTrue);
    expect(cart.contains("if (!silent) _errorMessage = 'cart_load_failed';"), isTrue);
    expect(cart.contains('if (!silent) _isLoading = false;'), isTrue);
    expect(cart.contains('    _applied += 1;'), isTrue);
    expect(cart.contains('_refresher.start();'), isTrue);
    expect(cart.contains('_refresher.dispose();'), isTrue);
  });
  test('CRITICAL: the orders list refreshes quietly: a new list replaces the old one without the skeleton, only while logged in', () {
    expect(orders.contains('late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);'), isTrue);
    expect(orders.contains('if (!mounted || !auth.isLoggedIn || auth.token == null) return;'), isTrue);
    expect(orders.contains('setState(() => _ordersFuture = Future.value(fresh));'), isTrue);
    expect(orders.contains('ConnectionState.waiting && !snapshot.hasData'), isTrue);
    expect(orders.contains('_refresher.start();'), isTrue);
    expect(orders.contains('_refresher.dispose();'), isTrue);
  });
  test('the notifications and a support ticket refresh quietly (a ticket not while a reply is being sent), and stop when the screen is left', () {
    for (final src in [notes, ticket]) {
      expect(src.contains('late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);'), isTrue);
      expect(src.contains('_refresher.start();'), isTrue);
      expect(src.contains('_refresher.dispose();'), isTrue);
    }
    expect(ticket.contains('_isSending) return;'), isTrue);
    expect(notes.contains('setState(() => _notifications = notifications);'), isTrue);
  });
  test('the order details and the tracking screen (already refreshing) now refresh every 5 seconds', () {
    expect(detail.contains('static const _pollInterval = Duration(seconds: 5);'), isTrue);
    expect(tracking.contains('static const _pollInterval = Duration(seconds: 5);'), isTrue);
  });
}
