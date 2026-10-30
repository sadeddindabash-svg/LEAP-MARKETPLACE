# Supplier portal: Overview layout

Row 1: Payout summary | Orders
Row 2: Low-stock products | Orders per day (last 7 days)
Below, in their old order: the number tiles, Revenue trend, Top-selling
products + Order status breakdown, Top products + Recent orders.

Nothing inside a container changes. Low-stock products is now always shown
(it says "Nothing low on stock right now." when empty). On a narrow window each
pair stacks into one column. No server change, no migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_supplier_overview_layout.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-supplier-overview-layout.js
    node scripts\patch-supplier-overview-layout.js --write
    cd apps\supplier-portal
    npx vitest run src/overviewLayout.wiring.test.js

Then reload the supplier portal (http://localhost:5174) with Ctrl+F5.
Undo: App.jsx.before-overview-layout is the old file.
