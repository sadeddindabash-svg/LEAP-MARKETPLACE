import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// What the user picked. `sort` is one of 'price_asc'/'price_desc'/
/// 'newest', or null for the default (no explicit ordering). `minPrice`/
/// `maxPrice` are both optional and independent of `sort` -- a buyer can
/// set a price range without picking a sort, or vice versa.
class SortAndPriceSelection {
  final String? sort;
  final num? minPrice;
  final num? maxPrice;
  // Real ships-within-X-days filter (#10) -- estimatedDeliveryDays is
  // already a real, stored field on every real product.
  final int? maxDeliveryDays;
  const SortAndPriceSelection({this.sort, this.minPrice, this.maxPrice, this.maxDeliveryDays});

  bool get isEmpty => sort == null && minPrice == null && maxPrice == null && maxDeliveryDays == null;

  String get label {
    final parts = <String>[];
    if (sort == 'price_asc') parts.add('Price ↑');
    if (sort == 'price_desc') parts.add('Price ↓');
    if (sort == 'newest') parts.add('Newest');
    if (minPrice != null || maxPrice != null) {
      final min = minPrice != null ? '\$$minPrice' : '\$0';
      final max = maxPrice != null ? '\$$maxPrice' : '+';
      parts.add('$min–$max');
    }
    if (maxDeliveryDays != null) parts.add('Ships in ${maxDeliveryDays}d');
    return parts.join(' · ');
  }
}

/// Real sort + price range filter for search (new) -- deliberately
/// applied in application code on the backend, not a SQL ORDER BY/WHERE:
/// buyer-facing price is computed post-query via the pricing engine
/// (currency conversion + fees), not a raw column -- see
/// services/api/src/modules/catalog/routes.js's GET /products for the
/// full reasoning. This sheet is a plain form, not a drill-down cascade
/// like vehicle_filter_sheet.dart -- there's nothing hierarchical here.
class SortAndPriceSheet extends StatefulWidget {
  final SortAndPriceSelection? initial;
  const SortAndPriceSheet({super.key, this.initial});

  @override
  State<SortAndPriceSheet> createState() => _SortAndPriceSheetState();
}

class _SortAndPriceSheetState extends State<SortAndPriceSheet> {
  String? _sort;
  final _minController = TextEditingController();
  final _maxController = TextEditingController();
  int? _maxDeliveryDays;

  @override
  void initState() {
    super.initState();
    _sort = widget.initial?.sort;
    if (widget.initial?.minPrice != null) _minController.text = '${widget.initial!.minPrice}';
    if (widget.initial?.maxPrice != null) _maxController.text = '${widget.initial!.maxPrice}';
    _maxDeliveryDays = widget.initial?.maxDeliveryDays;
  }

  @override
  void dispose() {
    _minController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  void _apply() {
    final min = num.tryParse(_minController.text.trim());
    final max = num.tryParse(_maxController.text.trim());
    Navigator.of(context).pop(SortAndPriceSelection(sort: _sort, minPrice: min, maxPrice: max, maxDeliveryDays: _maxDeliveryDays));
  }

  void _clear() {
    Navigator.of(context).pop(const SortAndPriceSelection());
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Sort & price', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 16),
            const Text('Sort by', style: TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _SortChip(label: 'Relevance', selected: _sort == null, onTap: () => setState(() => _sort = null)),
                _SortChip(label: 'Price: Low to High', selected: _sort == 'price_asc', onTap: () => setState(() => _sort = 'price_asc')),
                _SortChip(label: 'Price: High to Low', selected: _sort == 'price_desc', onTap: () => setState(() => _sort = 'price_desc')),
                _SortChip(label: 'Newest', selected: _sort == 'newest', onTap: () => setState(() => _sort = 'newest')),
              ],
            ),
            const SizedBox(height: 20),
            const Text('Price range', style: TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _minController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Min', prefixText: '\$'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _maxController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Max', prefixText: '\$'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Real ships-within-X-days filter (#10)
            const Text('Delivery speed', style: TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _SortChip(label: 'Any', selected: _maxDeliveryDays == null, onTap: () => setState(() => _maxDeliveryDays = null)),
                _SortChip(label: 'Within 3 days', selected: _maxDeliveryDays == 3, onTap: () => setState(() => _maxDeliveryDays = 3)),
                _SortChip(label: 'Within 5 days', selected: _maxDeliveryDays == 5, onTap: () => setState(() => _maxDeliveryDays = 5)),
                _SortChip(label: 'Within 7 days', selected: _maxDeliveryDays == 7, onTap: () => setState(() => _maxDeliveryDays = 7)),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: OutlinedButton(onPressed: _clear, child: const Text('Clear'))),
                const SizedBox(width: 12),
                Expanded(child: ElevatedButton(onPressed: _apply, child: const Text('Apply'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SortChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SortChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 12.5)),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: LeapColors.signal.withValues(alpha: 0.15),
      labelStyle: TextStyle(color: selected ? LeapColors.signal : LeapColors.ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
    );
  }
}
