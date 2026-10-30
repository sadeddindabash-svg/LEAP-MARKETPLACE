# Supplier portal: Products toolbar (option A)

Row 1, left to right: **Add product · Bulk upload · My Drafts · Export · Bulk edit**
Row 2: **All (374) · Low stock (12)**, so each filter shows its number of products.

- Bulk edit is always shown. It is greyed out until you tick products, then it reads "Bulk edit (3)".
- Export works as before: it exports the products currently shown, following the filter.
- New test: apps/supplier-portal/src/productsToolbar.wiring.test.js

## Apply (after patch-supplier-chinese-2.js)

    cd D:\LEAP-MARKETPLACE
    node scripts\patch-products-toolbar.js
    node scripts\patch-products-toolbar.js --write

Then reload the supplier portal with Ctrl+F5. Backup: App.jsx.before-products-toolbar

## Tests (unit only, never the integration tests)

    cd apps\supplier-portal
    npx vitest run --exclude "**/*.integration.test.js"
