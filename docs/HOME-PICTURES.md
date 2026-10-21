# Pictures for the four home page tiles (Parts, Brands, Models, Countries)

## What it does
* **Admin portal, Settings page:** a new "Home page pictures" card beside "Home page announcements". For each of Parts, Brands, Models and Countries: **Choose picture** (or **Replace** / **Remove**).
  After choosing a file a crop window opens: drag the picture (or use the arrow keys) and zoom with the slider to choose the square; **Use this crop** saves it at 600 x 600.
  A picture must be at least 400 x 400 px (JPG, PNG or WebP); smaller ones are refused with their size. Remove asks first.
* **Storefront home page:** a tile with a picture shows it (72 x 72 px, square); a tile without one keeps its icon. Changes show within about a minute, in English and Arabic.
* **Server:** `GET /platform-settings/home-pictures` (public) and `PUT` / `DELETE /platform-settings/home-pictures/:slot` (admin only). The server re-checks every upload: a real JPEG/PNG/WebP, not over 10 MB, and
  EXACTLY 600 x 600 px. Replacing or removing a picture also deletes its old file. Two admins changing different pictures at the same moment cannot overwrite each other.
* **Starter pictures:** the folder `home-picture-starters` has four 600 x 600 pictures (parts.jpg, brands.jpg, models.jpg, countries.jpg) in the same style as the section icons. They are NOT loaded for you: choose them
  in the new card if you want them (they are simple illustrations: real photos will look better). The brand badges are generic, not real logos.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-ui-columns.js`:
```
node scripts\patch-home-pictures.js
node scripts\patch-home-pictures.js --write
```
It changes five existing files (the platform settings routes, the storefront's api.ts and home page, one existing home page test, and the admin portal's App.jsx), saves each as `<file>.before-home-pictures`,
says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team). **No migration** (the pictures use the existing platform settings table).
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront in its own window (`cd D:\LEAP-MARKETPLACE\apps\web-storefront`, then `npm run dev -- -p 3001`).

## Check it
* Admin portal -> Settings -> "Home page pictures": choose a big picture for Models, crop it, "Use this crop". Open the storefront home page: the Models tile shows it (wait up to a minute, then refresh).
* Remove it: the icon comes back. Try a tiny picture (refused with its size) and a text file (refused).

## Notes
* Pictures are kept like every other photo (cloud storage if you have configured it, otherwise the uploads folder).
* Tests: server `node --test test/homePictures.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/HomePicturesSection.test.jsx src/homePictureCrop.test.js`;
  storefront `npx vitest run app/homePictures.test.tsx app/pages-i18n.test.tsx app/homeLazy.test.tsx`. `scripts/break-check-order-vehicles.py hpserver|hpadmin|hpstorefront` breaks the code on purpose (24 ways) and expects the tests to fail.
