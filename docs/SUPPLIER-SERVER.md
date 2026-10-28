# Supplier changes, SERVER part: RMB only, and Accept / Refuse a new order

Two patches, applied in this order (the screens that use them come in the next packages: this one is only the backend).

## 1. RMB (patch-supplier-rmb.js, migration 112)
* **A supplier is paid, and shown, THEIR OWN RMB price x quantity** (option A: Leap's fees are inside the buyer's price, so nothing is taken from it).
* Each order line keeps the supplier's RMB price **from the moment of ordering** (`supplier_unit_price_cny`); a later price edit never changes an old order. Existing lines are filled from the product's current RMB price. A product that is not priced in RMB has no RMB price: its order waits (it is not counted as owed and is not paid) until it has one.
* The **owed amount, a recorded payout (now in RMB), the supplier's finance page, the analytics (revenue, top products, payout summary), a fault-case payment and the weekly digest** all use it. Replacement orders copy the price.
* The supplier's **order list sends `unitPriceCny` and no longer the buyer's dollar price** (`unitPrice` is gone from what a supplier receives).
* **Payouts recorded in dollars before this change** stay as they are: they are not added to the RMB total (the finance answer carries `legacyUsdPaid` so the portal can show them apart), and a dollar payout shows no made-up commission. Supplier commission rates are no longer sent.
* **Overview numbers:** the analytics now carries `outcomes` for the pie chart: every order is in exactly ONE group: cancelled, returned (a return that was not rejected), succeeded (delivered, not returned) or in progress.
* **A bug that was already there is fixed:** recording a payout failed (duplicate key) when a delivered sub-order had more than one line. Lines are now added up per sub-order, and the owed list counts orders, not lines.

## 2. Accept / Refuse (patch-order-response.js, migration 113, folder `src/modules/orderResponse`)
* A NEW order (a sub-order that is still "pending") can be **accepted** (the same steps as "start preparing" was: preparing, then ship to the hub) or **refused with a reason**: out of stock, price changed, part discontinued, can't ship in time, or other (other needs a short note). **After accepting, it can no longer be refused** in the portal.
* **24 hours to answer** (from when the order is placed). A **reminder every 4 hours** to the supplier (at 4, 8, 12, 16 and 20 hours; after a server stop it sends ONE reminder, not a burst). At 24 hours with no answer the **admin is told, once**. The order is **never cancelled silently**. The job runs every 15 minutes.
* **A refusal:** cancels only that supplier's part (the parent order is cancelled only when every part is); keeps the reason; tells the buyer (the notice opens the part, where the alternatives are, and says they will not be charged for it) and every admin. What the reason does to the part: *out of stock* sets its stock to 0; *discontinued* stops selling it; *price changed / can't ship / other* put the reserved units back.
* **Payment is not captured yet** (see `order/routes.js`), so "refunded" means the part is cancelled and the buyer is told they will not be charged, exactly as when a buyer cancels a part.
* **Admin** (`/supplier-responses`): the list of refused orders and of orders nobody answered in 24 hours (open / handled / all), the reason, the items with the buyer's price and the supplier's RMB price, **alternatives** (other suppliers' live parts with the same OEM number and enough stock), **mark handled**, and **reassign**: the refused part goes to ONE other supplier at the **price the buyer agreed**, with that supplier's RMB price; their stock goes down, the order comes back to life if it was cancelled, the new supplier gets their own 24 hours, the buyer is told.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_supplier_server.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-supplier-rmb.js
node scripts\patch-supplier-rmb.js --write
node scripts\patch-order-response.js
node scripts\patch-order-response.js --write
cd services\api
npm run migrate
cd ..\..
```
Then restart the backend (`.\scripts\start-all.cmd -NoPhone -NoStorefront`). The migrations (112, 113) only ADD columns and defaults; nothing is deleted. Each patch saves what it changes as `<file>.before-supplier-rmb` / `.before-order-response`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me).

## IMPORTANT before you apply
* After the RMB patch, **the supplier portal as it is today will show wrong numbers** (it still draws `$` and reads the old fields) until the next package (the portal screens) is applied. Apply the server and the portal packages together.
* The zip also replaces three **older integration tests** that hard-coded the old commission formula (`supplierFinance`, `supplierPaymentRelease`, `replacementOrders`). They need a running backend, so I could not run them here: please run them after applying.

## Tests
`cd services\api` then (database name must end in `_test`): `node --test test\supplierRmb.test.js test\supplierOutcomes.test.js test\orderResponse.test.js` (8 + 3 + 15 tests).
`scripts\break-check-order-vehicles.py rmbsrv | orsrv` break the code on purpose (20 and 26 ways) and expect the tests to fail.
