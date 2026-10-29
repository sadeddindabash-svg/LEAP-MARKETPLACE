# Arabic mode: the product names in the order details are Arabic

## What was wrong
In Arabic, the order details (website and app) showed every product name in English. The server's order-details answer (`GET /order/:id`) always sent the English name and ignored the language, and neither the website nor the app asked for Arabic. (The receipt and the order confirmation already handled it.) The order LIST has no product names, so it was not affected.

## What changed
* **Server:** `GET /order/:id?lang=ar` gives each item's Arabic product name (the one the admin approved). A product with no Arabic name yet (none, or an empty one) keeps its English name, like the receipt. Without `lang=ar` (English, the admin, any other value) nothing changes.
* **Website:** in Arabic the order page asks with `lang=ar` (and refetches if the language changes). The cancel-a-part and return screens read the same details, so they follow.
* **App:** the order details screen asks with the app's language (read before the request, as the tracking screen does).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_order_names_ar.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-order-names-ar.js
node scripts\patch-order-names-ar.js --write
node scripts\patch-order-names-ar-web.js
node scripts\patch-order-names-ar-web.js --write
node scripts\patch-order-names-ar-app.js
node scripts\patch-order-names-ar-app.js --write
.\scripts\start-all.cmd -NoPhone
```
Restart the backend, reload the website (Ctrl+F5) and rebuild the app (`flutter analyze`, `flutter test`). No migration. Each patch saves what it changes as `<file>.before-order-names-ar...`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me). The website patch also updates two older tests in `app\stage3a-pages.test.tsx` that checked the exact arguments of the order fetch.

## What to look at
Open an order in Arabic (website and app): the product names are Arabic. A product whose Arabic name has not been set (Admin, the product's Arabic name) shows its English name. English is unchanged.

## Notes
* If you see another screen with English product names in Arabic (cart, checkout, returns...), tell me which: I fixed only the order details.
* The app part is source-checked only (I cannot run Flutter here).

## Tests
Server (`services\api`, database name ending `_test`): `node --test test\orderItemNamesAr.test.js` (5). Website: `npx vitest run app/orderNamesAr.test.tsx lib/orderNamesAr.test.ts app/stage3a-pages.test.tsx`. App: `flutter test test\order_names_ar_wiring_test.dart`.
`scripts\break-check-order-vehicles.py nasserver | nasweb | nasapp` break the code on purpose (4 each) and expect the tests to fail.
