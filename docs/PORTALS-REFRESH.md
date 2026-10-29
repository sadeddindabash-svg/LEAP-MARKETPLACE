# Admin, supplier and hub portals: auto-refresh every 5 seconds

## What it does
While a screen is open and the browser tab is visible, it quietly reads its data again every **5 seconds**; when you come back to the tab it refreshes **at once**; nothing is loaded while the tab is hidden; never two requests at a time; **no spinner**, **an error keeps what is on screen**, and nothing is redrawn when nothing changed. The interval is one number (`REFRESH_MS` in each portal's `src/autoRefresh.js`).

**Supplier portal:** Overview, Orders (and the **order that is open**: a change made elsewhere, for example the buyer cancelled it, appears in it by itself), Returns, Finance, Products, Part requests, Notifications, the sidebar's unread badge, and the Messages threads (they already refreshed every 20 seconds). The Products page does **not** refresh while a product is being added or edited, or while the bulk price window is open.
**Admin portal:** Overview, Orders, **Refused by a supplier** (new refused orders appear), order details, Suppliers, Moderation queue, Flagged shipments, Tickets (list and ticket), Returns (list and case), Payouts (owed and history), Hub workload and performance, **the sidebar badges** (flagged shipments, pending suppliers, disputes, moderation, tickets) and the message threads (already refreshing, every 20 seconds).
**Hub portal:** the shipment queue (already refreshing, every 20 seconds).

**Not refreshed on purpose:** screens that are forms of settings (pricing, categories, vehicle data, payment methods, delivery rules, product edit, and so on). They are not lists that change under you, and refreshing could disturb what someone is typing.

**Cost:** every open screen asks the server every 5 seconds. For a few users that is nothing; with many users the server will feel it. If it ever does, raise the number (10 or 15 seconds).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Apply the earlier portal packages first (this one edits the same `App.jsx` files). Then:
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_portals_refresh.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-auto-refresh-supplier.js
node scripts\patch-auto-refresh-supplier.js --write
node scripts\patch-auto-refresh-admin.js
node scripts\patch-auto-refresh-admin.js --write
node scripts\patch-auto-refresh-hub.js
node scripts\patch-auto-refresh-hub.js --write
.\scripts\start-all.cmd -NoPhone -NoStorefront
```
Then reload the three portals (Ctrl+F5). No server change, no migration. Each patch saves what it changes as `App.jsx.before-auto-refresh-<portal>`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me).

## What to look at
1. Supplier portal, Orders: let a buyer place an order for that supplier: it appears within 5 seconds. Open an order, then have the admin change something: it follows.
2. Admin portal: place an order, or have a supplier refuse one: it appears in Orders / "Refused by a supplier", and the sidebar badges change, without reloading.
3. Hub portal: a shipment the supplier marks as shipped appears in the queue within 5 seconds.

## Notes
* The hub portal's own dependencies are not installed in my sandbox, so its small test was run through the supplier portal's test runner; please run `npm test` in `apps\hub-portal` after applying.
* Tests: `npx vitest run src/AutoRefresh.test.jsx` in `apps\supplier-portal` (10) and in `apps\admin-dashboard` (10), and `npx vitest run src/AutoRefresh.test.jsx` in `apps\hub-portal` (3). `scripts\break-check-order-vehicles.py rpsup | rpadm | rphub` break the code on purpose (12, 11 and 1 ways) and expect the tests to fail (the hub one is run through the supplier portal's runner).
