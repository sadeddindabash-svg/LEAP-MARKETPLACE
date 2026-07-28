import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../services/api_client.dart';

/// Real notifications — triggered by real order changes, message/
/// ticket replies, and several more real trigger points added since
/// (referral rewards, low stock, price drops, saved search matches,
/// back-in-stock alerts) -- see
/// services/api/src/modules/notifications/helpers.js's own header
/// comment for the real, current, complete list (this comment used to
/// say "4 real trigger points," a stale count from when the feature
/// first shipped). Tapping one marks it read and navigates to the real
/// thing it's about.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic>? _notifications;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      final notifications = await ApiClient().fetchNotifications(token);
      if (mounted) setState(() { _notifications = notifications; _errorMessage = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    }
  }

  Future<void> _markAllRead() async {
    final token = context.read<AuthState>().token;
    if (token == null) return;
    try {
      await ApiClient().markAllNotificationsRead(token);
      _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    final token = context.read<AuthState>().token;
    if (token != null && n['isRead'] != true) {
      try {
        await ApiClient().markNotificationRead(token, n['id'] as int);
      } catch (_) {} // non-critical -- still navigate even if marking read fails
    }
    if (!mounted) return;
    // REAL BUG FOUND AND FIXED HERE: this used to only handle 'order'
    // and 'ticket' -- but the real backend has 6 distinct real
    // linkType values now (confirmed by checking every real
    // createNotification call site directly, not assumed): 'order',
    // 'ticket', 'product' (back-in-stock, price-drop), 'saved_search',
    // 'promo_code' (a referral reward), and 'supplier_message'. Tapping
    // a back-in-stock or price-drop notification used to silently do
    // nothing beyond marking it read -- a real, confirmed dead end.
    // 'supplier_message' is deliberately left as a graceful fallback
    // (not a real dead end, just no dedicated screen) -- it's meant
    // for a supplier's own linked account in the web supplier portal,
    // not a typical buyer's mobile session.
    final linkType = n['linkType'] as String?;
    final linkId = n['linkId'] as String?;
    if (linkType == 'order' && linkId != null) {
      context.push('/orders/$linkId').then((_) => _load());
    } else if (linkType == 'ticket' && linkId != null) {
      context.push('/support/$linkId').then((_) => _load());
    } else if (linkType == 'product' && linkId != null) {
      context.push('/product/$linkId').then((_) => _load());
    } else if (linkType == 'saved_search') {
      context.push('/saved-searches').then((_) => _load());
    } else if (linkType == 'promo_code') {
      context.push('/referrals').then((_) => _load());
    } else {
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, 'notifications')),
        actions: [
          if ((_notifications?.any((n) => n['isRead'] != true)) ?? false)
            TextButton(onPressed: _markAllRead, child: Text(tr(context, 'mark_all_read'))),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _errorMessage != null
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 80),
                    child: Center(child: Text(_errorMessage!, style: const TextStyle(color: LeapColors.muted))),
                  ),
                ],
              )
            : _notifications == null
                ? const Center(child: CircularProgressIndicator())
                : _notifications!.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 80),
                            child: Center(child: Text(tr(context, 'no_notifications_yet'), style: const TextStyle(color: LeapColors.muted))),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: _notifications!.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final n = _notifications![i] as Map<String, dynamic>;
                          final isRead = n['isRead'] as bool;
                          return ListTile(
                            leading: Icon(
                              isRead ? Icons.notifications_none : Icons.notifications,
                              color: isRead ? LeapColors.muted : LeapColors.signal,
                            ),
                            title: Text(
                              n['title'] as String,
                              style: TextStyle(fontWeight: isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13.5),
                            ),
                            subtitle: Text(n['body'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                            trailing: Text(
                              _formatRelativeTime(DateTime.parse(n['createdAt'] as String)),
                              style: const TextStyle(fontSize: 10.5, color: LeapColors.muted),
                            ),
                            onTap: () => _openNotification(n),
                          );
                        },
                      ),
      ),
    );
  }
}

String _formatRelativeTime(DateTime time) {
  final diff = DateTime.now().difference(time);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inHours < 1) return '${diff.inMinutes}m';
  if (diff.inDays < 1) return '${diff.inHours}h';
  return '${diff.inDays}d';
}
