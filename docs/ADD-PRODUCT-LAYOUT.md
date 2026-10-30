# Supplier portal: Add product layout

- Vehicle Fitment: Brand | Model | Year side by side, Versions under them.
  That side is as tall as the car photo (320 px); many versions scroll inside.
- Product Details: Product name | Category | Part Class., then
  Attributes | OEM Number | Price, then Stock quantity. Beside them, the
  320 x 320 "Weight and size" box (2 x 2): read-only from the part, or the four
  inputs when the part has no weight and size.
- Product Photos left, Product Video right, on one line.

Unchanged: the Bulk upload picker and the Drafts screen. No server change, no migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_add_product_layout.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-add-product-layout.js
    node scripts\patch-add-product-layout.js --write
    cd apps\supplier-portal
    npx vitest run src/addProductLayout.wiring.test.js
    npx vitest run

Then reload the supplier portal with Ctrl+F5: Products > Add product.
Undo: each file is saved as <file>.before-add-product-layout.
