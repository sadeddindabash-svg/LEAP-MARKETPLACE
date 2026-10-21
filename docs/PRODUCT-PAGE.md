# Product page, vehicle filter and home page texts

## What changed
**Products page ("My vehicle" and the switch)**
* The switch is now **"Parts Fit with my Car"** (Arabic: قطع تناسب مركبتي).
* "My vehicle" now goes **Brand -> Model -> Year -> Generation** (the same order as My Garage). The years offered are every year the model has; a year that only one generation covers is applied at once, a year that two or
  more cover asks which generation. There is no "any year" choice any more.

**Product page**
* The "This part fits ... Your car ..." note is gone from the product page (it stays in the cart).
* A **Product details** card sits under the photos: Brand, Model, Year (with "+N more car(s)"), Part number, Dimensions and Weight. A size that comes from the part (not entered by the supplier for this product) is
  marked "(approx.)". A row the part does not have is not shown.
* The sections now come in this order: details (under the photos), other listings of the same part number, reviews (with customer photos), **More parts for the same model**, **More parts of the same brand**, **Newest products**.
  The old "Similar products" row is gone (the model row replaces it).
* **Lazy loading:** each of the three rows is only asked for when you scroll close to it (the page opens faster). The model and brand rows show 8 parts and load up to 2 more batches (24 in all), so they never block
  the rows below; "Newest products" keeps loading as you scroll until every part has been shown, and never shows the part you are looking at. A row with nothing to show leaves no heading.

**Home page texts, editable in the admin portal (Settings -> "Home page text")**
* The top bar message ("Largest ready-to-ship warehouse ..."), the headline ("Find the right part for your car") and the sub-headline ("Real parts from verified suppliers ..."), each in English and Arabic.
* The headline and the sub-headline also have a **font** (website default, Inter, Poppins, Montserrat, Cairo, Tajawal) and a **size** (Small, Medium, Large, Extra large; they shrink by themselves on a phone).
* An empty text means the website uses its own wording; "Reset to default" clears a block. Changes show on the website within about a minute. What you type is shown as plain text.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-home-pictures.js`:
```
node scripts\patch-product-page.js
node scripts\patch-product-page.js --write
```
It changes 14 existing files (server, storefront, admin portal and some of their tests), saves each as `<file>.before-product-page`, says "already" if run twice, and if ANY file is not what it expects it changes
NOTHING (send that file to the Leap team). **No migration** (the texts use the existing platform settings table).
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront in its own window:
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
rmdir /s /q .next
npm run dev -- -p 3001
```
(clearing `.next` after a patch avoids the stale-cache 404 you saw before).

## Check it
* Admin portal -> Settings -> "Home page text": change the headline, pick a font and a size, Save. After about a minute the home page (and /ar) shows it. "Reset to default" and Save brings the old wording back.
* Open a part's page: the details card under the photos, no fit note, and scroll: the three rows appear one by one.
* Products page: pick a brand, a model, then a YEAR, then (if asked) a generation.

## Notes
* The six fonts are downloaded by the website only when a page uses one (nothing extra is loaded for the others). They come from Google Fonts like the website's own fonts; I could not check how each looks (my copy
  has no internet), only that the font is applied.
* "Parts Fit with my Car": your cart still shows "This part fits ... Your car ..." (as you asked, only the product page lost it).
* Tests: server `node --test test/homeText.test.js test/productPage.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/HomeTextSection.test.jsx`; storefront
  `npx vitest run components/ProductDetails.test.tsx components/LazyProductRow.test.tsx components/VehicleFilterOrder.test.tsx components/FitsMyCarLabel.test.tsx components/SiteHeaderTopBar.test.tsx app/stage1c-page.test.tsx app/homeText.test.tsx lib/homeText.test.ts lib/gridSourceModel.test.ts app/api/products/routeSameModel.test.ts`.
  `scripts/break-check-order-vehicles.py ppserver|ppadmin|ppstorefront` breaks the code on purpose (52 ways) and expects the tests to fail.
