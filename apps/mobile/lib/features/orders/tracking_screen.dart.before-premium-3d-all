import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../services/api_client.dart';
import '../../widgets/delivery_confirm.dart';

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

  static const _pollInterval = Duration(seconds: 5);

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
                if (timeline.isEmpty && so['stage'] == null)
                  Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(tr(context, 'tracking_no_updates'), style: const TextStyle(color: LeapColors.muted)),
                  )
                // the 7 steps (placed ... delivered), the carrier's events under "Shipped to you"
                else if (so['cancelled'] != true)
                  _StepsList(stage: (so['stage'] as num?)?.toInt(), timeline: timeline, arabic: context.watch<LanguageState>().isArabic)
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
                // migration 120: the code for the driver while it is on its way; after delivery the photo, who received it and "not my parcel"
                if (so['deliveryCode'] != null) DeliveryCodeCard(code: so['deliveryCode'] as String),
                if (so['deliveryCode'] != null && so['lastDeliveryAttempt'] != null) DeliveryAttemptNotice(attempt: (so['lastDeliveryAttempt'] as Map).cast<String, dynamic>()),
                if (so['deliveryProof'] != null) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final photo in ((so['deliveryProof'] as Map)['photos'] as List).cast<Map>())
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(ApiClient.resolveMediaUrl(photo['url'] as String), width: 120, height: 96, fit: BoxFit.cover,
                              errorBuilder: (context, error, stack) => Container(width: 120, height: 96, color: LeapColors.muted.withValues(alpha: 0.15))),
                        ),
                    ],
                  ),
                  DeliveryProofSummary(proof: (so['deliveryProof'] as Map).cast<String, dynamic>(), orderId: widget.orderId),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

// The 7 steps from the order being placed to delivery (the same as the admin's delivery bar): finished steps are ticked, the current one
// is circled and marked "Now", later ones are grey. Each step shows when it happened; the carrier's live events are listed under
// "Shipped to you". [stage] comes from the server (0-6); without it, the furthest step found in the timeline is used.
const _stepKinds = [
  ['placed'], ['preparing'], ['shipped_to_hub'], ['received', 'opened'], ['inspected', 'packed'], ['shipped_to_buyer'], ['delivered'],
];
const _stepNamesEn = ['Order placed', 'Preparing your order', 'On the way to the LEAP hub', 'Arrived at the LEAP hub', 'Checked and packed', 'Shipped to you', 'Delivered'];
const _stepNamesAr = ['تم تقديم الطلب', 'جارٍ تجهيز طلبك', 'في الطريق إلى مركز LEAP', 'وصل إلى مركز LEAP', 'تم الفحص والتغليف', 'تم الشحن إليك', 'تم التسليم'];
const _stepNotesEn = ['', 'The seller is packing your parts', '', 'Quality check', '', '', ''];
const _stepNotesAr = ['', 'البائع يجهّز قطعك', '', 'فحص الجودة', '', '', ''];

class _StepsList extends StatelessWidget {
  final int? stage;
  final List<Map<String, dynamic>> timeline;
  final bool arabic;
  const _StepsList({required this.stage, required this.timeline, required this.arabic});

  int get _current {
    if (stage != null) return stage! < 0 ? 0 : (stage! > 6 ? 6 : stage!);
    var furthest = 0;
    for (final e in timeline) {
      for (var i = 0; i < _stepKinds.length; i++) {
        if (_stepKinds[i].contains(e['kind']) && i > furthest) furthest = i;
      }
    }
    return furthest;
  }

  DateTime? _timeOf(int step) {
    DateTime? latest;
    for (final e in timeline) {
      if (!_stepKinds[step].contains(e['kind'])) continue;
      final t = DateTime.tryParse('${e['time'] ?? ''}')?.toLocal();
      if (t != null && (latest == null || t.isAfter(latest))) latest = t;
    }
    return latest;
  }

  String _fmt(DateTime t) => '${t.day.toString().padLeft(2, '0')}/${t.month.toString().padLeft(2, '0')}/${t.year} · ${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final current = _current;
    final carrier = timeline.where((e) => e['source'] == 'carrier').toList();
    return Column(
      key: const ValueKey('tracking-steps'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < 7; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    if (i < current || (i == current && current == 6))
                      Container(
                        width: 20, height: 20,
                        decoration: BoxDecoration(color: palette.gauge, shape: BoxShape.circle),
                        child: const Icon(Icons.check, size: 13, color: Colors.white),
                      )
                    else if (i == current)
                      Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: palette.torque, width: 3)))
                    else
                      Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: palette.line, width: 2))),
                    if (i < 6) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 2), color: i < current ? palette.gauge : palette.line)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Flexible(
                            child: Text(
                              arabic ? _stepNamesAr[i] : _stepNamesEn[i],
                              style: TextStyle(fontSize: 13.5, fontWeight: i == current ? FontWeight.w800 : (i < current ? FontWeight.w600 : FontWeight.w500), color: i <= current ? palette.ink : palette.muted),
                            ),
                          ),
                          if (i == current && current < 6) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(color: palette.torque.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                              child: Text(arabic ? 'الآن' : 'Now', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: palette.torque)),
                            ),
                          ],
                        ]),
                        if (i <= current && (arabic ? _stepNotesAr[i] : _stepNotesEn[i]).isNotEmpty)
                          Text(arabic ? _stepNotesAr[i] : _stepNotesEn[i], style: TextStyle(fontSize: 11.5, color: palette.muted)),
                        if (i <= current && _timeOf(i) != null)
                          Text(_fmt(_timeOf(i)!), style: TextStyle(fontSize: 11.5, color: palette.muted)),
                        // the carrier's live events, under "Shipped to you"
                        if (i == 5 && current >= 5 && carrier.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (final e in carrier)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: Text(
                                      [
                                        '${e['description'] ?? ''}',
                                        if ((e['location'] as String?)?.isNotEmpty == true) e['location'] as String,
                                        if (DateTime.tryParse('${e['time'] ?? ''}') != null) _fmt(DateTime.parse('${e['time']}').toLocal()),
                                      ].join(' · '),
                                      style: TextStyle(fontSize: 12, color: palette.muted),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
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
