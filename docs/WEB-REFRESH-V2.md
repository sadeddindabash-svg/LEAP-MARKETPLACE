# Website auto-refresh v2 (storefront)

Fixes: patch-auto-refresh-web.js was REFUSED on app/returns/page.tsx and
app/support/page.tsx (newer than the patch expected) and stopped on
lib/support.ts, which this project does not have. v2 fits those two pages,
skips lib/support.ts, and checks that the helper files
(components/useAutoRefresh.ts, lib/refresh.ts) are present first.
Everything else (the cart, orders, order details, tracking, notifications,
quote requests) is the same as v1.

No server change. No migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_web_refresh_v2.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-auto-refresh-web-v2.js
    node scripts\patch-auto-refresh-web-v2.js --write
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd -NoPhone

Then open the website and press Ctrl+F5.
Undo: each changed file is saved as <file>.before-auto-refresh-web-v2.

## Check
Same account on the phone and the website, website tab visible.
Add an item in the app: the website's basket changes within about 5 seconds.
