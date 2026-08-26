import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../models/product.dart';

/// Real side-by-side product comparison (#101) -- 2 to 4 real
/// products, real specs aligned in real columns. Every row uses a
/// real field already on the Product model; a row is only shown when
/// at least one selected product actually has that real data,
/// avoiding a fabricated placeholder for specs that simply don't
/// exist on any of the compared items.
class ProductComparisonScreen extends StatelessWidget {
  final List<Product> products;
  const ProductComparisonScreen({super.key, required this.products});

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = Localizations.localeOf(context).languageCode == 'ar';

    final rows = <(String, String Function(Product))>[
      (isAr ? 'السعر' : 'Price', (p) => '\$${p.price.toStringAsFixed(2)}'),
      (isAr ? 'التقييم' : 'Rating', (p) => p.reviewCount > 0 ? '${p.rating.toStringAsFixed(1)} (${p.reviewCount})' : (isAr ? 'لا يوجد' : 'No reviews yet')),
      (isAr ? 'المخزون' : 'Stock', (p) => p.stockQuantity > 0 ? (isAr ? '${p.stockQuantity} متوفر' : '${p.stockQuantity} in stock') : (isAr ? 'غير متوفر' : 'Out of stock')),
      (isAr ? 'التسليم' : 'Delivery', (p) => p.deliveryDateLabel(isAr)),
      (isAr ? 'رقم OEM' : 'OEM number', (p) => p.oemNumber ?? ''),
      (isAr ? 'الوزن' : 'Weight', (p) => p.weightKg != null ? '${p.weightKg!.toStringAsFixed(1)} ${isAr ? "كغم" : "kg"}' : ''),
      (isAr ? 'بائع موثّق' : 'Verified seller', (p) => p.isVerifiedSeller ? (isAr ? 'نعم' : 'Yes') : ''),
      (isAr ? 'الشحن من' : 'Ships from', (p) => (isAr ? (p.shipsFromCountryAr?.isNotEmpty == true ? p.shipsFromCountryAr : p.shipsFromCountry) : p.shipsFromCountry) ?? ''),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(isAr ? 'مقارنة المنتجات' : 'Compare products')),
      body: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SingleChildScrollView(
          child: Table(
            defaultColumnWidth: const FixedColumnWidth(140),
            border: TableBorder.symmetric(inside: BorderSide(color: palette.line)),
            children: [
              TableRow(
                children: [
                  const SizedBox(width: 110),
                  for (final p in products)
                    Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        children: [
                          Text(p.name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: palette.ink), maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
                          const SizedBox(height: 6),
                          TextButton(onPressed: () => context.push('/product/${p.id}'), child: Text(isAr ? 'عرض' : 'View', style: const TextStyle(fontSize: 11.5))),
                        ],
                      ),
                    ),
                ],
              ),
              // Real, deliberate omission: a row only appears when at
              // least one real selected product actually has that
              // real data -- never a fabricated blank row for a spec
              // that simply doesn't exist on any of these real items.
              for (final row in rows)
                if (products.any((p) => row.$2(p).isNotEmpty))
                  TableRow(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(10),
                        child: Text(row.$1, style: TextStyle(fontSize: 12, color: palette.muted, fontWeight: FontWeight.w600)),
                      ),
                      for (final p in products)
                        Padding(
                          padding: const EdgeInsets.all(10),
                          child: Text(row.$2(p), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: palette.ink)),
                        ),
                    ],
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
