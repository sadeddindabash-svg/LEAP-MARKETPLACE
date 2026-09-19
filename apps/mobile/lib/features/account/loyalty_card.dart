import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../core/auth_state.dart';
import '../../core/language_state.dart';
import '../../core/app_strings.dart';
import '../../services/api_client.dart';

/// Real loyalty tier card (new) -- confirmed with the person through
/// several rounds of design (Design 1 of 6 real mockups reviewed
/// directly): the buyer's current real tier, a progress bar toward
/// the next real tier, and a tap-through to the full real tier list.
/// Every threshold, discount, name, icon, and color is admin-set
/// server-side (see the Pricing page's Loyalty tiers section) --
/// nothing here is hardcoded.
class LoyaltyCard extends StatefulWidget {
  const LoyaltyCard({super.key});

  @override
  State<LoyaltyCard> createState() => _LoyaltyCardState();
}

class _LoyaltyCardState extends State<LoyaltyCard> {
  Map<String, dynamic>? _status;
  bool _isLoading = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthState>();
    if (auth.token == null) return;
    try {
      final status = await ApiClient().fetchLoyaltyStatus(auth.token!);
      if (mounted) setState(() { _status = status; _isLoading = false; });
    } catch (_) {
      // Real, deliberate no-op: a real buyer's account page shouldn't
      // show an error banner over something this non-critical -- the
      // card simply doesn't render at all if the real status can't
      // be loaded, same as the existing stats bento's own real
      // "only show once genuinely loaded" behavior right above it.
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _status == null || _status!['currentTier'] == null) return const SizedBox.shrink();
    final palette = LeapPalette.of(context);
    final isAr = context.watch<LanguageState>().isArabic;
    final currentTier = _status!['currentTier'] as Map<String, dynamic>;
    final nextTier = _status!['nextTier'] as Map<String, dynamic>?;
    final progressPercent = (_status!['progressPercent'] as num).toDouble() / 100;
    final lifetimeSpend = (_status!['lifetimeSpend'] as num).toDouble();
    final amountToNextTier = _status!['amountToNextTier'] as num?;
    final tierColor = resolveLoyaltyColor(currentTier['color'] as String, palette);
    final tierName = resolveLoyaltyName(currentTier, isAr);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push('/account/loyalty', extra: _status),
          child: Container(
            decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: palette.line)),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(color: tierColor.withValues(alpha: 0.15), shape: BoxShape.circle),
                        child: Icon(resolveLoyaltyIcon(currentTier['icon'] as String), color: tierColor, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('$tierName ${tr(context, 'loyalty_member_suffix')}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink)),
                            const SizedBox(height: 2),
                            Text(
                              (currentTier['discountPercentage'] as num) > 0
                                  ? '${currentTier['discountPercentage']}% ${tr(context, 'loyalty_off_every_order')}'
                                  : tr(context, 'loyalty_keep_spending'),
                              style: TextStyle(fontSize: 12.5, color: palette.muted),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right, size: 18, color: palette.muted),
                    ],
                  ),
                ),
                if (nextTier != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('\$${lifetimeSpend.toStringAsFixed(0)} ${tr(context, 'loyalty_spent')}', style: TextStyle(fontSize: 11.5, color: palette.muted)),
                            Text('\$${amountToNextTier!.toStringAsFixed(0)} ${tr(context, 'loyalty_to_next_tier')} ${resolveLoyaltyName(nextTier, isAr)}', style: TextStyle(fontSize: 11.5, color: palette.muted)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progressPercent.clamp(0, 1),
                            minHeight: 6,
                            backgroundColor: palette.line,
                            valueColor: AlwaysStoppedAnimation(palette.signal),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Confirmed with the person: resolves the admin-set tier name in the
/// current app language -- falls back to the English name if no
/// Arabic name was set, matching the same nameAr-fallback pattern
/// already established elsewhere in the app for admin-set bilingual
/// content (brands, categories, etc.). Public since both this file
/// and loyalty_detail_screen.dart share it.
String resolveLoyaltyName(Map<String, dynamic> tier, bool isAr) {
  if (isAr) {
    final nameAr = tier['nameAr'] as String?;
    if (nameAr != null && nameAr.trim().isNotEmpty) return nameAr;
  }
  return tier['name'] as String;
}

/// Confirmed with the person: maps the admin-set color name (see the
/// Pricing page's Loyalty tiers section) to a real Flutter color --
/// a small, fixed palette rather than a free-form hex field, so
/// every tier always renders using a color that's already been
/// checked to read well in both light and dark mode. Public (not
/// underscore-prefixed) since loyalty_detail_screen.dart shares this
/// exact same real mapping.
Color resolveLoyaltyColor(String name, LeapPalette palette) {
  switch (name) {
    case 'amber':
      return palette.amber;
    case 'blue':
      return palette.torque;
    case 'purple':
      return const Color(0xFF8B5CF6);
    case 'teal':
      return palette.gauge;
    default:
      return palette.muted;
  }
}

IconData resolveLoyaltyIcon(String name) {
  switch (name) {
    case 'award':
      return Icons.workspace_premium_outlined;
    case 'diamond':
      return Icons.diamond_outlined;
    case 'crown':
      return Icons.emoji_events_outlined;
    case 'star':
      return Icons.star_outline;
    default:
      return Icons.military_tech_outlined;
  }
}
