# Website: the wishlist heart is drawn whole, and the product page fits a phone

## What was wrong
1. **The heart looked cut.** Its drawing (made by hand) stopped short on the right: it spanned 1.9 to 18.1 of its 24-wide box (centre 10, not 12), so the outline looked cut off on one side and the red saved heart looked flattened. It was not clipped by anything: the heart sits fully inside its circle, the card and the title row.
2. **The product page was wider than a phone** (found while checking the above, and not caused by the heart): 407 px on a 390 px phone and **450 px in Arabic**, so its right edge, including the Share button, was cut off and the page scrolled sideways. A long fitment chip ("FITS BYD Seal 2022-2024 +4 more models") could not shrink because the chip rule said `white-space: nowrap`.

## What changed
* `components/WishlistHeart.tsx`: the heart is the standard **symmetric heart**: it spans 2 to 22 of the 24 box, centred on 12, the same size (38 px on cards, 42 px on the product page) and in the same place. Outline when not saved, red when saved.
* `app/globals.css` (the chip rule, through `patch-heart-fix.js`): a chip is **one line when there is room** and **wraps inside its own box** when the screen is too narrow (`white-space: normal; max-width: 100%; overflow-wrap: anywhere`). On a computer nothing looks different.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_heart_fix.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-heart-fix.js
node scripts\patch-heart-fix.js --write
```
Unzip first (it replaces `WishlistHeart.tsx` and two test files), then the patch changes `app\globals.css` (saved as `globals.css.before-heart-fix`; "already" if run twice; it changes nothing if the chip rule is not exactly as expected). Then reload the website with Ctrl+F5 (`.\scripts\start-all.cmd -NoPhone -CleanWebsite` if a page looks old). No server change and no migration.
Run it after `patch-ui-round3.js` and `patch-wishlist-heart.js`.

## What to look at
1. A product card and the product page: the heart is whole in outline and in red.
2. A phone (or a narrow browser window, 360 to 412 px), English and Arabic: the product page no longer scrolls sideways, and Share is fully visible. The fitment chip wraps onto a second line.
3. A computer: the chips are one line as before.

## Notes
* On a very small screen (320 px) the site's top header still overflows by a few pixels: that is a separate thing and not changed here. Tell me if you want it fixed.
* The app's heart uses the system heart icon, which is already whole.

## Tests
`npx vitest run components/WishlistHeartShape.test.tsx components/WishlistHeart.test.tsx lib/stylesheet.test.ts`; `scripts/break-check-order-vehicles.py hfweb` breaks the code on purpose (7 ways) and expects the tests to fail.
