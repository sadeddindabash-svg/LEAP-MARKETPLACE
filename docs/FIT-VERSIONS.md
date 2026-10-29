# Fitment by VERSION: the supplier can narrow a part to some versions of a car, and the buyer's version is used

## What it does
* **Supplier portal, Add product:** after the year, a new OPTIONAL step **Versions**: "All versions of this car (default)" or "Only some versions" (tick the versions the part fits; each shows its engine and seats). A car whose generation has no versions in the catalogue shows a grey note and nothing to choose. Choosing another car starts the step over. "Only some" with none ticked cannot be submitted. Bulk upload is unchanged (every version).
* **Server (migration 114):** a part's car (generation and year) can be narrowed to some versions. NO rows = every version, exactly how every existing part works. Choosing every version is stored as "every version" (a version added to the catalogue later still fits). The admin's re-save of a part's fitment list keeps the narrowing (or sets it with `fitment[].versionIds`). The supplier's product list carries each car's versions; the buyer's product answer carries `fitVersions` and `fitVersionNames`.
* **Website, the fit message** (the cart, and the product page wherever `FitCheck` is used): green **Confirmed fit** (with "This part is for: ..." when narrowed and the buyer's version is one of them); amber **Doesn't fit your version** (information only: the buyer can still order); grey **Choose your version to check** with a link to the garage (a saved car with no version yet). A part that is not narrowed behaves exactly as before. English and Arabic.
* **Website, "Parts Fit with my Car" (the search filter):** it sends the buyer's version too, so a part narrowed to OTHER versions is no longer listed; parts for the buyer's version, and parts that are not narrowed, are. No version saved: every part of that year (as before). Works with the lazy-loaded pages and the list cache.
* **App, product screen:** the "CONFIRMED FIT" badge only for a real fit (it used to look only at the generation), plus the same three notes under the part's name (English and Arabic).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Apply `leap_supplier_server_v2.zip` and `leap_supplier_admin_portals.zip` first if you have not (migrations 112 and 113). Then:
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_fit_versions.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-fit-versions.js
node scripts\patch-fit-versions.js --write
cd services\api
npm run migrate
cd ..\..
node scripts\patch-fit-versions-supplier.js
node scripts\patch-fit-versions-supplier.js --write
node scripts\patch-fit-versions-web.js
node scripts\patch-fit-versions-web.js --write
node scripts\patch-fit-versions-search.js
node scripts\patch-fit-versions-search.js --write
node scripts\patch-fit-versions-app.js
node scripts\patch-fit-versions-app.js --write
.\scripts\start-all.cmd -NoPhone
```
(run the website patches in that order: `-web` before `-search`). Reload the portals and the website (Ctrl+F5); rebuild the app (`flutter analyze`, `flutter test`, then run it). Each patch saves what it changes as `<file>.before-<name>`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me).

## What to look at
1. Admin, Vehicle Data: a generation has versions (name, engine, seats). Suppliers can narrow only where versions exist.
2. Supplier portal, Add product: choose a car whose generation has versions: the Versions step appears; try "Only some versions", tick two, add the product.
3. Buyer, My Garage: save that car WITH a version (the 4th step). Open the part: green with the versions; then save the car with another version: amber; then a saved car with no version: grey with the link.
4. Search, "Parts Fit with my Car": the part narrowed to other versions is not listed.

## Things to know
* **Not changed:** the "CONFIRMED FIT" badge on the product CARDS in the app's lists, and the app's own "my car" search / home feed (they still match by car and year only; the server filter is ready for them: `versionId`). Tell me and send `widgets/product_card.dart` and the filter code if you want them done.
* **The product page on the website:** the message is the shared `FitCheck` component. In my copy only the cart uses it; if your product page has its own fit message, tell me.
* **A supplier adds ONE car per product** in the portal, so the version choice belongs to that car. The admin's product edit can still give a part several cars; it keeps each car's narrowing.
* **Tests that need your full project:** two end-to-end tests of the real create-product route skip themselves in my sandbox (it lacks files that route needs). Run `node --test test\fitVersions.test.js` in `services\api`: they should run, not skip.
* **The older test** `services\api\test\productCars.test.js` expected the exact car object; the patch adds `versions: null` to it. (Its test 10 fails in my sandbox without these changes too.)
* **Arabic and Chinese wording** needs a native speaker's review.
* The app part has not been run on a device (I cannot run Flutter): plain-Dart rule tests and source checks only.

## Tests
Server (`services\api`, database name ending `_test`): `node --test test\fitVersions.test.js` (21 + 2 end-to-end). Website: `npx vitest run lib/fitVerdict.test.ts components/FitCheckVersions.test.tsx lib/fitVersionsSearch.test.ts components/FitsMyCarVersion.test.tsx`. Supplier portal: `npx vitest run src/VersionsStepFlow.test.jsx`. App: `flutter test test\fit_verdict_test.dart test\fit_versions_wiring_test.dart`.
`scripts\break-check-order-vehicles.py fvserver | fvweb | fvsupplier | fvapp` break the code on purpose (20, 17, 8 and 11 ways) and expect the tests to fail.
