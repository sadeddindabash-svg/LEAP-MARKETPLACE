# One cart per account (website and app)

## What it does
Until now every device had its OWN cart (a random id in the browser cookie, another in the phone's storage): signing in did not share it. Now a signed-in buyer has ONE account cart, the same on the website and the app.
* **Signing in:** this device's basket joins the account cart. A buyer with no cart yet simply keeps it. Items are **added together** (2 + 1 = 3); a quantity is lowered **only to the stock available** (never below what the account cart already had) and a line that would end with nothing is dropped. The account cart's **promo code** is kept (the device's is taken only when the account cart has none); the **checkout price lock** of the account cart is kept (the device's is adopted only when the account cart was EMPTY, because a lock must cover the whole cart).
* **A notice, once:** "We combined this device's basket with your account basket", how many items were added, which quantity was lowered for stock, what could not be added (English and Arabic, on the website basket and in the app's cart; dismissable).
* **Old carts:** the first time an account signs in after the update, its older per-device carts are combined into the oldest one (nothing counted twice, even if two devices sign in at the same moment).
* **Sync:** a change on one device shows on the other the next time it opens or refreshes the cart (not live to the second).
* **Sign-out:** the device gets a **fresh empty guest cart**, so the next person never sees the account's cart. Signing in again brings the account cart back.
* **Another account on the same device:** it gets its own cart and never sees or takes the previous account's. A request that is not signed in (for example a stale sign-in) never sees an account's cart either.
* **After an order:** the account cart is emptied (the website calls the new `POST /cart/:id/clear`; the app removes each item from the same cart, as it already did), so every device shows it empty. A guest still gets a new empty cart.
* **Quotes:** a quote placed as an order puts its items into the account cart.
* **Guests** are unchanged: a cart for that device only; it joins the account cart when they sign in.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Apply `leap_order_names_ar.zip` first if you have not (the website patch edits `lib\i18n.ts` and `lib\api.ts` after it). Then:
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_account_cart.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-account-cart.js
node scripts\patch-account-cart.js --write
cd services\api
npm run migrate
cd ..\..
node scripts\patch-account-cart-web.js
node scripts\patch-account-cart-web.js --write
node scripts\patch-account-cart-app.js
node scripts\patch-account-cart-app.js --write
.\scripts\start-all.cmd -NoPhone
```
Restart the backend, reload the website (Ctrl+F5), rebuild the app (`flutter analyze`, `flutter test`, run it). **Rebuild the app and reload the website together with the server**: an app or website without this change still works, but keeps using a device cart until it is updated. Each patch saves what it changes as `<file>.before-account-cart...`, says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file: send it to me). The migration is number **115**; if you have added a migration of your own with that number, tell me.

## What to look at
1. On the website, signed out: add a part. In the app, signed out: add a different part.
2. Sign in on the website, then on the phone: both show BOTH parts; one notice on each (once).
3. Change a quantity on the phone, reopen the website basket: it follows. Sign out of the website: its basket is empty; sign in again: it comes back.
4. Place an order: both baskets are empty.

## Notes
* **Existing products are never dropped just for being out of stock** (the cart still shows them with their stock hint, as before): only a line that cannot be combined at all (no stock for the extra quantity and none in the account cart) is dropped, and the notice says so.
* **The price lock** of a device cart is adopted only into an EMPTY account cart; otherwise the checkout starts a new lock when it opens, as it always does.
* I could not run Flutter here: the app part has plain-Dart tests and source checks only. Please try sign-in, sign-out and an order on a phone.
* The Arabic wording needs a native speaker's review.

## Tests
Server (`services\api`, database name ending `_test`): `node --test test\accountCart.test.js` (20). Website: `npx vitest run components/CartAccount.test.tsx app/cartAccountNotice.test.tsx lib/accountCartApi.test.ts components/stage2-cart.test.tsx`. App: `flutter test test\cart_merge_test.dart test\account_cart_wiring_test.dart`.
`scripts\break-check-order-vehicles.py acserver | acweb | acapp` break the code on purpose (16, 13 and 10 ways) and expect the tests to fail.
