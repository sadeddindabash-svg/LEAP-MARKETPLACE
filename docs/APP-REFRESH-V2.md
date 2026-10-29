# App auto-refresh v2 (mobile)

Fixes: `patch-auto-refresh-app.js` was REFUSED because `ticket_detail_screen.dart`
already had its own 20-second timer. v2 replaces that timer with the shared
5-second AutoRefresher. The other 5 changes (cart, orders, notifications,
order details, tracking) are the same as v1.

No server change. No migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_app_refresh_v2.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-auto-refresh-app-v2.js
    node scripts\patch-auto-refresh-app-v2.js --write
    cd apps\mobile
    flutter analyze
    flutter test test\auto_refresh_wiring_test.dart

Then press R in the running start-all window, or run .\scripts\start-all.cmd again.

Undo: each changed file is saved as <file>.before-auto-refresh-app-v2.

## Check
Sign in with the same account on the website and the phone. Add an item on
the website: the phone's cart changes within about 5 seconds.
