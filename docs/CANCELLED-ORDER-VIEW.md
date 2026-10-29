# A cancelled order no longer offers "Check your address", "Track your package" or "Download receipt"

## What was wrong
When a supplier refuses an order and nobody else can supply it, the order ends up **cancelled** (nothing is shipped, nothing was charged). The buyer's order page (website and app) still offered three things that make no sense for it:
* **Check your address in English:** it only looked at the address, not at whether the order was still going.
* **Track your package:** it was shown whenever any part was "not delivered", and a cancelled part counted as not delivered.
* **Download receipt:** it was always shown.

## What changed (website and app, the same rule)
An order is **over for good** when it is cancelled, or **every part is cancelled** (even if the order's own status was not updated). For such an order none of the three is offered. Tracking still ignores a cancelled part, so an order with one part refused and another still going keeps tracking, the receipt and the address check for the part that is going. "Order again" is still offered. Nothing else changed.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_cancelled_order_view.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-cancelled-order.js
node scripts\patch-cancelled-order.js --write
node scripts\patch-cancelled-order-app.js
node scripts\patch-cancelled-order-app.js --write
```
Website: `lib\orders.ts` and `app\orders\[id]\page.tsx`; reload with Ctrl+F5. App: `features\orders\order_detail_screen.dart`; then in `apps\mobile` run `flutter analyze` and `flutter test`, and rebuild the app (`.\scripts\start-all.cmd`). No server change, no migration. Each patch saves what it changes as `<file>.before-cancelled-order` / `.before-cancelled-order-app`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me).

## What to look at
Open a cancelled order (website and app): no address card, no "Track your package", no "Download receipt"; it says cancelled and you can still order again. Open an order with one part cancelled and one still going: all three are still there.

## Notes
* The app part has not been run on a device (I cannot run Flutter here): it has plain-Dart rule tests and source checks.
* The refusal reason is not shown to the buyer on the order page (they get the notification). Tell me if you want a line such as "A part was cancelled: the supplier could not supply it. You are not charged."

## Tests
Website: `npx vitest run app/orderCancelledView.test.tsx lib/orders.test.ts`. App: `flutter test test\order_rules_test.dart test\order_rules_wiring_test.dart`. `scripts\break-check-order-vehicles.py coweb | coapp` break the code on purpose (7 and 8 ways) and expect the tests to fail.
