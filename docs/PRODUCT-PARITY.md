# Storefront product page, like the mobile app

## What the product page now shows (computer screens; a phone shows the same in one column)
In the column beside the photos, top to bottom: **title and chips**, then
1. **The stock box** (green): **"In stock · Delivery: Oct. 29"**. When **5 or fewer** are left it is warm-coloured and says the number: **"Only 3 left · Delivery: Oct. 29"** (above 5 it only says "In stock", exactly like the app). With none: **"Currently out of stock"**, grey, no date.
2. **"Verified seller"** and **"Ships from China Warehouse"** (the country only, never the supplier's name; in Arabic the Arabic country name when the server has one).
3. **The price**, and when a discount applies: the **old price struck through** and a **"-29% off"** tag (amber under 15%, orange from 15%, red from 30%).
4. The buttons: quantity, **"Add to cart · $total"** (the total follows the quantity), and the quantity **stops at the stock** (the + switches off).

Under the photos, the **"Technical Specifications"** card (was "Product details"): Brand, Model, Year, Part number, **the part's own attributes** (material, colour...), Dimensions, Weight and the **Description**. **Every row is always shown**; one the part does not have says **"Not specified"**, as in the app.
The description and the "OEM number" line are no longer repeated in the column (they are in the card; the column is shorter, which suits the pinned column).

## The delivery DATE everywhere it said "N days"
Product page, product cards (home, lists), the compare page and the other-listings table now say the date (**"Delivery: Oct. 29"**, Arabic **"التسليم: 29 أكتوبر"**) instead of "Delivery in 7 days". The date is **today plus the server's estimated days**, counted on **Saudi time** (Asia/Riyadh), so it is the same for everyone.
The text that only search engines read keeps "N days" (a date written there would be wrong as soon as the page is cached or crawled).

## Please check against the mobile app (two of its files are not in my copy)
* **The date format:** I could not read the app's `deliveryDateLabel`. I used "Oct. 29" (month abbreviation with a full stop, except May) and, in Arabic, "29 أكتوبر". Open the same part in the app and on the site and compare; if the app adds days differently (for example skipping weekends) or writes the month differently, tell me or send me that function (find it with `Select-String -Path D:\LEAP-MARKETPLACE\apps\mobile\lib -Pattern "deliveryDateLabel" -Recurse`).
* **The discount tag colours:** I could not read `discount_display.dart`; the three tiers are mine. Send the file if you want the same colours.
* A page that is kept for a minute or so by the storefront can show yesterday's date for a moment after midnight (Saudi time).

## Not done, on purpose
* **The green "Confirmed fit" badge on the photo.** You asked earlier to remove the fit note from the product page, and I did not bring it back. Tell me if you want it as a badge only.
* **The "Alternatives" row.** The app has it; the storefront has your "same model" row instead. Unchanged.
* Discounts are not shown on the product cards (only on the product page).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-product-page.js` (and preferably after `patch-search-sticky.js`):
```
node scripts\patch-product-parity.js
node scripts\patch-product-parity.js --write
```
It changes eight existing files of the storefront (the specifications card and the Add to cart button are replaced as a whole; the product page, the product card, the compare page, the other-listings table, the API types and the wording are edited), saves each as `<file>.before-product-parity`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
3. **Optional, afterwards:** three older test files still expect "Delivery in 7 days". This second patch updates them (separately, so a difference there can never stop the feature):
```
node scripts\patch-product-parity-tests.js
node scripts\patch-product-parity-tests.js --write
```
**No migration, nothing to install, no backend change.** The storefront reloads by itself (or restart it with the commands in `docs\FONT-FIX.md`).

## Notes
* Tests: `npx vitest run lib/delivery.test.ts lib/discount.test.ts lib/seoDelivery.test.ts components/StockBanner.test.tsx components/SellerSignals.test.tsx components/PriceBlock.test.tsx components/ProductDetails.test.tsx components/AddToCartButton.test.tsx components/ProductCardDelivery.test.tsx app/productParity.test.tsx` (in `apps\web-storefront`).
  `scripts/break-check-order-vehicles.py bpstorefront|bpslow` breaks the code on purpose (29 ways) and expects the tests to fail.
