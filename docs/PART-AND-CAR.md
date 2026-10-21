# The part and its car (supplier portal) and "does it fit my car?" (storefront)

## What it does
**Supplier portal.** For each item of an order the supplier sees the **part's main photo, an arrow, and the car the product is listed for** (its photo, name, year, and the engine and
transmission when the fitment names them). If the part is listed for several cars, the first one the supplier added is shown large and the others are named ("Also listed for ...", "+N more").
A part with no fitment list says "Fits any car". The orders list has a "Part -> Car" column with the same pair in small. The supplier is **never** told the buyer's car.

**Storefront (product page and cart).** The buyer's default car in My Garage is compared with the part's fitment list (model AND year):
* it is on the list: the green "Confirmed fit: <your car>";
* it is not: an amber note "This part fits: BAIC BJ60 - 2022 (+2 more). Your car: Toyota Corolla - 2019." (information only: the buyer can still order; English and Arabic);
* no car in My Garage, or the part fits any car: nothing.
The old green badge read an older fit list that is empty for products added through the supplier portal; the new message reads the real fitment list, so both messages come from the same data.

**Unchanged:** how orders are placed. The buyer's car is still recorded on each order line (and copied onto replacement orders) as INTERNAL information; it is never sent to a supplier.
The mobile app is not changed.

## Apply (from D:\LEAP-MARKETPLACE)
1. Unzip, replacing files.
2. Patch the existing files. Run the first script only if you have never applied it (it says "already" where it was done); then the second, as a dry run first:
```
node scripts\patch-order-vehicles.js
node scripts\patch-order-vehicles.js --write
node scripts\patch-product-cars.js
node scripts\patch-product-cars.js --write
```
The second script changes six files (the supplier and catalog routes, the storefront's api.ts, product page and cart page, and the storefront's existing product page test) and refuses, changing nothing,
if a file is not what it expects. Each changed file is first saved as `<file>.before-product-cars`.
3. Migration 110 must already be applied (`npm run migrate` in `services\api`); this change adds no migration.
4. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront **in its own window**:
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
npm run dev -- -p 3001
```

## Check it
1. Supplier portal, Orders: the column is "Part -> Car"; open an order: each item shows the part photo, an arrow and the car. Nothing about the buyer's car appears anywhere.
2. Storefront with a car in My Garage: open a part listed for a different car (amber note), a part listed for your car (green), a part with no fitment (nothing); add one to the cart (the note shows under it).
Products need a **fitment list** (the supplier's "this fits" step) and a photo to show everything; a part with no photo shows an icon.

## Notes
* The supplier sees the product's CURRENT fitment (it is read live): if the supplier changes a product's fitment, open orders show the change.
* Up to 4 cars are sent to the supplier (with the real total); the storefront names up to 3 and matches against every car on the list.
* Tests: server `node --test test/orderVehicles.test.js test/productCars.test.js test/orderVehiclesReplacement.test.js` (in `services\api`, against a database whose name ends in `_test`, migration 110 applied,
  standard seed); supplier portal `npx vitest run src/OrderVehicle.test.jsx src/OrderVehicleFlow.test.jsx`; storefront `npx vitest run components/FitCheck.test.tsx app/cartFitCheck.test.tsx app/stage1c-page.test.tsx`.
* `scripts/break-check-order-vehicles.py server|screens|storefront` breaks the code on purpose, one way at a time, and expects the tests to fail (44 breaks).
