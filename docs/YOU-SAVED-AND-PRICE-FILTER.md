# "You saved" counts free shipping (website and app), and the price filter pieces (app)

## 1. "You saved" counts the shipping fee not paid
**What changed.** The "You saved" line used to count only the discount, and on the website it appeared only when there was one. Now it also counts the **shipping fee the buyer does not pay** when shipping is free (the free-shipping limit is reached, or a free-shipping promo code waives it): the fee that would have been charged below the limit.
* Discount **and** free shipping: **"You saved $13"** with **"Discount $8 · Free shipping $5"** under it (small grey text).
* Free shipping **only**: **"You saved $5"** with **"Free shipping"** under it (the line now appears without a discount).
* A fee is charged (under the limit), the rule is off, or nothing saved: as before (no new line).
* Arabic is mirrored: وفّرت 13 دولار / الخصم 8 دولار · الشحن المجاني 5 دولار.
* **Website:** the cart page's order summary. **App:** the checkout summary card (the same green row, with the split under its label).

**Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first).** Unzip the package over the project (replacing files), then:
```
node scripts\patch-you-saved.js
node scripts\patch-you-saved.js --write
node scripts\patch-you-saved-app.js
node scripts\patch-you-saved-app.js --write
```
* `patch-you-saved.js` (website: `lib\cart.ts`, `app\cart\page.tsx`, `lib\i18n.ts`): run it after `patch-ui-round4.js` and the free shipping patches. Reload the website with Ctrl+F5.
* `patch-you-saved-app.js` (app: `core\cart_state.dart`, `features\checkout\checkout_screen.dart`, `core\app_strings.dart`): run it after `patch-free-shipping-app.js`. Then in `apps\mobile`: `flutter analyze`, `flutter test test\shipping_saved_test.dart test\shipping_saved_wiring_test.dart`, and run the app. (The zip also updates `lib\models\cart_shipping.dart`.)
* Each patch saves what it changes as `<file>.before-you-saved` / `.before-you-saved-app`, says "already" if run twice, and changes NOTHING if a line it needs is missing. No server change, no migration.
* The zip replaces the existing test file `app\cartShipping.test.tsx` (it now also tests this).

**What to look at.** Switch free shipping on (admin Settings > Free shipping, for example limit 50 and fee 5), then: a small cart (a fee, no line); a cart over the limit (You saved $5 / Free shipping); the same with a promo code that gives a discount (You saved $13 and the split); a small cart with a free-shipping promo code (You saved $5).

## 2. The "Sort & price" price boxes: what is ready, and what I still need
Your sort and price sheet is in the **app**, and its code is not in the copy of the app I work from, so I could not change it yet. What IS built and tested:
* `lib/models/price_filter.dart` (plain Dart, 17 tests with the widget's): turns what the buyer types **in the app's currency** into **US dollars** for the search (the server filters in dollars) and back; reads Arabic digits, thousands separators and the Arabic decimal mark; the lower limit is rounded down and the upper one up to the cent so a part priced exactly at a limit is never left out; a Min above the Max are swapped; a missing rate counts as dollars.
* `lib/widgets/price_range_fields.dart`: the Min and Max boxes with the **currency of the app before each amount** (SAR, ريال ... instead of a fixed $) and **every colour taken from the app's palette** (no fixed colour at all: a test checks it), so letters are light on dark fields in dark mode and dark on light fields in light mode.
* `scripts/find-sort-price-sheet.js`: finds the sheet in your project and writes `sheet-report.txt` (it only reads files).

**To finish it, please run (from `D:\LEAP-MARKETPLACE`) and send me the file it writes:**
```
node scripts\find-sort-price-sheet.js
```
It writes `sheet-report.txt`: the sheet's lines about prices and colours, the app's theme file (light and dark colours) and its currency file. With it I put the new boxes into the real sheet, convert the typed amounts before the search, and fix the dark colours, and I show you the result first. A screenshot of the sheet in light and in dark mode helps too.

## Notes
* The app parts have not been run on a device (I cannot run Flutter here): they have plain-Dart and source checks.
* The Arabic wording should be read by a native speaker.

## Tests
Website: `npx vitest run lib/cartSaved.test.ts app/cartShipping.test.tsx lib/i18n.test.ts`. App: the four new test files in `apps\mobile\test`. Scripts: `node scripts\test-find-sort-price-sheet.js`.
`scripts/break-check-order-vehicles.py ysweb | ysapp | pfapp` break the code on purpose (12, 10 and 15 ways) and expect the tests to fail.
