# Supplier portal and admin portal: RMB only, pie chart, Accept / Refuse, Refused orders

Apply AFTER the server package (`leap_supplier_server_v2.zip`: `patch-supplier-rmb.js`, `patch-order-response.js`, migrations 112 and 113). These screens read the fields it adds.

## Supplier portal (`patch-supplier-portal.js`)
* **Everything is in RMB (¥).** Overview, Orders, Finance. No dollar amount is shown.
* **Overview:** **Payout summary is at the very top.** Then the Total orders tile (and the other tiles), then **one pie chart**: Succeeded (delivered, not returned), In progress, Refused / cancelled, Returns, with the total orders in the middle and each group's count and %. Then, in the same order as before: Revenue trend (last 30 days), Top-selling products, Order status breakdown, Low-stock products, Orders per day (last 7 days), Top products (by units sold), Recent orders.
* **Order details:** each item shows **your price in ¥** (the price you set, saved when the order was placed), not Leap's selling price; "—" when a product has no RMB price yet.
* **A NEW order waits for your answer:** **Accept** (the same steps as before: preparing, then ship to the hub) or **Refuse** with a reason (out of stock, price changed, part discontinued, can't ship in time, other + a short note). The time left (24 hours) is shown; when it is late it says Leap has been told. While it waits, the preparing / shipped steps are hidden: answer first. After Accept the order can no longer be refused here. A refused order opened later says it was refused and why.
* **Finance:** in ¥; **no commission** (you are paid your own price × quantity); payouts recorded earlier in dollars are shown apart (the note and a "$ ... USD" row) and are not added to the ¥ total. The portal text is in English and Chinese; please have the Chinese read by a native speaker.

## Admin portal (`patch-admin-rmb.js`)
* **Orders page, a new section "Refused by a supplier, or not answered in 24 hours"** (Needs attention / Handled): the order, supplier, the reason and note (or "not answered ... NOT cancelled"), the buyer, the items with the buyer's dollar price and the supplier's RMB price. For a refused order: **alternatives** (other suppliers' live parts with the same OEM number and enough stock, with their RMB price), **Reassign to the chosen supplier** (the buyer keeps the agreed price; it needs an alternative for every item, from one supplier) and **Mark as handled** (with a note).
* **Money a supplier is paid is in ¥:** the Payouts page (owed, and history; a payout recorded earlier in dollars keeps "$ ... USD"), a supplier's analytics, and the fault-case payment (the local shipping the admin types is in RMB).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_supplier_admin_portals.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-supplier-portal.js
node scripts\patch-supplier-portal.js --write
node scripts\patch-admin-rmb.js
node scripts\patch-admin-rmb.js --write
```
Then restart (`.\scripts\start-all.cmd -NoPhone -NoStorefront`) and reload both portals (Ctrl+F5). Each patch saves what it changes as `<file>.before-supplier-portal` / `.before-admin-rmb`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me).

## What to look at
1. Supplier portal, Overview: Payout summary on top, then the pie chart; all amounts in ¥.
2. Place a test order for a supplier; open it in the supplier portal: the item price is yours in ¥; Accept / Refuse. Refuse with "Out of stock": the part's stock becomes 0, the buyer gets a notice, the admin sees it in Orders.
3. Admin, Orders: the refused order; open it, pick an alternative, Reassign: the other supplier gets a new order to answer.
4. Admin Payouts and Finance in the supplier portal: ¥.

## Notes
* My copy of the supplier portal uses a stand-in theme, so I checked behaviour (tests), not the final look: please look at the screens and send screenshots of anything to adjust.
* Two supplier portal test files (`AddProductCascade`, `CategoryShippingFlow`) fail the same way WITHOUT these changes in my sandbox. In the admin portal, `startupSafety`, `databaseDown`, `mobileLanguage` and `envExample` fail in my sandbox without them too (my copy lacks migrations the repo has).
* The zip updates the older tests that described the dollar payouts (`FinanceFlow`, `PayoutsFlow`, `FlaggedShipmentsFlow`).

## Tests
Supplier portal: `cd apps\supplier-portal` then `npx vitest run src\OverviewRmbFlow.test.jsx src\AnswerFlow.test.jsx src\FinanceFlow.test.jsx`. Admin portal: `cd apps\admin-dashboard` then `npx vitest run src\RefusedOrdersFlow.test.jsx src\PayoutsFlow.test.jsx src\FlaggedShipmentsFlow.test.jsx`.
`scripts\break-check-order-vehicles.py spportal | admportal` break the code on purpose (24 and 12 ways) and expect the tests to fail.
