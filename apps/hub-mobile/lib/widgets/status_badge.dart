import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/language_state.dart';
import '../core/hub_strings.dart';
import '../core/theme.dart';

/// Faithful port of apps/hub-portal/src/App.jsx's own Badge component
/// (lines 136-145) -- same real status -> color/background lookup
/// (kStatusColors), same real label lookup via the strings table.
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final t = kHubStrings[context.watch<LanguageState>().language]!;
    final colors = kStatusColors[status] ?? [HubColors.muted, const Color(0xFFEEEFF1)];
    final label = t.steps[status]?.label ?? status;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: colors[1], borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors[0])),
    );
  }
}
