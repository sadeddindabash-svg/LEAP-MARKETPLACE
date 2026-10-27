# The description under the name on the product page

## What changed on the website
On a product page, the part's **description** is now shown **right under the name and the part chips**, before the stock box, the seller lines, the price and the Add to cart button. It **also stays** as the last row of the **Technical Specifications**
card under the photos, exactly as before: the same text is on the page twice, on purpose.

* **Look:** 16 px, comfortable line spacing, the page's normal text colour at 80% strength, a small gap (14 px) under the chips. The supplier's own line breaks are kept, and a very long word wraps inside the column (it never makes the page wider).
* **No description** (empty, or only spaces and line breaks): nothing is shown under the name. The specifications card behaves as before ("Not specified" in its Description row).
* **Arabic:** the text is the description the server sends for the Arabic site, and the whole page is mirrored (the text is flush right). The server only sends the Arabic description when the part also has an Arabic NAME (otherwise it sends the English one):
  that is the existing rule of the site, not something new.
* **Phone:** one column, the description under the name and chips, then the stock box, price and button, as on a computer.
* **Computer:** the column beside the photos (which stays in view while you scroll) gets a few lines taller; it still scrolls by itself if it ever becomes taller than the screen, so the buy button is never hidden.
* No server change: the product page already receives the description. No migration.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Run this AFTER `patch-product-parity.js` (it adds a line to the column beside the photos that patch built; if that patch was not applied, this one says so and changes nothing).
1. Unzip, replacing files.
2. Run:
```
node scripts\patch-product-description.js
node scripts\patch-product-description.js --write
node scripts\patch-product-description-tests.js
node scripts\patch-product-description-tests.js --write
```
* `patch-product-description.js` changes ONE file (`app\products\[id]\page.tsx`: one block of 3 lines and a comment), saves it as `page.tsx.before-product-description`, says "already" if run twice, and changes nothing if the file is not what it expects.
* `patch-product-description-tests.js` is **optional** and separate: it updates ONE existing test (`app\productParity.test.tsx`) that said the description is not in the column beside the photos, which is no longer true. Without it that one test fails
  (the website itself is not affected).
* The new test file `app\productDescription.test.tsx` is a plain new file from the zip.
The storefront reloads by itself (or restart it with the commands in `docs\FONT-FIX.md`). A product page is kept for up to a minute, so a change to a part's description shows on the page within about a minute.

## Tests
In `apps\web-storefront`: `npx vitest run app/productDescription.test.tsx app/productParity.test.tsx`.
`scripts/break-check-order-vehicles.py pdstorefront` breaks the code on purpose (10 ways) and expects the tests to fail.
