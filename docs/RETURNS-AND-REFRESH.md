# "Request a return" rule, "Shipped by" removed, and auto-refresh every 5 seconds (website and app)

## 1. "Request a return" appears only while a part can be returned
One rule on the server, used by the website, the app and the server's own check:
* **A cancelled part, or any part of a cancelled order: never.** (The server also refuses a return filed for one: "A cancelled order cannot be returned.")
* **Not delivered yet: yes.**
* **Delivered: until the delivery date plus the return window you set in the admin portal (Settings, return window, 3 to 7 days; 7 if none), and not after.** Change the setting and the buttons follow within seconds.
The order details now carry `returnable` and `returnUntil` for each part; the website and the app just follow it (an older server that sends nothing: only the cancelled rule applies).

## 2. The app's order details: the "Shipped by" heading is removed
The supplier cards stay; only the heading line is gone (English and Arabic).

## 3. Auto-refresh every 5 seconds, quietly
* **How:** while a page or screen is open and visible, it reads its data again every **5 seconds**; coming back to the tab or the app refreshes **at once**; nothing is loaded while the tab is hidden or the app is in the background; never two requests at a time; no spinner; **an error keeps what is on screen**. The interval is one line (`lib/refresh.ts` on the website, `PeriodicRefresh.defaultInterval` in the app).
* **Website:** the signed-in buyer's **cart** (so the website and the phone stay in step), the order details, the orders, returns, support, quote-request and notification pages; and the tracking page, the return and support conversations and the notification bell (they already refreshed, every 20 or 30 seconds).
* **App:** the signed-in buyer's **cart**, the orders list, the notifications and a support ticket; and the order details and tracking screens (already refreshing, every 20 seconds).
* **Not in this package:** the admin, supplier and hub portals (next package).
* **Cost:** every open screen asks the server every 5 seconds. For a handful of users that is nothing; with many users the server will feel it. If it ever does, raise the number (10 or 15 seconds) in the one place above.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Apply the earlier packages first (this one edits files they changed). Then:
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_returns_refresh.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-return-rule.js
node scripts\patch-return-rule.js --write
node scripts\patch-return-rule-web.js
node scripts\patch-return-rule-web.js --write
node scripts\patch-auto-refresh-web.js
node scripts\patch-auto-refresh-web.js --write
node scripts\patch-return-rule-app.js
node scripts\patch-return-rule-app.js --write
node scripts\patch-auto-refresh-app.js
node scripts\patch-auto-refresh-app.js --write
.\scripts\start-all.cmd -NoPhone
```
Restart the backend, reload the website (Ctrl+F5), then rebuild the phone app (`cd apps\mobile`, `flutter analyze`, `flutter test`, then `.\scripts\start-all.cmd`). No migration. The zip also REPLACES `apps\mobile\lib\models\order_rules.dart` and `apps\mobile\test\order_rules_test.dart` (from the cancelled-order package) with versions that have the return rule. Each patch saves what it changes as `<file>.before-return-rule...` / `.before-auto-refresh...`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me). The website patches also update older tests that checked the 20- and 30-second numbers.

## What to look at
1. Open an order that is **cancelled**: no "Request a return" (website and app). Open one that is **delivered** and set the return window to 3 days in the admin: it disappears 3 days after delivery.
2. The app's order details: no "Shipped by" heading.
3. Add an item to the cart on the website while signed in: within 5 seconds it shows on the phone (and the other way round). Change an order's status in the admin: the buyer's order page updates by itself within 5 seconds.

## Tests
Server (`services\api`, database name ending `_test`): `node --test test\returnRules.test.js` (9). Website: `npx vitest run app/returnButton.test.tsx lib/returnRule.test.ts components/useAutoRefresh.test.tsx components/CartAutoRefresh.test.tsx app/pagesAutoRefresh.test.tsx`. App: `flutter test test\order_rules_test.dart test\return_button_wiring_test.dart test\periodic_refresh_test.dart test\auto_refresh_wiring_test.dart`.
`scripts\break-check-order-vehicles.py rfserver | rfwebr | rfweba | rfapp` break the code on purpose (9, 3, 14 and 15 ways) and expect the tests to fail.
