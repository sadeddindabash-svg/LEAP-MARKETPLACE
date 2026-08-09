import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../models/product.dart';
import '../services/api_client.dart';

/// Real multi-supplier price comparison for the identical real OEM
/// part number (#78) -- shows real, exact-match listings from
/// different real suppliers, letting a buyer compare real prices for
/// the exact same part. Deliberately anonymous, matching this
/// platform's own supplier-anonymization design: shows a "Verified
/// seller" badge and "Ships from" country when available, never a
/// supplier's own name or identity. Mirrors AlternativesSection's own
/// real self-fetching widget pattern.
class OemComparisonSection extends StatefulWidget {
  final String productId;
  final bool isAr;
  const OemComparisonSection({super.key, required this.productId, required this.isAr});

  @override
  State<OemComparisonSection> createState() => _OemComparisonSectionState();
}

class _OemComparisonSectionState extends State<OemComparisonSection> {
  Future<List<Product>>? _future;
  String? _loadedForProductId;

  @override
  Widget build(BuildContext context) {
    if (_loadedForProductId != widget.productId) {
      _loadedForProductId = widget.productId;
      _future = ApiClient().fetchOemAlternatives(widget.productId);
    }
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snapshot) {
        final matches = snapshot.data ?? [];
        // Real, deliberate empty-state handling: never shows a
        // section header with nothing real underneath it.
        if (snapshot.connectionState != ConnectionState.done || matches.isEmpty) {
          return const SizedBox.shrink();
        }
        final palette = LeapPalette.of(context);
        return Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.isAr ? 'نفس القطعة من موردين آخرين' : 'Same part, other listings',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: palette.ink),
              ),
              const SizedBox(height: 4),
              Text(
                widget.isAr ? 'رقم القطعة الأصلي مطابق تمامًا' : 'Identical OEM part number',
                style: TextStyle(fontSize: 11.5, color: palette.muted),
              ),
              const SizedBox(height: 10),
              ...matches.map((m) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      onTap: () => context.push('/product/${m.id}'),
                      title: Text('\$${m.price.toStringAsFixed(2)}', style: TextStyle(fontWeight: FontWeight.w800, color: palette.ink, fontSize: 15)),
                      subtitle: Wrap(
                        spacing: 10,
                        children: [
                          if (m.isVerifiedSeller)
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.verified, size: 13, color: palette.signal),
                              const SizedBox(width: 3),
                              Text(widget.isAr ? 'بائع موثّق' : 'Verified seller', style: TextStyle(fontSize: 11, color: palette.muted)),
                            ]),
                          if (m.shipsFromCountry != null)
                            Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.public, size: 13, color: palette.muted),
                              const SizedBox(width: 3),
                              Text(widget.isAr ? 'من ${m.shipsFromCountry}' : 'From ${m.shipsFromCountry}', style: TextStyle(fontSize: 11, color: palette.muted)),
                            ]),
                        ],
                      ),
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  )),
            ],
          ),
        );
      },
    );
  }
}
