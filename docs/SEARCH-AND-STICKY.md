# Rotating search suggestions, and the pinned column on the product page

## 1. Rotating suggestions in the search box (every page: the header search is one shared box)
* While the box is empty, its words change every **3 seconds**: the next suggestion **slides up** from below while the old one slides out above (half a second). The first suggestion is the box's normal sentence, so the box looks exactly as before until it first slides.
  The five, in order: "Search by part name, part number or VIN", "Search “brake pads”", "Search “oil filter”", "Search by OEM number, e.g. 12345-67890", "Search by VIN or by car, e.g. BYD Seal", and then round again. Arabic has its own five.
* **Typing hides them** (you are never fighting moving words); emptying the box brings them back. Clicking on the moving words clicks the box.
* **Less movement:** for anyone whose device is set to reduce animations, nothing moves: the box shows the normal sentence as an ordinary placeholder. The page that is first sent to the browser is also exactly the old box (the movement starts once the page is ready).
* **Screen readers** read the box's normal label and the normal sentence (as its description), not the moving words. The movement pauses while the browser tab is in the background.
* **To change the suggestions:** the words are `search_hint_1` to `search_hint_4` in `apps\web-storefront\lib\i18n.ts` (English near the top, Arabic further down); the timing is `ROTATE_MS` and `SLIDE_MS` in `lib\searchHints.ts`. They are not editable in the admin portal (I can add that if you want it).

## 2. The product page: the column beside the photos stays in view (computer screens)
* The right column (title, price, stock, description, **Add to cart**, wishlist) is **pinned 16 px below the top of the screen** while the photos and the "Product details" card on the left are scrolled, and is **released where they end**.
  The "Other listings" table and the reviews come after, full width, and are never covered.
* On a **phone** (one column) nothing is pinned.
* A **very long description** would be taller than the screen, so the column is capped at the screen height and **scrolls inside itself** (the Add to cart button stays reachable by scrolling in the column). The page's row is then no taller than the photos side.
* The header does not stick to the top, so only a small gap is needed. If you ever make the header stick, the gap (`md:top-4` in `app\products\[id]\page.tsx`) must grow by its height.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-product-page.js` (the other patches do not matter):
```
node scripts\patch-search-sticky.js
node scripts\patch-search-sticky.js --write
```
It changes three existing files of the storefront (`components\HeaderSearch.tsx`, `lib\i18n.ts`, `app\products\[id]\page.tsx`), saves each as `<file>.before-search-sticky`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
**No migration, nothing to install, no backend change.**
3. The storefront reloads by itself (if it does not: stop it and start it again with the commands in `docs\FONT-FIX.md`).

## Notes
* The Arabic suggestions are my wording: please have a native speaker check them.
* Tests: `npx vitest run lib/searchHints.test.ts components/RotatingPlaceholder.test.tsx components/HeaderSearch.test.tsx app/stickyColumn.test.tsx` (in `apps\web-storefront`).
  `scripts/break-check-order-vehicles.py ssstorefront` breaks the code on purpose (19 ways) and expects the tests to fail.
