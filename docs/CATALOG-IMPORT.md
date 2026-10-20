# Parts catalog: Excel import, editing, undo (guide)

What you get: on the admin **Categories** page, two new tabs.

* **Import from Excel**: load `Leap_Parts_Catalog.xlsx` (62 one-word categories, 736 parts, names in English / Arabic / Chinese, allowed positions, packed size and weight). Check first (nothing is saved), read the result, then Import (all or nothing). Every import can be undone. A health box shows how many items still use the photo placeholder and how many sizes are still estimates.
* **Edit details**: correct any field of any category or part after an import (names, code, sub-category, placement, allowed positions, applies-to, special shipping, keywords, size and weight). The same naming rules as the import apply; the server says why when it refuses a change.

## Apply it (in this order, from the project root)

1. Unzip over the project folder. It only ADDS files; no existing file is replaced.
2. `cd services\api` and `npm install exceljs jszip` (already needed by the vehicle import; harmless if present).
3. Back in the project root, patch the three existing files (each command first as a dry run, then with `--write`):
   ```
   node scripts\patch-catalog-import.js
   node scripts\patch-catalog-import.js --write
   node scripts\patch-catalog-admin-screens.js
   node scripts\patch-catalog-admin-screens.js --write
   ```
   * `catalog/routes.js`: one line that mounts the new module.
   * `supplier/productValidation.js`: the supplier bulk import also recognises the catalog CODE (`BRK`, `BRK-001`) and the Chinese or Arabic name of a category or part. The English name or id still wins; a name that fits two things is never guessed.
   * `admin-dashboard/src/App.jsx`: the Categories page gets the tabs (its own code is untouched, only wrapped).
   Each script refuses (and changes nothing) if a file's text is not what it expects, says "already applied" on a second run, and saves a backup next to the file.
4. `cd services\api` and `npm run migrate` (migration 108: adds only missing columns and one table; safe to run twice).
5. Restart the backend and the admin dashboard. Sign in as an admin who may open **Categories**.

## Start clean (optional): remove the old catalog first

If the categories and parts made by hand before the catalog are only test data, remove them first so the imported catalog stands alone (no merging into old categories, no look-alike warnings). On the **Import from Excel** tab, open **Optional: start clean**.

1. Press **Check what the old catalog contains**. It shows how many old categories and parts would be removed, which categories stay (and why), and removes nothing.
2. Tick **Also delete the test products that use the old catalog** if those products are only test data. A product that has ever been in an order is never deleted (order history keeps its products); its category stays.
3. Type `REMOVE OLD` and press **Remove the old catalog**. It all happens in one step or not at all, and it is written to the audit log. Then download the list of what was removed.

"Old" means a category or part that no import created and that has no catalog code. Anything an import created or filled with a catalog code is never touched. A part is removed only if no product uses it; a category only if it has no parts left and no product uses it. A deleted product's images, reviews and wishlist entries go with it, and its lines are removed from shoppers' carts.

Recommended order for a database that holds only test data: **start clean, then import**.

## Use it

1. Categories, **Import from Excel**, choose `Leap_Parts_Catalog.xlsx`, **Check file**. Read the numbers, the warnings, and any row marked Problem (each says its row and why). Nothing is saved yet.
2. Press **Import**. New categories and parts get a "photo coming soon" placeholder.
3. **Edit details**: pick a category, press Edit on a part, change what is wrong, Save. A size you type becomes "measured" (no longer an estimate).
4. **Undo**: in "Imports so far", Undo removes what that import created, but only what no product uses.

## Rules worth knowing

* **Skip mode** (the default) never changes a value that exists. For a row that matches an existing one by name (for example an older "Engine" or "Filters"), it fills only the **empty** fields (code, Chinese name, sub-category and so on). **Update mode** refreshes everything a sheet owns, but never an English name, and never a size a person set (an estimate is refreshed, a measured size is kept). Update mode tells you how many products' shipping would change before you confirm.
* **Nothing is ever deleted or renamed by an import.** A part's name is how products refer to it; editing a part's name carries its products along in the same transaction.
* A sheet category is matched to an existing one by its **code**, else by its **name**, else by its **id** (an existing category whose id is `lighting` IS "Lighting" for the supplier import, whatever its name). A match by id is announced in the notes, the existing category keeps its own name, and the new parts are added to it. A name that is the id of one category and the name of ANOTHER is refused as ambiguous. Look-alikes ("Brakes" and "Brake System") are reported, never merged.
* **Estimated sizes are used for shipping** by any product that has no complete size of its own, until you review them (Edit details, "Mark size as reviewed", or by typing the real size). The health box counts the products this affects.
* **Undo keeps the blanks it filled** on rows that already existed (a code, a Chinese name): only the rows the import created are removed.
* **Photos**: placeholders are two files, `placeholder-category.png` and `placeholder-part.png`, copied into the uploads folder by the first import. If photos live in cloud storage, upload those two files there and update the two addresses.

## Tests

* API (28 tests, real HTTP with the real login and database): create or prepare a test database whose name ends in `_test`, then
  `set DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/YOUR_test_DB` and `node --test test/catalogImport.test.js` in `services\api`. They assume the standard seed (6 categories, 36 parts, 3 products, `admin@leap.dev`); if your seed differs, a few counts in the tests need adjusting. The file refuses to run on a database whose name does not end in `_test`.
* Admin screens (the three catalog test files): `npx vitest run src/CatalogImportPanel.test.jsx src/CatalogEditorPanel.test.jsx src/CategoriesTabs.test.jsx` in `apps\admin-dashboard`.

## What was and was not checked

Checked: all of the above tests; 22 deliberate breaks of the server code and 16 of the screens were each caught by the tests; the two patch scripts were run on the ORIGINAL files and give exactly the patched files; a real browser logged in, checked and imported the real workbook, edited a part and saw a mistake refused, with no browser errors.

Not checked: the whole server was not started (the working copy used for the build lacked some of your files), so the one-line mount in `catalog/routes.js` was only syntax-checked, and the new endpoints were exercised through a small stand-in server that uses your real login, permission check, audit log and database. Please run the steps above once on your own machine and tell me anything that behaves differently. The Arabic and Chinese texts were written for the catalog and should be reviewed by native speakers.
