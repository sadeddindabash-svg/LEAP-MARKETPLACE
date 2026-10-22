# Fix: "Optional: start clean" shows "Internal server error"

## What was wrong
On Categories > Import from Excel, the card **"Optional: start clean (remove the old catalog first)"** failed with "Internal server error" when **"Also delete the test products that use the old catalog"** was ticked and any record (for example a **quote request**)
pointed at one of those products: the database refuses to delete a product something points at, and the cleanup did not expect that (it only knew about orders). The same mistake was behind the error in "Make the catalog exactly this sheet", fixed earlier.

## What changed
The cleanup now behaves like the newer option:
* It **looks up every table that points at a product, a category or a sub-category** in the database itself (orders, quote requests, anything added later). A product something points at is **never deleted** (its sub-category and category stay), and the check
  says why, for example "it is used in a quote request: that history keeps its products".
* As a last safety net **each deletion is also tried on its own**: if the database ever refuses one for a reason nobody foresaw, that item stays ("it is still used by something else"), the rest goes ahead, and the answer says what was **really** removed.
* Everything else is as before: the check removes nothing, you must type `REMOVE OLD`, an import's own categories are never touched.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run:
```
node scripts\patch-cleanup-fix.js
node scripts\patch-cleanup-fix.js --write
```
It changes one file (`services\api\src\modules\catalogImport\cleanup.js`), saves it as `cleanup.js.before-cleanup-fix`, says "already" if run twice, and if the file is not the one I delivered it changes NOTHING (send it to the Leap team). **No migration and nothing to install.**
(The zip also updates `replace.js` in the same folder: it now shares its table lookup with the cleanup.)
3. Restart the backend: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, **and start the storefront again** (see the storefront start commands in `docs/FONT-FIX.md`).

## Tests
`node --test test/catalogCleanup.test.js` (in `services\api`, against a database whose name ends in `_test`; it puts the catalog back exactly after each test).
`scripts/break-check-order-vehicles.py clserver` breaks the code on purpose (7 ways) and expects the tests to fail.
