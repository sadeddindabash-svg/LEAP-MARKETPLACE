# Supplier portal: Overview layout v2 (rows of three)

Row 1: Payout summary | Order status breakdown | Orders
Row 2: Orders per day (last 7 days) | Recent orders | Low-stock products
Below, in their old order: the number tiles, Revenue trend (last 30 days),
then Top-selling products beside Top products (by units sold).

Nothing inside a container changes. Low-stock products is always shown.
On a narrow window the rows wrap. Works whether or not you applied the first
layout patch. No server change, no migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_supplier_overview_layout_v2.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-supplier-overview-layout-v2.js
    node scripts\patch-supplier-overview-layout-v2.js --write
    cd apps\supplier-portal
    npx vitest run src/overviewLayout.wiring.test.js

Then reload the supplier portal (http://localhost:5174) with Ctrl+F5.
Undo: App.jsx.before-overview-layout-v2 is the file as it was.
