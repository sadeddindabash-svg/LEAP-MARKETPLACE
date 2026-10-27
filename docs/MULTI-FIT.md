# A part that fits many vehicles (server, website, admin portal)

## The problem
The server sent only the FIRST fitment entry of a part, so the Technical Specifications card showed one brand, one model and one year ("BYD, Seal, 2022 · +10 more cars") for a part that fits many vehicles.

## What changed
* **Server:** the product page now also gets **every model the part fits with its years as ranges** (`fitGroups`: "BYD Seal 2022–2024", "BYD Dolphin 2023", ...), how many models (`fitGroupCount`) and how many different vehicles (`fitVehicleCount`; the same car with two engines is one vehicle). Years that follow each other become one range. Up to 60 models are sent; the real count is kept.
  If the fitment cannot be read, the groups are LEFT OUT (an error never looks like "fits every vehicle"). The admin's product detail also names the brand and model of each fitment row. **No migration.**
* **Website, Technical Specifications card:** the Brand / Model / Year rows are replaced by ONE **"Fits"** row: each model with its years, three lines to start with, then "+2 more models · 11 vehicles in all", which opens the whole list ("Show fewer" closes it). Arabic mirrors and uses the Arabic names.
* **Website, the chip at the top of the product page:** "FITS BYD Seal 2022–2024 +4 more models".
* **A part with no fitment at all** says **"Universal: fits all vehicles"** (and the chip says "Fits all vehicles"): your supplier view already treats a part with no fitment as fitting any car.
* **An older server (or fitment that could not be read):** the page keeps the old Brand / Model / Year rows and chip exactly as before.
* **Admin portal, Vehicle fitment card:** a summary at the top: "Summary: 11 vehicles · 5 models" and one line per model with its years; with no fitment it says buyers see the part as universal. A vehicle added with the card's form joins its model's line at once.
* **The mobile app's product screen is NOT changed** (it is not in the copy I work from). If you send a screenshot of it I can do the same there.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip, replacing files. Run it AFTER the other storefront patches (product-cars, product-page, product-parity, product-description):
```
node scripts\patch-multi-fit.js
node scripts\patch-multi-fit.js --write
```
It changes 7 files (server: `orderVehicles\productCars.js`, `catalog\routes.js`; website: `lib\api.ts`, `lib\i18n.ts`, `components\ProductDetails.tsx`, `app\products\[id]\page.tsx`; admin: `src\App.jsx`), saves each as `<file>.before-multi-fit`, says "already" if run twice, and changes NOTHING if a line it needs is missing.
**Restart the backend** (the server part), then the storefront reloads by itself. A product page is kept for up to a minute, so a change shows within about a minute.

## What to look at
1. A product that fits several vehicles: the card has one **Fits** row, the link opens the full list, and the chip at the top matches.
2. A product with no fitment: "Universal: fits all vehicles".
3. Admin portal > Products > open a part > **Vehicle fitment**: the summary on top; add a vehicle with the form and watch the summary follow.
4. Switch the website to Arabic and look at a phone.

## Tests
Server: `node --test --test-concurrency=1 test/productFitGroups.test.js` (in `services\api`). Website: `npx vitest run lib/fitGroups.test.ts components/FitsRow.test.tsx components/ProductDetailsFits.test.tsx app/productFits.test.tsx`. Admin: `npx vitest run src/fitmentSummary.test.js src/FitmentSummary.test.jsx`.
`scripts/break-check-order-vehicles.py mfserver | mfweb | mfadmin` break the code on purpose (10, 16 and 6 ways).
The Arabic wording (تناسب, عامة: تناسب جميع المركبات, +N موديلات أخرى, ...) should be read by a native speaker.
