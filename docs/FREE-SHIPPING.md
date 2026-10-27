# Free shipping above a limit (server, admin portal, website)

## What it does
The admin sets a **limit** and a **shipping fee** (Admin portal > Settings > **Free shipping**). An order whose **goods, after any discount,** come to LESS than the limit pays the shipping fee **on top**; at or above the limit **shipping is free**.
* **Switched off (the default) nothing changes:** no fee is ever charged, the website and the app look exactly as before. Nothing happens until an admin switches it on.
* The prices on the site already include each part's own freight from the supplier. THIS is an extra delivery fee on a SMALL order; the prices are not changed.
* **Amounts are in US dollars** and buyers see them in their own currency. One limit for every country.
* A **free-shipping promo code** waives the fee (it also keeps doing what it already did).
* The fee is worked out on the **server** (nothing a client sends can change it), put into the order (`orders.shipping_fee`, and `orders.total` INCLUDES it), and **kept**: changing the limit later never changes an order already placed.
* If an order is later cancelled in part so that it would have been under the limit, the buyer keeps the free shipping already granted.

## What buyers see (website)
* **Cart:** a "Shipping fees" line, a note "Add $30 more for free shipping" with a progress bar, and a total that includes the fee. At or above the limit the fee is struck through and says **Free**, a green note says the limit was reached, and a green **"Free shipping" icon** sits over the corner of the **Checkout** button.
* **Checkout:** the same fee line and the total with the fee. **Order page:** the fee that was charged.
* **Order confirmation email and PDF receipt:** a "Shipping fees" line before the total (English and Arabic).
* With the rule off, or a server that has not been updated, none of it appears.

## What an admin sees
Settings > **Free shipping**: a switch, "Free shipping from" (USD, on the order total after discounts), "Shipping fee below the limit" (USD), a live preview ("A basket of $25.00 pays $5.00 shipping (total $30.00). A basket of $50.00 or more ships free.") and Save. It checks the amounts before saving (up to two decimals; both above 0 when it is on); the server checks them again.
Every change is recorded in the audit log with the before and after.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip, replacing files. Then, in this order:
```
node scripts\patch-free-shipping.js
node scripts\patch-free-shipping.js --write
node scripts\patch-free-shipping-admin.js
node scripts\patch-free-shipping-admin.js --write
node scripts\patch-free-shipping-web.js
node scripts\patch-free-shipping-web.js --write
```
1. **Run migration 111** (`services\api\db\migrations\111_free_shipping.sql`, a new file in this package: it only adds the column `orders.shipping_fee`, default 0) with your usual migration step. **Then restart the backend.**
2. The **admin** patch needs the server patch and its migration (or the card says it cannot load). The **website** patch needs the server patch too. Run the website patch AFTER the other storefront patches (the cart page is the one from `patch-product-cars.js`).
3. Each patch saves every file it changes as `<file>.before-free-shipping...`, says "already" if run twice, and changes NOTHING if a line it needs is missing.

### Optional (recommended) patch
```
node scripts\patch-free-shipping-refunds.js
node scripts\patch-free-shipping-refunds.js --write
```
* `patch-free-shipping-refunds.js`: when a faulty part is refunded, the amount SUGGESTED is worked out from what the buyer paid for the GOODS, so a share of the shipping fee is not refunded by default (the admin can still refund more, up to the whole order total).

## Turning it on
Settings > Free shipping > switch on, enter the limit (for example 50.00) and the fee (for example 5.00), Save. It applies to new baskets and orders at once (a cart is refreshed each time the buyer changes it; the public setting may take up to 30 seconds to reach a page already open).

## Notes and limits
* The **mobile app** is a separate package (its cart and checkout screens and its search bar).
* The payment step charges the amount the client sends: the website and the app both send a total that INCLUDES the fee.
* The Arabic wording (رسوم الشحن, مجاني, "أضف … للحصول على شحن مجاني", "وصلت إلى …: الشحن مجاني", شحن مجاني) should be read by a native speaker.
* The admin **Orders** page shows only each order's total (which includes the fee); it has no breakdown to extend.

## Tests
Server: `node --test --test-concurrency=1 test/freeShipping.test.js test/freeShippingRefunds.test.js test/orderEmailShipping.test.js` (in `services\api`; needs migration 111; the receipt test skips itself in a copy without the receipt logo and fonts).
Admin: `npx vitest run src/FreeShippingSection.test.jsx src/freeShippingApi.test.js`. Website: `npx vitest run lib/cartShipping.test.ts components/FreeShipping.test.tsx components/CartProviderShipping.test.tsx app/cartShipping.test.tsx app/orderShipping.test.tsx`.
`scripts/break-check-order-vehicles.py frserver | fradmin | frwstorefront` break the code on purpose (31, 13 and 21 ways) and expect the tests to fail.
