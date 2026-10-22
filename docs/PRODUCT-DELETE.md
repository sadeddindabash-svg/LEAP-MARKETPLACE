# Deleting products (Admin > Products > All Products)

## What you can do now
* **Delete one product:** tick it in the list (or open it and press **Delete this product**), read the window, press **Delete 1 product**. One click, no sentence.
* **Delete several at once:** tick them, press **Delete…**, type `DELETE PRODUCTS`, press the button. Up to 200 at a time. The ticks in the header tick every product of the page.
* **The window checks first and changes nothing.** It lists what will be deleted, **what goes with it** (its pictures, reviews, wishlist entries and its lines in shoppers' carts; the picture files are removed from the server unless another product uses them), and
  what **cannot** be deleted and why. **This cannot be undone.**

## What can never be deleted
A product that **an order, a quote request, or any other record points at**. Its history keeps it. The window says why ("it has been in an order", "it is used in a quote request") and offers **Hide them instead**.
Nothing is assumed about which records point at products: the check looks at every table of the database, so a table added later is protected too, and if the database ever refuses one deletion for a reason nobody foresaw, that product simply stays
(the answer says what was really deleted).

## Hiding, and getting a product back
* **Hide** = the product stays in the database with its history, but shoppers no longer see it (it is set to inactive, like "Reject" in Moderation).
* Hidden products leave every other list, so the product list now has a switch: **Live products | Hidden products**. In **Hidden products** you can tick products and press **Send back to review**: they go to the **Moderation** queue (never straight to live,
  so a product that was rejected for bad text must pass the review again) and you approve them there as usual. You can also delete hidden products that nothing points at.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files. (The zip also holds `replace.js` and `unusedPictures.js` as of the cleanup fix: this uses them.)
2. Run it AFTER `scripts\patch-cleanup-fix.js`:
```
node scripts\patch-product-delete.js
node scripts\patch-product-delete.js --write
```
It changes three existing files (the catalog routes, the admin helper `auth.js`, and `App.jsx` of the admin portal), saves each as `<file>.before-product-delete`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
**No migration and nothing to install.**
3. Restart the backend: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, **and start the storefront again** (commands in `docs\FONT-FIX.md`). The admin portal reloads by itself.

## Try it (on test products first)
1. Admin > Products > All Products. Tick two test products, press **Delete…**, read the window, type `DELETE PRODUCTS`, delete.
2. Tick a product that was ordered: the window says it cannot be deleted and offers **Hide it instead**. Hide it, switch to **Hidden products**, tick it, **Send back to review**.

## Notes
* Every deletion is written to the audit log (how many, and the names). Sending to review too.
* Not covered here: the supplier portal (suppliers still cannot delete products), and the "Optional: start clean" tool, which has its own rules.
* The Delete button on a product's own page is tested by automated tests but I could not watch that page in a real browser (my test database lacks a table your real project has).
* Tests: server `node --test test/productDelete.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/ProductDeleteDialog.test.jsx src/productDeleteApi.test.js`.
  `scripts/break-check-order-vehicles.py pdserver|pdadmin` breaks the code on purpose and expects the tests to fail.
