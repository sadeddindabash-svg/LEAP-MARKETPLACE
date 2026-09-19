import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'loyalty_card.dart';

/// Real "My Tier" full detail screen (new) -- confirmed with the
/// person: reached by tapping the account page's loyalty card.
/// Receives the already-fetched real status as route `extra` rather
/// than re-fetching it, since the card just loaded it a moment
/// before -- no reason to make the buyer wait twice for the exact
/// same real data.
class LoyaltyDetailScreen extends StatelessWidget {
  final Map<String, dynamic> status;
  const LoyaltyDetailScreen({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final currentTier = status['currentTier'] as Map<String, dynamic>?;
    final allTiers = (status['allTiers'] as List).cast<Map<String, dynamic>>();
    final lifetimeSpend = (status['lifetimeSpend'] as num).toDouble();

    return Scaffold(
      appBar: AppBar(title: const Text('My tier')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (currentTier != null)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: palette.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: palette.line)),
              child: Column(
                children: [
                  Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(color: resolveLoyaltyColor(currentTier['color'] as String, palette).withValues(alpha: 0.15), shape: BoxShape.circle),
                    child: Icon(resolveLoyaltyIcon(currentTier['icon'] as String), color: resolveLoyaltyColor(currentTier['color'] as String, palette), size: 28),
                  ),
                  const SizedBox(height: 10),
                  Text('${currentTier['name']} member', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: palette.ink)),
                  const SizedBox(height: 4),
                  Text(
                    (currentTier['discountPercentage'] as num) > 0 ? '${currentTier['discountPercentage']}% off every order' : 'Spend more to unlock a discount',
                    style: TextStyle(fontSize: 13, color: palette.muted),
                  ),
                  const SizedBox(height: 6),
                  Text('Lifetime spend: \$${lifetimeSpend.toStringAsFixed(2)}', style: TextStyle(fontSize: 12, color: palette.muted)),
                ],
              ),
            ),
          const SizedBox(height: 20),
          Text('ALL TIERS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: palette.signalDark, letterSpacing: 1)),
          const SizedBox(height: 8),
          ...allTiers.map((tier) {
            final isCurrent = currentTier != null && tier['id'] == currentTier['id'];
            final tierColor = resolveLoyaltyColor(tier['color'] as String, palette);
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isCurrent ? tierColor.withValues(alpha: 0.1) : palette.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isCurrent ? tierColor : palette.line),
              ),
              child: Row(
                children: [
                  Icon(resolveLoyaltyIcon(tier['icon'] as String), color: isCurrent ? tierColor : palette.muted, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${tier['name']}${(tier['discountPercentage'] as num) > 0 ? ' — ${tier['discountPercentage']}% off' : ''}',
                          style: TextStyle(fontSize: 14, fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500, color: isCurrent ? tierColor : palette.ink),
                        ),
                        const SizedBox(height: 2),
                        Text('Unlocked at \$${(tier['spendThreshold'] as num).toStringAsFixed(0)}+', style: TextStyle(fontSize: 12, color: palette.muted)),
                      ],
                    ),
                  ),
                  if (isCurrent) Icon(Icons.check_circle, color: tierColor, size: 18),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
