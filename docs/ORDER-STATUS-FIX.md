# A cancelled order showed as "To ship" in the order list

## What was wrong
The status shown in the buyer's order **list** and on the order page (`displayStatus`) is worked out on the server, and that rule never produced "cancelled": it only knew returns, delivered, dispute, shipped and to-ship. A cancelled order has no shipment, so it fell through to **"to ship"**. This hit every cancelled order (one the buyer cancelled, or one a supplier refused with no alternative), in the **website list and the app list**, in the **admin order list**, and it was also counted in **"Active shipments"**.

## What changed (server only: no website or app change)
`displayStatus` is now **"cancelled"** when the order's own status is cancelled **or every one of its parts is** (a supplier refused and nobody else could supply it, even if the order's own status was not updated). An order with a part still going is not cancelled (one refused, one preparing is "to ship"; one on its way is "shipped"). An order with no parts yet is not treated as cancelled. Everything else is unchanged. The website and the app already know how to show "Cancelled", so they show it as soon as the server says so; "Active shipments" no longer counts it, and the app's "To ship" tab no longer lists it (it is in "All").

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_order_status_fix.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-order-status.js
node scripts\patch-order-status.js --write
```
Then restart the backend (`.\scripts\start-all.cmd -NoPhone -NoStorefront`) and reload the order list. The patch changes `services\api\src\modules\order\routes.js` (saved as `routes.js.before-order-status`), says "already" if run twice, and changes NOTHING if the line it needs is not exactly as expected. No migration.

## Tests
`cd services\api` then (database name must end in `_test`): `node --test test\orderDisplayStatus.test.js` (7 tests). `scripts\break-check-order-vehicles.py dsserver` breaks the code on purpose (4 ways) and expects the tests to fail.
