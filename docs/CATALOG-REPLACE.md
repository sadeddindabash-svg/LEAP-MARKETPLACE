# Categories > Import from Excel: make the catalog exactly the sheet

## What it does
A new choice on the import screen: **"Make the catalog exactly this sheet"** (off at first). When it is on, the import adds what the sheet has, and **removes every category and sub-category that is not in the sheet**: the old ones made by hand, and the ones
an earlier import added. Everything happens in ONE step together with the import: all of it, or none of it.

## How it decides what is "in the sheet" (and what is old)
* In the sheet = every category and sub-category that a valid row of the sheet **matches** (an existing one, by its code or its English name) or **creates**. Everything else is old.
  A hand-made category with the same name as a category of the sheet (for example "Engine") is **the same category**: it gets the sheet's code and stays; its sub-categories that the sheet does not list are removed.
* **A product's category and sub-category are never removed from under it.** A product refers to them by name, so a category or sub-category that a product still uses **stays**, and the check lists it with the reason ("1 product uses it").
* Optional second choice, **"Also delete the products that use the old categories and sub-categories"** (off at first): those products are deleted too (with their pictures, reviews, wishlist entries and cart lines), and then the categories they held go as
  well. **A product that has ever been in an order is never deleted** (order history keeps its products), and its category and sub-category stay.
* The pictures of what is removed (a category's or sub-category's own picture, a deleted product's pictures) are deleted from the server too, unless something else still uses them. The "photo coming soon" placeholders are never touched.

## The safety steps
1. **Check file** removes nothing. With the choice on it shows a red line under the numbers ("This import will also remove ..." with a button to the list), and a box with: how many categories, sub-categories (and products) would be removed, their names,
   **what stays and why**, a **Download this list (.xlsx)** button, and the sentence to type.
2. **You must type `REPLACE CATALOG`** before the Import button works. The server asks for the same sentence again, so nothing can skip it.
3. If the file has any problem, **nothing is imported and nothing is removed**.
4. It is written to the audit log (how many categories, sub-categories and products were removed).

**This cannot be undone.** "Undo" in the list of imports only removes what an import added; it does not bring back what was removed. Download the list first, and **take a backup of the database before the first time you use it on the real server.**
(If something was removed by mistake, import the old catalog file again: the categories and sub-categories come back, without their photos and without any product that was deleted.)

## Which file
The catalog import file (the layout of `Leap_Parts_Catalog_v2.xlsx`, sheet "Part types"). The file `Categories.xlsx` you uploaded before has a different layout (a product list with SKUs) and is not a catalog file.

## What I checked on your real catalog file
In a real browser: imported the whole `Leap_Parts_Catalog_v2.xlsx` (62 categories, 736 parts). Then a new sheet with only 5 categories (76 rows), with the choice on: the check listed 57 categories and 688 sub-categories to remove and 2 that stay (a product uses them) and changed nothing;
the Import button stayed off for "replace catalog" in small letters and came on only for `REPLACE CATALOG`; after the import the catalog had exactly the 5 categories and their 76 sub-categories, plus the category a product still used. With "also delete the products" on, a second import removed the
last two categories and their 2 test products, leaving **exactly the 5 categories of the sheet, none without a catalog code**.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-vehicle-pictures.js`:
```
node scripts\patch-catalog-replace.js
node scripts\patch-catalog-replace.js --write
```
It changes four existing files (the catalog import's plan and routes, the admin's `catalogAdminApi.js`, and the import screen), saves each as `<file>.before-catalog-replace`, says "already" if run twice, and if ANY file is not what it expects it changes
NOTHING (send that file to the Leap team). **No migration and nothing to install.** (The zip also holds `services\api\src\modules\uploads\unusedPictures.js`, the same file as in the vehicle pictures package, which this uses to delete the pictures of what is removed.)
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`.

## Notes
* A shopper's saved search that points at a removed category simply finds nothing.
* The two choices are separate and both off at first, so an ordinary import behaves exactly as before.
* Tests: server `node --test test/catalogReplace.test.js` (in `services\api`, against a database whose name ends in `_test`; it puts the catalog back exactly after each test); admin `npx vitest run src/CatalogReplace.test.jsx`.
  `scripts/break-check-order-vehicles.py crserver|cradmin` breaks the code on purpose (34 ways) and expects the tests to fail.
