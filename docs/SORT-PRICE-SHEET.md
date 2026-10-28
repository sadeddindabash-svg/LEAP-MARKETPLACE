# App: the "Sort & price" sheet shows your currency and is readable in dark mode

## What was wrong (found in your sheet's code)
* The **`$`** was typed straight into both price boxes (`prefixText: '\$'`) and into the summary chip ("$100-max"), so the currency never followed the app's currency.
* The search filters in **US dollars**, so a riyal amount typed in the box was being sent as if it were dollars.
* **Dark mode:** the section labels (Sort by, Price range, Delivery speed) and the sort chips used the **light-mode** colours (`LeapColors.muted` / `LeapColors.ink`, dark grey) instead of the palette that follows the mode, so their letters were dark on the dark sheet.

## What changes (one file: `features\search\sort_and_price_sheet.dart`)
1. The Min and Max boxes show the **currency of the app** before the amount (SAR, ر.س, the dollar sign ...), and the **Price range** label says it: "Price range (SAR)".
2. What the buyer types is in that currency and is **converted to US dollars for the search** (the lower limit rounded down and the upper one up to the cent, so a part priced exactly at a limit is never left out; a Min above the Max are swapped; a missing rate counts as dollars).
3. A filter that was saved (in dollars) is **shown back in the app's currency**, in whole units.
4. The **summary chip** ("100-500") writes its prices in the app's currency.
5. **Dark mode:** the three section labels and the chips take their colours from the palette (`LeapPalette.of(context)`), so the letters are light on the dark sheet and dark on the light one. Every `LeapColors.` constant is gone from this file.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_sort_price_sheet.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-sort-price-sheet.js
node scripts\patch-sort-price-sheet.js --write
cd apps\mobile
flutter analyze
flutter test
```
* The zip adds two files the patch needs (`lib\models\price_filter.dart`, which replaces the earlier one, and `lib\widgets\currency_label.dart`) and the tests. **Unzip before running the patch.**
* The patch saves the sheet as `sort_and_price_sheet.dart.before-sort-price-sheet`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it then names the file).
* Then run the app and open Sort & price in **light mode and in dark mode** (the app's Account screen has the theme switch), and with the app currency set to a riyal (or dirham) and to dollars.

## What to look at
1. Price range label and boxes: "SAR" (or ر.س in Arabic) before the amounts.
2. Type 100 and 500 in riyals, Apply: the products shown are those priced between 100 and 500 riyals; open the sheet again: it still says 100 and 500.
3. The summary chip on the search screen: the same currency.
4. Dark mode: the labels and chips are easy to read.

## Notes
* I could not run Flutter, so this is checked as source tests and a test of the conversion rules on plain numbers (28 tests, 17 deliberate breaks all caught).
* The earlier `lib\widgets\price_range_fields.dart` from the previous package is not used by this patch (the sheet keeps its own boxes); it can stay or be deleted.
* The boxes still read numbers the way they did before (Western digits). If you want Arabic digits accepted in the boxes too, tell me.
