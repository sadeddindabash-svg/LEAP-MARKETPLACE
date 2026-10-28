import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/theme.dart';

/// The Min and Max boxes of the "Sort & price" sheet: the CURRENCY of the app before each amount (SAR, ريال, the dollar ...) instead of a fixed dollar sign, and every colour taken from the app's palette (LeapPalette), so the letters are light on dark
/// fields in dark mode and dark on light fields in light mode (a fixed dark text colour is what made the letters unreadable on the dark sheet). The amounts typed are in [currencyLabel]'s currency: convert them with price_filter.dart.
class PriceRangeFields extends StatelessWidget {
  final TextEditingController minController;
  final TextEditingController maxController;
  final String currencyLabel;
  final String minLabel;
  final String maxLabel;
  final String? note;
  final VoidCallback? onChanged;

  const PriceRangeFields({super.key, required this.minController, required this.maxController, required this.currencyLabel, required this.minLabel, required this.maxLabel, this.note, this.onChanged});

  OutlineInputBorder _border(Color color, [double width = 1]) => OutlineInputBorder(borderRadius: BorderRadius.circular(9), borderSide: BorderSide(color: color, width: width));

  Widget _field(BuildContext context, TextEditingController controller, String label) {
    final palette = LeapPalette.of(context);
    return TextField(
      controller: controller,
      onChanged: (_) => onChanged?.call(),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩۰-۹.,٫٬ ]'))],
      style: TextStyle(color: palette.ink, fontSize: 15),
      cursorColor: palette.signal,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: palette.muted, fontSize: 13),
        floatingLabelStyle: TextStyle(color: palette.muted, fontSize: 13),
        prefixText: '$currencyLabel ',
        prefixStyle: TextStyle(color: palette.muted, fontWeight: FontWeight.w700, fontSize: 13),
        filled: true,
        fillColor: palette.card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: _border(palette.line),
        enabledBorder: _border(palette.line),
        focusedBorder: _border(palette.signal, 1.6),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _field(context, minController, minLabel)),
            const SizedBox(width: 12),
            Expanded(child: _field(context, maxController, maxLabel)),
          ],
        ),
        if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note!, style: TextStyle(color: palette.muted, fontSize: 11.5))),
      ],
    );
  }
}
