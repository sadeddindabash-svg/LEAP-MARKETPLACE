# "Cannot delete this category - real products still reference it"

## Why you saw it even after deleting all products
That message appears if **any** product row still has the category, whatever its state. The product lists only show **live** products, so these were invisible:
* **hidden** products (rejected or hidden by an admin),
* products **waiting for review** (the Moderation queue),
* suppliers' **drafts** (unfinished bulk-import listings): no admin list shows them at all,
* and products that **an order or a quote request points at**, which can never be deleted.

## What changed
When a category cannot be deleted, a window now opens by itself and shows **exactly what is still using it**, by state, with the names; says which of those can be deleted (and what goes with them: pictures, reviews, wishlist entries, cart lines) and which
cannot (and why, for example "it has been in an order"). If you decide to go ahead, you type `DELETE CATEGORY` and it deletes, in one step: the products that can go, the category's sub-categories nobody uses any more, and the category itself.
* **A product that an order, a quote request or any other record points at is never deleted.** If one has to stay, so does its category (and the sub-category it uses): the window says so and lists them. The category can be deleted once those records are gone.
  Every table of the database is looked up, and each deletion is also tried on its own, so one the database refuses simply stays instead of failing the whole step.
* The ordinary delete, its confirmation and its message are unchanged: the window only appears when products are in the way. **This cannot be undone**; it is written to the audit log.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files. (The zip also holds `productDelete.js`, `replace.js` and `unusedPictures.js` as they are now: this uses them.)
2. Run it AFTER `scripts\patch-product-delete.js`:
```
node scripts\patch-category-remove.js
node scripts\patch-category-remove.js --write
```
It changes three existing files (the catalog routes, the admin helper `auth.js`, and `App.jsx` of the admin portal), saves each as `<file>.before-category-remove`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
**No migration and nothing to install.**
3. Restart the backend: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, **and start the storefront again** (commands in `docs\FONT-FIX.md`).

## Use it
Admin > Categories: press the red x of a category and confirm. If products are in the way, the window opens. Read it, and if the list looks right, type `DELETE CATEGORY`. Take a database backup first if these are real products.

## Notes
* Products in a category are counted by the category's id; a product that is in a category but whose part is not one of its sub-categories still counts.
* Tests: server `node --test test/categoryRemove.test.js` (in `services\api`, against a database whose name ends in `_test`; it puts the catalog back exactly after each test); admin `npx vitest run src/CategoryInUseDialog.test.jsx src/productDeleteApi.test.js`.
  `scripts/break-check-order-vehicles.py cxserver|cxadmin` breaks the code on purpose (21 ways) and expects the tests to fail.
