import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../services/api_client.dart';

/// Real "track your package" screen (new). Shows a real, merged
/// timeline: our own real hub milestones (received, opened, inspected,
/// packed, shipped to you, delivered) plus real live carrier events
/// from 17TRACK's own tracking-query API for the hub's own final-leg
/// tracking number -- never the supplier's domestic one (see
/// migration 027's own header comment for why).
///
/// HONEST LIMITATION: the real live carrier events portion depends on
/// a real, configured TRACK17_API_KEY on the backend, and on 17TRACK's
/// own documented API behaving the way this was built to expect --
/// neither has been verified against a real, live account (see
/// services/api/src/modules/tracking/liveTracking.js's own header
/// comment). If that portion is ever empty, the real hub milestones
/// below still show correctly regardless -- they never depend on the
/// carrier query succeeding.
///
/// Real auto-refresh (new): a buyer previously had to manually leave
/// and re-enter this screen (or the OS-level pull-to-refresh gesture
/// wasn't even wired up) to see whether a shipment moved to its next
/// real stage. Polls every 20s while this screen is on-screen, plus a
/// real pull-to-refresh gesture for an immediate manual check. Silent
/// -- a background poll never flashes the full-screen loading spinner,
/// only the very first load does; the person shouldn't see their
/// already-loaded timeline blank out every 20 seconds.
class TrackingScreen extends StatefulWidget {
  final String orderId;
  const TrackingScreen({super.key, required this.orderId});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Map<String, dynamic>? _tracking;
  bool _isLoading = true;
  String? _error;
  Timer? _pollTimer;
  String? _token;

  static const _pollInterval = Duration(seconds: 20);

  @override
  void initState() {
    super.initState();
    _token = context.read<AuthState>().token;
    if (_token != null) {
      _load(showSpinner: true);
      _pollTimer = Timer.periodic(_pollInterval, (_) => _load(showSpinner: false));
    } else {
      _isLoading = false;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({required bool showSpinner}) async {
    if (_token == null || !mounted) return;
    final lang = context.read<LanguageState>().isArabic ? 'ar' : 'en'; // read BEFORE the await below
    if (showSpinner && mounted) setState(() { _isLoading = true; _error = null; });
    try {
      final data = await ApiClient().fetchOrderTracking(_token!, widget.orderId, lang: lang);
      if (mounted) setState(() { _tracking = data; _isLoading = false; _error = null; });
    } catch (e) {
      // A silent background poll that fails shouldn't wipe out an
      // already-successfully-loaded timeline with an error screen --
      // only the very first load surfaces an error state.
      if (mounted && _tracking == null) setState(() { _error = '$e'; _isLoading = false; });
    }
  }

  // [kind] is the hub step's own name (sent by the server, the same in every language); the carrier's own texts have none and are matched by words.
  IconData _iconFor(String description, String? kind) {
    switch (kind) {
      case 'delivered':
        return Icons.check_circle;
      case 'shipped_to_buyer':
        return Icons.local_shipping_outlined;
      case 'received':
      case 'opened':
      case 'inspected':
      case 'packed':
        return Icons.inventory_2_outlined;
    }
    final d = description.toLowerCase();
    if (d.contains('delivered')) return Icons.check_circle;
    if (d.contains('shipped')) return Icons.local_shipping_outlined;
    if (d.contains('customs')) return Icons.gavel_outlined;
    if (d.contains('out for delivery')) return Icons.delivery_dining_outlined;
    if (d.contains('received') || d.contains('inspect') || d.contains('pack')) return Icons.inventory_2_outlined;
    return Icons.radio_button_checked;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'track_package_title'))),
      body: _token == null
          ? Center(child: Text(tr(context, 'tracking_login_required'), style: const TextStyle(color: LeapColors.muted)))
          : _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _tracking == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _tracking == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(tr(context, 'tracking_load_failed'), textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
        ),
      );
    }
    final subOrders = (_tracking?['subOrders'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    if (subOrders.isEmpty) {
      return Center(child: Text(tr(context, 'tracking_no_shipments'), style: const TextStyle(color: LeapColors.muted)));
    }
    return RefreshIndicator(
      onRefresh: () => _load(showSpinner: false),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: subOrders.length,
        itemBuilder: (context, i) {
          final so = subOrders[i];
          final timeline = (so['timeline'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          final hubTracking = so['hubTrackingNumber'] as String?;
          final isDelayed = so['isDelayed'] == true;
          return Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Real, automatic delay indicator (#57) -- purely
                // time-based, never a fabricated specific reason like
                // "customs delay" since this system genuinely doesn't
                // track one.
                if (isDelayed) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: LeapColors.torque.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                    child: Row(
                      children: [
                        const Icon(Icons.schedule, color: LeapColors.torque, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                            child: Text(
                              tr(context, 'tracking_delayed'),
                              style: const TextStyle(color: LeapColors.torque, fontSize: 12.5, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (hubTracking != null) ...[
                  Text(tr(context, 'tracking_number_label'), style: const TextStyle(fontSize: 11.5, color: LeapColors.muted)),
                  Text(hubTracking, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                ],
                if (timeline.isEmpty)
                  Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(tr(context, 'tracking_no_updates'), style: const TextStyle(color: LeapColors.muted)),
                  )
                else
                  for (var j = 0; j < timeline.length; j++)
                    _TimelineRow(
                      icon: _iconFor(timeline[j]['description'] as String? ?? '', timeline[j]['kind'] as String?),
                      description: timeline[j]['description'] as String? ?? '',
                      location: timeline[j]['location'] as String?,
                      time: timeline[j]['time'] as String?,
                      isFirst: j == 0,
                      isLast: j == timeline.length - 1,
                    ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  final IconData icon;
  final String description;
  final String? location;
  final String? time;
  final bool isFirst;
  final bool isLast;

  const _TimelineRow({
    required this.icon,
    required this.description,
    required this.location,
    required this.time,
    required this.isFirst,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    final formattedTime = time != null ? DateTime.tryParse(time!)?.toLocal() : null;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Icon(icon, size: 20, color: isFirst ? LeapColors.signal : LeapColors.muted),
              if (!isLast) Expanded(child: Container(width: 2, color: LeapColors.line)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(description, style: TextStyle(fontSize: 13.5, fontWeight: isFirst ? FontWeight.w700 : FontWeight.w500)),
                  if (location != null && location!.isNotEmpty)
                    Text(location!, style: const TextStyle(fontSize: 12, color: LeapColors.muted)),
                  if (formattedTime != null)
                    Text(
                      '${formattedTime.month}/${formattedTime.day}/${formattedTime.year} · ${formattedTime.hour.toString().padLeft(2, '0')}:${formattedTime.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(fontSize: 11.5, color: LeapColors.muted),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
