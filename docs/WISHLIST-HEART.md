# Wishlist heart on the product cards and the product page (website and app)

## What changed
**Website**
* A round **heart** (38 px) on the **bottom corner of every product card's photo, at the END side** (it flips to the other corner in Arabic). Outline when not saved, **red when saved**. A press saves or removes the part at once and never opens it. Signed out, it leads to the login page, like the existing "Log in to save" button.
* A heart (42 px) in the **product page's title row**, beside Share.
* The existing wide "Add to wishlist" button under Add to cart stays, and **always agrees with the hearts** (one list).
* **One shared list** (`components/WishlistProvider.tsx`) is loaded once for the whole site, so a page of cards makes ONE request, not one per card. A failed save puts the heart back.

**Mobile app**
* The same round heart on the **photo's corner of every card** (end side: flips in Arabic), **shown to everyone**: signed out, a press opens the sign-in screen. It **replaces** the small heart that was in the card's price row for signed-in buyers only, and the card's own server request per card.
* A heart in the **product screen's top bar**, before Share.
* One shared list (`lib/core/wishlist_state.dart`) loaded once and refreshed quietly when older than a minute. Colours come from the app's palette (readable in dark mode); only the red of a saved heart is fixed.
* The "Notify me when back in stock" button is unchanged (it uses the same wishlist).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip the package over the project (replacing files), then:
```
node scripts\patch-wishlist-heart.js
node scripts\patch-wishlist-heart.js --write
node scripts\patch-wishlist-heart-app.js
node scripts\patch-wishlist-heart-app.js --write
```
* `patch-wishlist-heart.js` changes 5 website files (`app\layout.tsx`, `components\ProductCard.tsx`, `app\products\[id]\page.tsx`, `components\WishlistButton.tsx`, `lib\i18n.ts`). Run it after `patch-you-saved.js`. Reload the website with Ctrl+F5.
* `patch-wishlist-heart-app.js` changes 3 app files (`widgets\product_card.dart`, `features\catalog\product_screen.dart`, `core\app_strings.dart`). Then in `apps\mobile`: `flutter analyze`, `flutter test`, and run the app.
* Each patch saves what it changes as `<file>.before-wishlist-heart` / `.before-wishlist-heart-app`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it then names the file: send it to me, as before).
* No server change and no migration.

## What to look at
1. Home and search: a heart on each card's photo; in Arabic it is on the other corner.
2. Signed out: pressing a heart goes to login. Signed in: it turns red, and the part is in the Wishlist screen.
3. Open a part: the heart beside Share (website) / in the top bar (app); on the website the wide button agrees.
4. App: the card layout is checked only against my copy of the card; if the patch refuses `product_card.dart`, send it to me.

## Notes
* The app part has not been run on a device (I cannot run Flutter here): it has plain-Dart logic tests (14) and source checks (12).
* The Arabic labels (حفظ في المفضلة / إزالة من المفضلة / سجّل الدخول للحفظ) should be read by a native speaker.
* In the app, removing a part inside the Wishlist screen does not tell the hearts elsewhere at once; they refresh within a minute (or when the list is reloaded).

## Tests
Website: `npx vitest run components/WishlistProvider.test.tsx components/WishlistHeart.test.tsx components/WishlistHeartPlacement.test.tsx lib/i18n.test.ts`. App: `flutter test test\wishlist_model_test.dart test\wishlist_heart_wiring_test.dart`.
`scripts/break-check-order-vehicles.py whweb | whapp` break the code on purpose (25 and 17 ways) and expect the tests to fail.
