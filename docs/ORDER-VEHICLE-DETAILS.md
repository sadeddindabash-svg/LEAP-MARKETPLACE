# Supplier portal: the car on an order item, IN FULL (with the version)

## What it does
Supplier portal, **Orders**:
* **Order details, under each item:** the part photo → the car photo, and the car in full: **Brand, Model, Generation** (for example "2022 – present"), **Year, Engine, Transmission**, and the **Version**: "2 of 3 versions" with each version (name, engine, seats) and an amber reminder "This part is for these versions only: check the version before you send it to the hub", or a green "All versions" when the part is not narrowed. "Also listed for" names the other cars (with their versions when narrowed). A part that fits any car says so, as before.
* **Orders table, the car column:** each item's car, on its own lines (title, version tag and names, engine and transmission); the first two items, then "+N more items"; "<part>: fits any car" for a part with no car; "(+N more cars)" when a part is listed for more cars. The column is wider.
* English and Chinese (the Chinese brand, model and version names are used). Rows with nothing to say are left out (no engine, a generation of a single year, a generation with no versions in the catalogue).
* It is still **the car the part is LISTED FOR**: the buyer's own car is never shown (a test checks that no buyer wording appears).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Apply `leap_fit_versions.zip` first (it adds the versions). Then:
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_order_vehicle_details.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-order-vehicle-details.js
node scripts\patch-order-vehicle-details.js --write
node scripts\patch-order-vehicle-details-portal.js
node scripts\patch-order-vehicle-details-portal.js --write
.\scripts\start-all.cmd -NoPhone -NoStorefront
```
Then reload the supplier portal (Ctrl+F5). No migration. The server patch changes `services\api\src\modules\orderVehicles\productCars.js` and the older test `services\api\test\productCars.test.js`; the portal patch replaces `src\OrderVehicle.jsx`, `src\OrderVehicle.test.jsx` and `src\OrderVehicleFlow.test.jsx` as whole files (ONLY when they are exactly the files it was made from) and widens one table cell in `src\App.jsx`. Each changed file is saved as `<file>.before-order-vehicle-details` / `.before-order-vehicle-details-portal`; running a patch twice says "already"; a file that is not what the patch expects is NOT changed (the whole patch stops and names it: send it to me).

## What to look at
1. Admin, Vehicle Data: a generation with versions. Supplier: add a part for that car narrowed to two versions (Add product, Versions step).
2. Buyer: order that part. Supplier portal, Orders: the table shows the car with "2 of 3 versions" and the names; open the order: the car in full, the chips and the amber reminder.
3. An order with a universal part and an order with 3+ items: "fits any car" and "+N more items".

## Notes
* Not changed: the admin portal's order screens, and Option B (showing the buyer's own car) which you did not choose.
* My copy of the supplier portal uses a stand-in theme, so I checked behaviour and layout logic by tests (not the final look): please send screenshots of anything to adjust (column widths, spacing).
* Chinese wording ("年款范围" for the generation years, "另有N件商品", the reminder) needs a native speaker's review.

## Tests
Server (`services\api`, database name ending `_test`): `node --test test\orderVehicleDetails.test.js` (5). Supplier portal: `npx vitest run src/OrderVehicle.test.jsx src/OrderVehicleFlow.test.jsx` (30).
`scripts\break-check-order-vehicles.py ovserver | ovportal` break the code on purpose (4 and 14 ways) and expect the tests to fail.
