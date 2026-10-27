# Mobile app: the website's search bar, and free shipping

**Read this first: I cannot run Flutter, so none of this has been run on a device.** The plain-Dart parts are tested (25 tests, with a stand-in test library, and 14 deliberate breaks are all caught); the screens and widgets were only checked for syntax.
Please run `flutter analyze` and `flutter test` (below) and try it on your phone. If `flutter analyze` prints anything about the new files, send it to me: it will be small.

## 1. The home search bar, like the website's
* A **navy banner** under the home screen's top bar (docked: it stays while the page scrolls), with the website's **white box** and a **gold "Search" button**.
* The **four suggestions** of the website (same words, English and Arabic) slide up one at a time: 3 seconds each, a 0.5 second slide. They are in `lib/models/search_hints.dart`.
* Pressing anywhere on the bar opens the search screen, as the old field did. Arabic is mirrored. With "reduce motion" on in the phone's settings the suggestions do not move (the plain hint is shown).
* The old plain search field in the list and the small **search icon in the top bar** are removed (the new bar makes them redundant).
* The bar uses the website's colours (navy #0B3146, gold #F9B317). If your app's own colours differ, they are two constants at the top of `lib/widgets/home_search_bar.dart`.

## 2. Free shipping (needs the server package `leap_free_shipping.zip` first, and its migration 111)
* **Cart:** the order summary gets a "Shipping fees" line (**+$5** under the limit; the fee struck through and **Free** at or above it) and a note: "Add $30 more for free shipping" with a progress bar, or "You've reached $50: shipping is free". The **TOTAL** at the bottom includes the fee.
  Once shipping is free a green **"Free shipping" icon** sits over the corner of the **Checkout** button (the end corner, so it mirrors in Arabic).
* **Checkout:** the summary shows the fee line and the **Place order** button's amount includes it.
* **Order detail:** under the order total, "Shipping fees: +$5.00" when one was charged.
* **Rule off, or an older server:** nothing is shown and nothing changes.
* How it reads the answer: every cart answer from the server carries `shipping`; `ApiClient` keeps the last one (`lastCartShipping`) and `CartState` reads it right after each cart call. **The `Cart` class is not touched** (it is not in the copy of the app I work from).
* A promo or loyalty discount is applied at checkout as it always was; the server decides the fee on the goods after the discount.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Run it AFTER `patch-home-banner-app.js`.
```
node scripts\patch-free-shipping-app.js
node scripts\patch-free-shipping-app.js --write
cd apps\mobile
flutter analyze
flutter test test\cart_shipping_test.dart test\search_hints_test.dart test\free_shipping_strings_test.dart
flutter run --dart-define=API_BASE_URL=http://YOUR-ADDRESS:PORT
```
* The patch changes 7 files (the strings, the API client, the cart state, the cart, checkout, order detail and home screens), saves each as `<file>.before-free-shipping-app`, says "already" if run twice, and changes NOTHING if a line it needs is missing. Windows line endings are handled.
* New files (plain additions from the zip): `lib/models/cart_shipping.dart`, `lib/models/search_hints.dart`, `lib/widgets/free_shipping.dart`, `lib/widgets/home_search_bar.dart` and the three test files. No new package is needed.
* To see free shipping, switch it on in the admin portal (Settings > Free shipping), for example a limit of 50.00 and a fee of 5.00.

## What to look at on the phone
1. Home: the navy bar under the top bar, the suggestions sliding, a tap opens search. Switch the app to Arabic: it mirrors.
2. Cart with a small basket: "+fee", the note and progress bar, a total with the fee, a plain Checkout. Add parts until you pass the limit: Free, the green note, the icon over Checkout.
3. Checkout and an order placed under the limit: the fee line, the Place order amount, and the fee on the order detail.
4. Pull-to-refresh on the cart and changing a quantity: the fee follows.

## Known limits
* Not run on a device (see the top). The new widgets use the same helpers as the neighbouring screens (`tr`, `formatPrice`, `LeapPalette`), but I could not see those helpers' files.
* The cart bottom bar's TOTAL is the goods plus the fee; a promo/loyalty discount is still applied at checkout, as before.
* The Arabic wording should be read by a native speaker.
