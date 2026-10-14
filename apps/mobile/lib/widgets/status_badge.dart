import 'package:flutter/material.dart';
import '../core/app_strings.dart';
import '../core/theme.dart';
import '../models/order.dart';

class StatusBadge extends StatelessWidget {
  final OrderStatus status;
  const StatusBadge({super.key, required this.status});

  ({String labelKey, Color color, Color bg}) get _meta => switch (status) {
        OrderStatus.toPay => (labelKey: 'status_to_pay', color: LeapColors.amber, bg: const Color(0xFFFCEFD8)),
        OrderStatus.toShip => (labelKey: 'status_to_ship', color: LeapColors.torque, bg: const Color(0xFFE9EFFC)),
        OrderStatus.shipped => (labelKey: 'status_shipped', color: LeapColors.torque, bg: const Color(0xFFE9EFFC)),
        OrderStatus.toReview => (labelKey: 'status_to_review', color: LeapColors.amber, bg: const Color(0xFFFCEFD8)),
        OrderStatus.delivered => (labelKey: 'status_delivered', color: LeapColors.gauge, bg: const Color(0xFFE4F5EC)),
        OrderStatus.returns => (labelKey: 'status_returns', color: LeapColors.signal, bg: const Color(0xFFFBE7DE)),
      };

  @override
  Widget build(BuildContext context) {
    final m = _meta;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: m.bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        tr(context, m.labelKey).toUpperCase(),
        style: TextStyle(color: m.color, fontWeight: FontWeight.w700, fontSize: 11, letterSpacing: 0.3),
      ),
    );
  }
}
