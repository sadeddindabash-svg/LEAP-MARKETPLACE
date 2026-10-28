# Storefront, round 2: brands row, product chips, stock box and discount colours, card photos on hover

## What changed
1. **Home, Shop by brand:** **9 brands and "More"** on every screen size. A wide screen: one row of 10. Tablet: two rows of 5. Phone: 3 x 3 brands and a wide "More brands" button under them. (Before, the row showed one fewer brand than its columns: 5 on a computer, 3 on a tablet, 2 on a phone.) Pressing More shows every brand; pressing it again goes back to 9. The section tiles are unchanged.
2. **Product page, the two chips under the name:** the **part's photo** beside the part class, and the **brand logos** in front of the fitment ("FITS BYD Seal 2022-2024 +4 more models"): one logo per different brand (up to 3, overlapping, then "+N"); a brand without a logo is skipped; a part class without a photo is just the words. Older server: the single car's logo.
   The server now sends `partPhotoUrl` (the photo of the part class, matched by category and English part name) and `brandLogoUrl` in each fit group. If the part photo cannot be read the page still opens without it.
3. **Product page, stock + delivery box and discount tag:** the box **fits its words** and uses the cards' colours: **green** in stock, **amber** (navy text) when 5 or fewer are left, **red** when out of stock. The discount tag is solid (not italic) with the cards' tiers: **gold** under 15%, **orange** from 15%, **red** from 30%.
4. **Product cards, photos on hover:** with a mouse, while the pointer is on a card the next photo shows after 0.4 s, then one every 0.9 s, round to the first again, with a small capsule of dots; moving away returns to the first photo. **Nothing moves** on a phone or tablet (no hover) or when the device is set to reduce motion. Only the first photo is on the page until the pointer first enters (a page of cards does not download them all).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip the package over the project (replacing files), then:
```
node scripts\patch-ui-round2.js
node scripts\patch-ui-round2.js --write
```
It changes 9 files (server: `catalog\routes.js`, `orderVehicles\productCars.js`; website: `lib\api.ts`, `components\TileRow.tsx`, `app\page.tsx`, `components\StockBanner.tsx`, `components\PriceBlock.tsx`, `components\ProductCard.tsx`, `app\products\[id]\page.tsx`), saves each as `<file>.before-ui-round2`, says "already" if run twice, and changes NOTHING if a line it needs is missing.
Run it **after** `patch-multi-fit.js` (the version in `leap_fitment_and_garage_v2.zip`) and the earlier storefront patches. **Restart the backend**, then start everything (`.\scripts\start-all.cmd -NoPhone`). A product page is kept for up to a minute, so a change can show within about a minute.
No migration. The zip also replaces five existing test files whose old expectations described the previous look (stock box, price tag, home brands, home page, product page chips).

## What to look at
1. Home: Shop by brand at desktop, tablet and phone sizes (9 brands and More).
2. A product page: the part chip with its photo, the fitment chip with the brand logos (a part that fits two brands shows two logos), the stock box (green / amber / red) shrunk to its words, and the discount tag colours.
3. Any list of products: move the mouse over a card with several photos; on a phone nothing changes.

## Notes and things to confirm
* **Amber for "only a few left"** is a suggestion (the cards have no low-stock colour).
* **Discount colours:** the website cards' tiers are used; I could not see the mobile app's own colour file, so please confirm the app uses the same.
* "More brands" is two buttons in the page (the round one and the wide one); the stylesheet shows only one of them, so screen readers meet one.
* The demo data used for my pictures had long test brand names; real brand names will look cleaner.

## Tests
Server: `node --test --test-concurrency=1 test/productFitGroups.test.js` (in `services\api`). Website: `npx vitest run components/CardPhotos.test.tsx components/ProductCardPhotos.test.tsx components/ProductChips.test.tsx components/TileRowMax.test.tsx components/StockBanner.test.tsx components/PriceBlock.test.tsx app/homeTiles.test.tsx app/productFits.test.tsx lib/fitLogos.test.ts`.
`scripts/break-check-order-vehicles.py u2server | u2web` break the code on purpose (7 and 43 ways) and expect the tests to fail.
