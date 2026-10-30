# Weight and size: set by Leap, never asked of the supplier

- Add product: the weight/length/width/height inputs are gone. The box shows the weight and size Leap set for the
  part, or "由 Leap 设置，您无需填写" (Set by Leap. You don't need to enter them).
- Bulk upload: a row is never kept as a draft because of weight and size.
- My Drafts: weight and size are never listed or asked for, and what is missing shows in Chinese:
  分类、部件类型、位置、照片、视频.
- Server: creating, bulk uploading and completing a draft no longer require weight and size.
- New test: apps/supplier-portal/src/noSupplierDimensions.wiring.test.js

Apply after patch-products-toolbar.js:

    cd D:\LEAP-MARKETPLACE
    node scripts\patch-no-supplier-dimensions.js
    node scripts\patch-no-supplier-dimensions.js --write

Restart the API (start-all), then reload the supplier portal with Ctrl+F5.
Backups: App.jsx.before-no-supplier-dimensions, routes.js.before-no-supplier-dimensions
