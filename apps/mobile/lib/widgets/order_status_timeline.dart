import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/app_strings.dart';

/// Real visual timeline for a real sub-order's own status (new) --
/// closes a real gap: only a plain text badge existed before to show
/// progress (pending/preparing/shipped/delivered), no visual sense of
/// "how far along" a shipment actually is. Matches the real, exact
/// sub-order status values the backend actually uses (see migration
/// 001's own CHECK constraint on supplier_sub_orders.status) -- not
/// a guessed or approximated set of stages.
class OrderStatusTimeline extends StatelessWidget {
  final String status;
  const OrderStatusTimeline({super.key, required this.status});

  static const _stages = ['pending', 'preparing', 'shipped', 'delivered'];

  @override
  Widget build(BuildContext context) {
    // Real, deliberately separate handling for a real dispute -- not
    // a stage on the normal linear timeline at all, since a dispute
    // doesn't represent "further along" than any other real stage,
    // just a real, different situation entirely.
    if (status == 'dispute') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: const Color(0xFFFBE7DE), borderRadius: BorderRadius.circular(8)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 14, color: Color(0xFFC0362C)),
            const SizedBox(width: 6),
            Text(trStatus(context, 'dispute'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFC0362C))),
          ],
        ),
      );
    }

    final currentIndex = _stages.indexOf(status);
    // A real, unrecognized status (shouldn't happen against the real
    // backend's own CHECK constraint, but a client should never crash
    // over it) -- shown as plain text instead of a broken timeline.
    if (currentIndex == -1) {
      return Text(trStatus(context, status).toUpperCase(), style: const TextStyle(fontSize: 10.5, color: LeapColors.muted, fontWeight: FontWeight.w700));
    }

    return Row(
      children: [
        for (var i = 0; i < _stages.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(height: 2, color: i <= currentIndex ? LeapColors.signal : LeapColors.line),
            ),
          Column(
            children: [
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i <= currentIndex ? LeapColors.signal : LeapColors.line,
                ),
                child: i < currentIndex
                    ? const Icon(Icons.check, size: 10, color: LeapColors.onSignal)
                    : null,
              ),
              const SizedBox(height: 4),
              Text(
                trStatus(context, _stages[i]),
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: i == currentIndex ? FontWeight.w700 : FontWeight.w500,
                  color: i <= currentIndex ? LeapColors.ink : LeapColors.muted,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
