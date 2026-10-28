/// The price range filter of the search ("Sort & price"): the buyer TYPES amounts in the currency the app shows prices in (riyals, dirhams ...), but the server filters in US dollars, so the amounts must be converted both ways.
/// Plain Dart (no Flutter), so it is tested without a device.
///   ratePerUsd = how many units of the display currency one US dollar is worth (SAR 3.75, USD 1). A rate that is missing or not a sensible number counts as 1 (dollars).

double _rate(double ratePerUsd) => ratePerUsd.isFinite && ratePerUsd > 0 ? ratePerUsd : 1;

/// What the buyer typed as a number: spaces and thousands separators (, and the Arabic one) are ignored, Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩ and ۰۱۲۳۴۵۶۷۸۹) and the Arabic decimal mark (٫) are understood.
/// null for nothing, for text that is not a number, and for a negative or infinite amount.
double? parsePriceInput(String text) {
  var s = text.trim();
  if (s.isEmpty) return null;
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  final b = StringBuffer();
  for (final ch in s.split('')) {
    final a = arabic.indexOf(ch);
    final p = persian.indexOf(ch);
    if (a >= 0) {
      b.write(a);
    } else if (p >= 0) {
      b.write(p);
    } else if (ch == '٫') {
      b.write('.');
    } else if (ch == ',' || ch == '٬' || ch == ' ' || ch == '\u00A0') {
      // a thousands separator or a space: ignored
    } else {
      b.write(ch);
    }
  }
  s = b.toString();
  if (!RegExp(r'^\d+(\.\d+)?$').hasMatch(s)) return null;
  final v = double.tryParse(s);
  return v != null && v.isFinite ? v : null;
}

/// An amount in the display currency as US dollars (what the server filters on); null stays null.
double? usdFromDisplay(double? amount, double ratePerUsd) => amount == null ? null : amount / _rate(ratePerUsd);

/// US dollars (what the server and a saved filter hold) as an amount in the display currency; null stays null.
double? displayFromUsd(num? usd, double ratePerUsd) => usd == null ? null : usd.toDouble() * _rate(ratePerUsd);

/// An amount for a price box: whole units like the prices in the app ("100", not "100.0" or "99.99999").
String formatPriceInput(double? value) => value == null ? '' : value.round().toString();

class PriceRangeUsd {
  final double? minUsd;
  final double? maxUsd;
  const PriceRangeUsd(this.minUsd, this.maxUsd);
}

/// The range the buyer typed, as US dollars for the search. Empty or invalid boxes mean "no limit" on that side; a Min above the Max are swapped. The lower limit is rounded DOWN and the upper one UP to the cent,
/// so a part priced exactly at the typed limit is never left out by the conversion.
PriceRangeUsd priceRangeToUsd({required String minText, required String maxText, required double ratePerUsd}) {
  var min = usdFromDisplay(parsePriceInput(minText), ratePerUsd);
  var max = usdFromDisplay(parsePriceInput(maxText), ratePerUsd);
  if (min != null && max != null && min > max) {
    final t = min;
    min = max;
    max = t;
  }
  return PriceRangeUsd(min == null ? null : (min * 100).floor() / 100, max == null ? null : (max * 100).ceil() / 100);
}
