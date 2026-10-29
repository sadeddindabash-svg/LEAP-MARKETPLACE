#!/usr/bin/env node
/**
 * v2 (fits the ticket screen that already polled every 20 seconds). Mobile app: AUTO REFRESH every 5 seconds, only while the app is open in the foreground (and at once when it comes back): the cart of a signed-in buyer (so the phone's and the website's carts stay in step), the orders list, the notifications
 * and a support ticket; the order details and tracking screens, which already refreshed, now do it every 5 seconds too. Quiet: no spinner, an error keeps what is on screen. Needs lib/core/periodic_refresh.dart and lib/core/auto_refresher.dart
 * from the same package. I cannot run Flutter: please run flutter analyze and flutter test, then try it.
 *
 *   node scripts/patch-auto-refresh-app-v2.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-auto-refresh-app-v2.js --write    applies it (each changed file is saved as <file>.before-auto-refresh-app-v2 first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/mobile/lib/core/cart_state.dart","what":"the cart refreshes itself every 5 seconds for a signed-in buyer (the same cart on every device)","done":"Future<void> _quietRefresh() async {","pairs":[["import '../models/cart_merge.dart';","import '../models/cart_merge.dart';\nimport 'auto_refresher.dart';"],["  CartMerge? _mergeNotice;\n","  CartMerge? _mergeNotice;\n  // The signed-in buyer's cart is the same on every device: it is read again every 5 seconds while the app is open (quietly). _applied counts the answers put on screen: a quiet answer that was overtaken by another one is dropped.\n  int _applied = 0;\n  late final AutoRefresher _refresher = AutoRefresher(_quietRefresh);\n"],["  bool get isLoading => _isLoading;\n","  @override\n  void dispose() {\n    _refresher.dispose();\n    super.dispose();\n  }\n\n  Future<void> _quietRefresh() async {\n    if (_token == null) return; // a guest's cart is for this device only: nothing else changes it\n    await refresh(silent: true);\n  }\n\n  bool get isLoading => _isLoading;\n"],["  void _applyCart(Cart cart) {\n    _items = cart.items;","  void _applyCart(Cart cart) {\n    _applied += 1;\n    _items = cart.items;"],["    _cartId = cartId;\n    await refresh();","    _cartId = cartId;\n    _refresher.start();\n    await refresh();"],["  Future<void> refresh() async {\n    if (_cartId == null) return;\n    _isLoading = true;\n    notifyListeners();\n    try {\n      _applyCart(await _apiClient.fetchCart(_cartId!, token: _token, lang: _language));\n      _errorMessage = null;\n    } catch (e) {","  /// [silent]: the 5-second refresh: no spinner, an error keeps what is on screen, and an answer that was overtaken by another one (the buyer's own change) is dropped.\n  Future<void> refresh({bool silent = false}) async {\n    if (_cartId == null) return;\n    if (!silent) {\n      _isLoading = true;\n      notifyListeners();\n    }\n    final before = _applied;\n    try {\n      final cart = await _apiClient.fetchCart(_cartId!, token: _token, lang: _language);\n      if (!silent || _applied == before) _applyCart(cart);\n      _errorMessage = null;\n    } catch (e) {"],["      _errorMessage = 'cart_load_failed';\n    } finally {\n      _isLoading = false;\n      notifyListeners();","      if (!silent) _errorMessage = 'cart_load_failed';\n    } finally {\n      if (!silent) _isLoading = false;\n      notifyListeners();"]]},{"file":"apps/mobile/lib/features/orders/orders_screen.dart","what":"the orders list refreshes itself every 5 seconds (quietly: no spinner)","done":"Future<void> _silentRefresh() async {","pairs":[["import '../../core/auth_state.dart';","import '../../core/auth_state.dart';\nimport '../../core/auto_refresher.dart';"],["  void _selectTab(String tabKey) {","  late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);\n\n  @override\n  void initState() {\n    super.initState();\n    _refresher.start();\n  }\n\n  /// Every 5 seconds while the app is open: the orders are read again quietly (no spinner; the list stays until the new one arrives; an error keeps the list).\n  Future<void> _silentRefresh() async {\n    final auth = context.read<AuthState>();\n    if (!mounted || !auth.isLoggedIn || auth.token == null) return;\n    final fresh = await ApiClient().fetchMyOrders(auth.token!, status: _selectedTab == 'all' ? null : _selectedTab);\n    if (!mounted) return;\n    setState(() => _ordersFuture = Future.value(fresh));\n  }\n\n  void _selectTab(String tabKey) {"],["    _lookupIdController.dispose();","    _refresher.dispose();\n    _lookupIdController.dispose();"],["                  if (snapshot.connectionState == ConnectionState.waiting) {\n                    return const ListSkeleton();","                  if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {\n                    return const ListSkeleton();"]]},{"file":"apps/mobile/lib/features/account/notifications_screen.dart","what":"the notifications refresh themselves every 5 seconds","done":"Future<void> _silentRefresh() async {","pairs":[["import '../../core/auth_state.dart';","import '../../core/auth_state.dart';\nimport '../../core/auto_refresher.dart';"],["    super.initState();\n    _load();\n  }","    super.initState();\n    _load();\n    _refresher.start();\n  }\n\n  late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);\n\n  @override\n  void dispose() {\n    _refresher.dispose();\n    super.dispose();\n  }\n\n  /// Every 5 seconds while the app is open: quietly (no error shown, the list stays if the server cannot be reached).\n  Future<void> _silentRefresh() async {\n    final token = context.read<AuthState>().token;\n    if (token == null || !mounted) return;\n    final lang = context.read<LanguageState>().language;\n    final notifications = await ApiClient().fetchNotifications(token, lang: lang);\n    if (mounted) setState(() => _notifications = notifications);\n  }"]]},{"file":"apps/mobile/lib/features/support/ticket_detail_screen.dart","what":"a support ticket refreshes itself every 5 seconds (replaces its own 20-second timer)","done":"late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);","pairs":[["import 'dart:async';\nimport 'package:flutter/material.dart';","import 'package:flutter/material.dart';"],["import '../../core/auth_state.dart';","import '../../core/auth_state.dart';\nimport '../../core/auto_refresher.dart';"],["  Timer? _pollTimer;\n",""],["  static const _pollInterval = Duration(seconds: 20);\n","  // Every 5 seconds while the app is open (and at once when it comes back): a reply from support appears by itself. Quiet: no spinner, an error keeps the thread on screen.\n  late final AutoRefresher _refresher = AutoRefresher(_silentRefresh);\n\n  Future<void> _silentRefresh() async {\n    if (!mounted || _needsEmail || _isLoading || _isSending) return; // not while a reply is being sent\n    await _load(showSpinner: false);\n  }\n"],["    _pollTimer = Timer.periodic(_pollInterval, (_) => _load(showSpinner: false));","    _refresher.start();"],["    _pollTimer?.cancel();","    _refresher.dispose();"]]},{"file":"apps/mobile/lib/features/orders/order_detail_screen.dart","what":"the order details refresh every 5 seconds","done":"static const _pollInterval = Duration(seconds: 5);","pairs":[["  static const _pollInterval = Duration(seconds: 20);","  static const _pollInterval = Duration(seconds: 5);"]]},{"file":"apps/mobile/lib/features/orders/tracking_screen.dart","what":"the tracking screen refreshes every 5 seconds","done":"static const _pollInterval = Duration(seconds: 5);","pairs":[["  static const _pollInterval = Duration(seconds: 20);","  static const _pollInterval = Duration(seconds: 5);"]]}],"whole":[]};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'auto-refresh-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'auto-refresh-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-auto-refresh-app-v2`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
