import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import '../core/currency_state.dart';
import '../models/price_filter.dart';

/// The currency the app shows prices in, as it is written before an amount (SAR, ر.س, the dollar sign ...), taken from the app's own price writing so it follows the language and the currency chosen. Use it inside build (it listens to the currency).
String currencyLabelOf(BuildContext context) {
  final currency = context.watch<CurrencyState>();
  final sample = formatAmount(context, 0, currency.hasConversion ? currency.currencyCode : 'USD');
  return currencyLabelFromFormatted(sample);
}
