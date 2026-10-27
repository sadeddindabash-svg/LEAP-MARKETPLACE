# "Shopping for" beside the menus, like the mobile app

## What changed on the website
* The **thin bar under the menus is gone**. The **"Shopping for" container** now sits at the **end of the menu row** (after Home, Products, Find a part, Sections; at the left end in Arabic), 40 px high inside the 48 px row, so the row does not grow.
* It looks like the app's card: the small label **"Shopping for"**, the car in a **dark chip** (**"BYD Seal DM-i · 2024"**, plus the version when the car has one: "AITO M5 · 2022 · AWD Flagship"), and the **car's picture in an angled panel**
  (mirrored in Arabic). The picture is the car's **version photo, else its year photo, else its brand photo**; a photo that cannot be loaded is skipped (the next is tried), and with none a plain car icon is shown.
* It is shown to **everyone**, like the app: with **no saved car, or signed out, it says "Add a vehicle"** (Arabic: أضف مركبة). The car is the buyer's **default car** (as in the app).
* **The whole container opens My garage** (as the app's card does). The separate "Change" link is gone, and the chip no longer opens the parts search for that car: that search stays available through **Find a part** and the **"Fits my car"** switch.
* **A name that is too long** for the space is cut with "…" on **one line** (it never wraps and never widens the menu row); the **full text** is in the tooltip and in the accessible name (what a screen reader reads).
* **Phones and narrow screens (below 1024 px):** the container keeps its **own row under the menu**, with the same look.
* While the page is still finding out who is signed in and what is in the garage, the container is an **empty box of the same size** (no words), so a signed-in buyer never sees "Add a vehicle" for a moment and the page does not jump.
* No server change.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run (any time after `patch-product-page.js`; the order with the other patches does not matter):
```
node scripts\patch-shopping-for.js
node scripts\patch-shopping-for-tests.js
```
The first line only says what it would change. Add `--write` to each to apply: `node scripts\patch-shopping-for.js --write`, then `node scripts\patch-shopping-for-tests.js --write`.
* `patch-shopping-for.js` changes three storefront files (`components\VehicleBar.tsx` is replaced, `components\SiteHeader.tsx` and `lib\i18n.ts` get small edits), saves each as `<file>.before-shopping-for`, says "already" if run twice, and if a file is not what it expects it changes NOTHING.
* `patch-shopping-for-tests.js` is **optional** and separate: it replaces the four old tests of the thin bar in `components\stage1b-providers.test.tsx`, which describe the behaviour that was changed on purpose. Without it, those four tests fail (the website itself is not affected).
**No migration, nothing to install, no backend change.** The storefront reloads by itself (or restart it with the commands in `docs\FONT-FIX.md`).

## Notes
* The Arabic words ("التسوق لسيارة", "أضف مركبة") are the mobile app's own.
* Many brands have no photo yet, so many cars will show the car icon until the admin adds photos (Vehicle data: brand, year or version photos).
* Tests: `npx vitest run components/VehicleBar.test.tsx components/siteHeaderVehicle.test.tsx components/stage1b-providers.test.tsx` (in `apps\web-storefront`).
  `scripts/break-check-order-vehicles.py sfstorefront` breaks the code on purpose (23 ways) and expects the tests to fail.
