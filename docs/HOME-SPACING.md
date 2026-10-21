# Home page: half the space between the blocks

The space above **Shop by section**, **Shop by brand** and **Newest parts** (so: between the four totals and Shop by section, between Shop by section and Shop by brand, and between Shop by brand and Newest parts)
is now 32 px instead of 64 px, on a computer and on a phone. The space under the headline (above the four totals) is unchanged.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Run it AFTER `scripts\patch-product-page.js`:
```
node scripts\patch-home-spacing.js
node scripts\patch-home-spacing.js --write
```
It changes one file (`apps\web-storefront\app\page.tsx`), saves it as `page.tsx.before-home-spacing`, says "already" if run twice, and changes nothing if the file is not what it expects. No restart of the backend is needed;
restart the storefront (`rmdir /s /q .next` then `npm run dev -- -p 3001` in `apps\web-storefront`).

If you would rather have a different amount, tell me: it is just the number in `pt-8` (8 = 32 px, 6 = 24 px, 10 = 40 px).
