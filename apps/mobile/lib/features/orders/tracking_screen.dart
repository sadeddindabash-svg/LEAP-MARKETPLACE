import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
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
class TrackingScreen extends StatefulWidget {
  final String orderId;
  const TrackingScreen({super.key, required this.orderId});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Future<Map<String, dynamic>>? _trackingFuture;

  @override
  void initState() {
    super.initState();
    final token = context.read<AuthState>().token;
    if (token != null) {
      _trackingFuture = ApiClient().fetchOrderTracking(token, widget.orderId);
    }
  }

  IconData _iconFor(String description) {
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
      appBar: AppBar(title: const Text('Track your package')),
      body: _trackingFuture == null
          ? const Center(child: Text('Please log in to view tracking.', style: TextStyle(color: LeapColors.muted)))
          : FutureBuilder<Map<String, dynamic>>(
              future: _trackingFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('Could not load tracking.\n${snapshot.error}', textAlign: TextAlign.center, style: const TextStyle(color: LeapColors.muted)),
                    ),
                  );
                }
                final subOrders = (snapshot.data?['subOrders'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                if (subOrders.isEmpty) {
                  return const Center(child: Text('No shipments found for this order.', style: TextStyle(color: LeapColors.muted)));
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: subOrders.length,
                  itemBuilder: (context, i) {
                    final so = subOrders[i];
                    final timeline = (so['timeline'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                    final hubTracking = so['hubTrackingNumber'] as String?;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (hubTracking != null) ...[
                            const Text('Tracking number', style: TextStyle(fontSize: 11.5, color: LeapColors.muted)),
                            Text(hubTracking, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 16),
                          ],
                          if (timeline.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: Text('No tracking updates yet — check back once your order ships.', style: TextStyle(color: LeapColors.muted)),
                            )
                          else
                            for (var j = 0; j < timeline.length; j++)
                              _TimelineRow(
                                icon: _iconFor(timeline[j]['description'] as String? ?? ''),
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
