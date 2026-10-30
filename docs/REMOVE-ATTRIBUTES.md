# Attributes removed from all portals

Removed from:
- Supplier portal, Add product: the 属性 Attributes box. Line 2 is now OEM number, price, stock.
- Admin dashboard, moderation review: the Attributes editor.
- Admin dashboard, All Products > Edit: the Attributes editor.
- API: creating a product, moderating it and admin edits no longer accept or save attributes. The product
  details sent to the storefront, the app and the admin no longer include them, so the storefront and the
  mobile app show none.

Position: was taken from the "Position" attribute. It now comes from the part's name
("Front Brake Disc" -> Front), the same as Bulk upload. Moderation keeps the product's position.

Kept: the attribute tables in the database (no data is deleted).

Apply after patch-no-supplier-dimensions.js:

    cd D:\LEAP-MARKETPLACE
    node scripts\patch-remove-attributes.js
    node scripts\patch-remove-attributes.js --write

Restart the API (start-all), then reload the supplier portal and the admin dashboard with Ctrl+F5.
New tests: apps/supplier-portal/src/noAttributes.wiring.test.js, apps/admin-dashboard/src/noAttributes.wiring.test.js
