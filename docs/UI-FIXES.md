# Storefront and supplier portal screen fixes

## What changed
**Supplier portal.** The part photo and the car photo on the Orders page (list and order detail) are SQUARE.

**Storefront**
* **Home page:** four real totals with a picture tile each (Parts, Brands, Models, Countries; counted by the server, "countries" = the markets we deliver to); "Shop by section" and "Shop by brand" show ONE row
  ending in a "More sections" / "More brands" tile that opens the whole list in place (and then says "Show fewer"); each brand tile has its photo and name; "Newest parts" has no "See all parts" link:
  more parts load by themselves as you scroll, eight at a time, until all are shown.
* **Products page (/search):** the left column (sections list) is gone; the vehicle (the "fits my car" switch and the filter) is a strip above the results; four columns of parts on a wide screen
  (three on a tablet, two on a phone); when a section is chosen a "Section: Brakes x" chip appears and clears it (keeping the search words and the vehicle).
* **Sections menu:** each section with its photo beside the name, in two columns.
* **Find a part:** the sections and then the parts are rows with a square photo beside the name (a plain tile where there is no photo yet).
* **Garage:** "Your cars - 2 of 5" moved beside the page title; the car cards and the "Add a car" box start at the same top edge.

## Apply (from D:\LEAP-MARKETPLACE)
1. Unzip, replacing files.
2. Patch the existing files (dry run first). Run it AFTER `scripts\patch-product-cars.js`:
```
node scripts\patch-ui-fixes.js
node scripts\patch-ui-fixes.js --write
```
It changes ten existing files, saves each as `<file>.before-ui-fixes`, and says "already" if run twice. If ANY file is not exactly what it expects (for example you changed it yourself) it refuses and
changes NOTHING; send that file to the Leap team. No migration is needed.
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront in its own window:
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
npm run dev -- -p 3001
```

## Check it
* Home page: the four totals; one row of sections then "More sections" (click it, then "Show fewer"); same for brands; scroll to the bottom: more newest parts appear by themselves.
* Products page: no left column, four columns, the vehicle strip on top; choose a section from the menu and see the chip.
* Sections menu, Find a part, My garage: as described above. Supplier portal, Orders: square photos.

## Notes
* The four totals' picture tiles are plain icons for now (a photo can be added later). If the server cannot give the totals, the row is left out.
* "Parts" counts active products. Sections and brands that have no photo yet show a plain tile.
* Tests: server `node --test test/siteStats.test.js` (in `services\api`, against a database whose name ends in `_test`); storefront `npx vitest run components/TileRow.test.tsx app/pages-i18n.test.tsx app/searchLayout.test.tsx app/homeLazy.test.tsx`;
  supplier portal `npx vitest run src/OrderVehicle.test.jsx`. `scripts/break-check-order-vehicles.py uistorefront|uiserver|screens` breaks the code on purpose and expects the tests to fail.
