# Home page banner (website, admin portal and server)

## What it is
Beside the **"Find parts for your car"** box the home page shows **either**
* the headline and sub-headline (as today), **or**
* a **banner** of up to **10 advertisement photos**, the same size as the box, that **slides by itself**.
One switch in the admin portal decides; **never both**. If "Banner" is chosen but no slide has a photo yet, the headline is shown (never an empty space). The page keeps its hidden `h1` for search engines either way.

## In the admin portal: Settings > "Home banner"
* **"The home page shows":** The headline and sub-headline / **The banner**. It is saved the moment you choose.
* **Add a slide** (up to 10). Each slide has:
  * **an English photo and an Arabic photo.** The English site shows the English one, the Arabic site the Arabic one. If only one language has a photo, it is used on both sites.
  * **Seconds on screen** (a whole number from 2 to 30; a new slide starts at 5). Each photo has its own.
  * **Where the photo leads:** nothing / **a part** (search it by name or number) / **a category** / **a web page** (a full https:// address; it opens in a new tab).
  * **A description of each photo** (optional, 140 characters): read aloud to people who cannot see the picture.
  * ▲ ▼ to change the order, **Remove slide** (it asks first and deletes the photo files too).
* **Photos:** choose a picture of **at least 1000 × 400 px** (JPG, PNG or WebP); a window lets you **drag and zoom** the wide frame (5 : 2) to choose the part you want; it is saved at **1250 × 500 px**. Keep the important words in the middle: the frame is wide, and on a phone the same photo is shown at the same shape.
* **Save changes** saves a slide's seconds, link and descriptions (photos and the switch save at once). The website shows a change within about a minute (about 30 seconds on the server plus the website's own short wait).

## What visitors get
* Each photo stays for **its own seconds**, then the next slides in from the right (from the left in Arabic), round and round.
* It **holds still** while the mouse is over it, while something in it has the keyboard focus, while a finger is on it, and while the browser tab is in the background. Someone whose device is set to **reduce animation** gets no automatic sliding (the dots and arrows still work).
* **Dots** (and arrows when the mouse is over it) appear when there is more than one photo; a **swipe** changes the photo.
* On a **phone** the banner is the same shape (5 : 2), full width, **above** the finder box (the headline was above it too).
* A photo with a link is a link: a part page, the search of a category, or the web page.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-search-sticky.js` (the banner uses its slide timing):
```
node scripts\patch-home-banner.js
node scripts\patch-home-banner.js --write
```
It changes five existing files (the platform settings routes, and in the storefront the home page, `lib\api.ts` and `lib\i18n.ts`, and in the admin portal `App.jsx`), saves each as `<file>.before-home-banner`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
**No database migration, nothing to install.**
3. Restart the backend: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, **and start the storefront again** (commands in `docs\FONT-FIX.md`). The admin portal reloads by itself.

## Notes
* **The card cannot take Settings down.** It checks what the server answers before using it (for example an older backend that was not restarted): if the answer is not what it expects, the card says so and tells you to restart the backend; and a safety net around the card means that even an unforeseen failure shows only a small message in the card, while the rest of Settings stays.
* **Order of patches:** it does not matter whether you apply this patch before or after `patch-product-parity.js` (both orders were tested on clean files).
* **The mobile app is a separate package** (the banner above "Shopping for"); it will use the same slides, photos, links and switch.
* The Arabic words of the arrows and dots ("الصورة السابقة", "الصورة التالية", "الانتقال إلى الصورة n") are mine: please have a native speaker check them.
* Tests: server `node --test test/homeBanner.test.js` (in `services\api`, a database whose name ends in `_test`); storefront `npx vitest run lib/homeBanner.test.ts components/HomeBanner.test.tsx app/homeBanner.test.tsx`; admin `npx vitest run src/HomeBannerSection.test.jsx src/bannerCrop.test.js src/homeBannerApi.test.js`.
  `scripts/break-check-order-vehicles.py hbserver|hbstorefront|hbadmin` breaks the code on purpose (71 ways) and expects the tests to fail.
