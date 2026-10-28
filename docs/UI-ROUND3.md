# Storefront, round 3: fonts, titles, compare photos, specifications, seller block, Arabic prices

## What changed
1. **Fonts (English and Arabic):** the part-class chip, the fitment chip and the **Shopping for** box use the page font, the same as the description (Outfit for English, IBM Plex Sans Arabic for Arabic), 13 px semi-bold, no letter spacing. Before, they used a typewriter font that has no Arabic of its own, so Arabic fell back to another font. Part numbers (OEM numbers) keep the typewriter font.
2. **Titles:** every h1 / h2 set at the big size (30 px) is now **20 px**, the size of "Find parts for your car": the home titles (Shop by section, Shop by brand, Newest parts) and the page titles (Cart, Orders, Wishlist, Compare, Garage, Account, Checkout, login and the others). Done with ONE rule in `app/globals.css` (`:is(h1, h2).text-3xl`), so it also covers a page added later. The product name (36 px) and smaller titles are unchanged.
3. **Compare:** the photos are **square** (144 px, the whole photo on white) instead of wide boxes that cut them. Up to **4 parts** can be compared (2 to 4, like the app).
4. **Technical Specifications:** the labels are a column and the values start at the **start side**: left in English, right in Arabic (the Description and the Fits lines too). On a phone the label column is narrower.
5. **Verified seller:** the icon is a filled gold badge with a white check.
6. **Ships from:** the country's **flag** is shown instead of the globe. Flags exist for China, Japan, Germany, France, Italy, the UAE, Turkey, Vietnam, Thailand, India, the USA and the UK (matched by the name in English or Arabic, or the two-letter code); any other country keeps the globe. The flags are small pictures inside the site (Windows does not draw flag emoji).
7. **Arabic prices:** the digits stay **0-9** and only the currency changes: `160 ريال`. Words: SAR, OMR, QAR ريال; AED درهم; KWD, BHD, JOD دينار; USD دولار (`$43` becomes `43 دولار` on an Arabic page). Other currencies keep the English style. The English page is unchanged. Applies to every price (cards, product page, cart, checkout, orders, totals).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip the package over the project (replacing files), then:
```
node scripts\patch-ui-round3.js
node scripts\patch-ui-round3.js --write
```
It changes 6 files (`app\globals.css`, `components\VehicleBar.tsx`, `app\compare\page.tsx`, `components\ProductDetails.tsx`, `components\SellerSignals.tsx`, `lib\currency.ts`), saves each as `<file>.before-ui-round3`, says "already" if run twice, and changes NOTHING if a line it needs is missing. Run it after `patch-ui-round2.js`.
No server change and no migration: just reload the website (Ctrl+F5). If a page looks old, restart it with `.\scripts\start-all.cmd -NoPhone -CleanWebsite`.
The zip also replaces `components\FitsRow.tsx` (its lines now start at the start side) and three existing test files whose old expectations described the Arabic digits and the old alignment.

## What to look at
1. A product page in English and in Arabic: the chips and the description in the same font; the specifications with all values starting at the same edge; the filled badge; the flag.
2. Home and any other page: the titles at 20 px.
3. Compare 3 or 4 parts: square photos.
4. Switch to a Saudi or UAE currency and the Arabic site: prices like `27 ريال`.
5. Signed in with a car in the garage: the Shopping for box in the page font.

## Notes
* **Discount tag over the brand logo in Arabic:** nothing changed here: the current code puts the logo and the tag on opposite sides in both languages. If you still see an overlap, your `ProductCard.tsx` is an older file (the tag had a fixed direction): re-run `patch-home-cards.js` from the corrected `leap_home_cards.zip`.
* **The mobile app is not changed** (it probably shows Arabic digits too; its currency file is not in my copy).
* Two tests of other parts of the site fail now and then under heavy load and pass alone; they are not touched by this work.

## Tests
`npx vitest run lib/countryFlags.test.ts components/CountryFlag.test.tsx components/SellerSignalsFlags.test.tsx lib/currency.test.ts components/stage1b-providers.test.tsx components/FitsRow.test.tsx app/compareSquare.test.tsx components/ProductDetailsLayout.test.tsx lib/stylesheet.test.ts`
`scripts/break-check-order-vehicles.py u3web` breaks the code on purpose (31 ways) and expects the tests to fail.
