# Home page tiles and product cards (as decided)

## What changed on the website
**The four totals at the top (Parts, Brands, Models, Countries)** are now **gold tiles**, 92 px high, filled edge to edge: a big navy number, the label, and a huge faint icon that is part of the tile. If the admin chose a picture for a tile
(Settings > Home page pictures) the picture fills the tile under a gold wash.

**Shop by section** is now a grid of **wide tiles**: the name on one side and the section's photo in an **angled panel** on the other (the angle is mirrored in Arabic), like the "Shopping for" container. 104 px high (80 px on a phone).
4 per row on a computer, 3 on a tablet, 2 on a phone. The first row shows 3 sections and the **More sections** tile (a wide dashed tile).

**Shop by brand** is now a grid of **round photos** (96 px, 76 px on a phone) with a fine ring and the name under them, no card around them. 6 per row on a computer, 4 on a tablet, 3 on a phone. The **More brands** tile is a dashed circle.
Brand pictures are cropped to fill the circle.

**Every product card** (home, search, the rows on a product page):
* **In stock** is a filled **green box**, **Out of stock** a filled **red box** (white text). The delivery date shows beside the green box and is not shown when the part is out of stock.
* An **add-to-cart icon button** (gold, 44 px) at the end of the price row. One press puts ONE of the part in the cart and shows a check mark for a moment; another press adds one more. It is a button of its own beside the card's link (a button
  cannot be inside a link). With no stock it is greyed out and disabled.
* The **brand logo** (the vehicle brand of the car the part fits) in a small white circle in the photo's start corner. A part with no logo shows nothing there, and a logo that cannot be loaded is not drawn.
* **Discount:** a tag on the photo, in the corner opposite the logo ("-29%": gold under 15%, orange from 15%, red from 30%), and the old price struck through beside the price. A part with no discount shows neither. A discounted part that is out of
  stock keeps its tag. The tag is read left to right in both languages ("-29%", never "29%-").
Arabic mirrors everything (photo angle, icons, logo, tag, button).

No server change: the product lists already send the brand logo and the old price. No migration.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Run this AFTER `patch-product-parity.js` (the discount uses its `lib/discount.ts` and the old price in `lib/api.ts`; if it was not applied the patch says so and changes nothing).
1. Unzip, replacing files.
2. Run:
```
node scripts\patch-home-cards.js
node scripts\patch-home-cards.js --write
node scripts\patch-home-cards-tests.js
node scripts\patch-home-cards-tests.js --write
```
* `patch-home-cards.js` changes 5 files (`components\TileRow.tsx` and `components\ProductCard.tsx` are replaced; `app\page.tsx`, `lib\api.ts` and `components\CartProvider.tsx` get small edits), saves each as `<file>.before-home-cards`, says
  "already" if run twice, and if a file is not what it expects it changes NOTHING.
* `patch-home-cards-tests.js` is **optional** and separate: it updates two EXISTING tests (`app\homePictures.test.tsx`: the picture tile; `components\ProductCardDelivery.test.tsx`: the delivery text without the dot). Without it those two tests fail
  (the website itself is not affected).
* The new files (the five components, `lib\cardDiscount.ts` and their tests) are plain new files from the zip.
The storefront reloads by itself (or restart it with the commands in `docs\FONT-FIX.md`).

## Things to know
* `components\CartProvider.tsx` gets a small extra, `useOptionalCart()`: a button inside a list stays disabled (instead of crashing the whole list) if there is ever no cart above it. The page always has one.
* My choices where you had not decided: the discount tag on the photo (not beside the price); the tag kept on an out-of-stock part; one press adds one; the brand logo as a 40 px white circle in the photo's start corner (the app's own card was not
  visible to me, so match it if it differs: it is `components\BrandBadge.tsx`).
* If your brand pictures are LOGOS rather than photos, changing `object-cover` to `object-contain` in `components\BrandTile.tsx` shows each logo whole inside its circle.
* The mobile app is not changed by this package.

## Tests
In `apps\web-storefront`: `npx vitest run lib/cardDiscount.test.ts components/CardAddToCart.test.tsx components/BrandBadge.test.tsx components/StatTile.test.tsx components/SectionTile.test.tsx components/BrandTile.test.tsx components/TileRowVariants.test.tsx components/ProductCardNewLook.test.tsx app/homeTiles.test.tsx`
`scripts/break-check-order-vehicles.py hcstorefront` breaks the code on purpose (40 ways) and expects the tests to fail.
