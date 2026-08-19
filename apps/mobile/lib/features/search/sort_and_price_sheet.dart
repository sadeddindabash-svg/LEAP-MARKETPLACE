import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/app_strings.dart';

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

  String labelFor(BuildContext context) {
    final parts = <String>[];
    if (sort == 'price_asc') parts.add('${tr(context, 'price_short_label')} ↑');
    if (sort == 'price_desc') parts.add('${tr(context, 'price_short_label')} ↓');
    if (sort == 'newest') parts.add(tr(context, 'newest_label'));
    if (minPrice != null || maxPrice != null) {
      final min = minPrice != null ? '\$$minPrice' : '\$0';
      final max = maxPrice != null ? '\$$maxPrice' : '+';
      parts.add('$min–$max');
    }
    if (maxDeliveryDays != null) parts.add('${tr(context, 'ships_in_days_label')} ${maxDeliveryDays}d');
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
            Text(tr(context, 'sort_and_price_title'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 16),
            Text(tr(context, 'sort_by_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _SortChip(label: tr(context, 'relevance_label'), selected: _sort == null, onTap: () => setState(() => _sort = null)),
                _SortChip(label: tr(context, 'price_low_to_high'), selected: _sort == 'price_asc', onTap: () => setState(() => _sort = 'price_asc')),
                _SortChip(label: tr(context, 'price_high_to_low'), selected: _sort == 'price_desc', onTap: () => setState(() => _sort = 'price_desc')),
                _SortChip(label: tr(context, 'newest_label'), selected: _sort == 'newest', onTap: () => setState(() => _sort = 'newest')),
              ],
            ),
            const SizedBox(height: 20),
            Text(tr(context, 'price_range_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _minController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: tr(context, 'min_field'), prefixText: '\$'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _maxController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: tr(context, 'max_field'), prefixText: '\$'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Real ships-within-X-days filter (#10)
            Text(tr(context, 'delivery_speed_label'), style: const TextStyle(fontSize: 12.5, color: LeapColors.muted)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _SortChip(label: tr(context, 'delivery_any'), selected: _maxDeliveryDays == null, onTap: () => setState(() => _maxDeliveryDays = null)),
                _SortChip(label: tr(context, 'within_3_days'), selected: _maxDeliveryDays == 3, onTap: () => setState(() => _maxDeliveryDays = 3)),
                _SortChip(label: tr(context, 'within_5_days'), selected: _maxDeliveryDays == 5, onTap: () => setState(() => _maxDeliveryDays = 5)),
                _SortChip(label: tr(context, 'within_7_days'), selected: _maxDeliveryDays == 7, onTap: () => setState(() => _maxDeliveryDays = 7)),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: OutlinedButton(onPressed: _clear, child: Text(tr(context, 'clear_label')))),
                const SizedBox(width: 12),
                Expanded(child: ElevatedButton(onPressed: _apply, child: Text(tr(context, 'apply')))),
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
