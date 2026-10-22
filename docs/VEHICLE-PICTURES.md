# Vehicle import: use the latest pictures of the file, and remove the old ones

## What was wrong
* The vehicle import (Vehicle Data > Import from Excel) in its normal mode **skips every version that already exists**, so a newer picture in the file was thrown away.
* Even in "update" mode the new picture replaced the old one in the database, but **the old picture file stayed on the server for ever**. Every re-import left unused pictures behind.

## What changed
1. **A new choice on the import screen: "Use the pictures in this file for vehicles that already exist (the old pictures are removed)"**, ticked by default.
   * A version that already exists keeps all its other details; only its picture is replaced by the one in the file. A row with no picture in the file keeps the picture it has.
   * The check (nothing is saved) shows a new tile, "pictures replace old ones", and each such row says "only its picture is replaced (the old picture is removed)".
   * In "Update rows that already exist" mode this is always on (the box is ticked and cannot be changed).
2. **The old picture is deleted** after the import is saved, unless something else still uses it (another version, a product, a setting...). If the import fails or the file has a problem, nothing is replaced and nothing is deleted.
   The finished import says "N old pictures were removed from the server."
3. **A card "Pictures nothing uses"** at the bottom of the import screen, for the old pictures that earlier imports already left behind:
   * **Check for unused pictures** only looks: it says how many there are and how big they are.
   * **Remove them** asks "Remove N pictures for ever? This cannot be undone." and only then deletes.

## How "unused" is decided (so you can trust it)
A picture file is unused when its name appears **nowhere in the database** (any table, any text, any list). Only files with the random names the portal gives pictures (32 letters and digits + .jpg/.png/.webp) are ever considered: the
placeholders, logos and any other file are never touched. A file **younger than a day** is left alone (it may belong to a form someone is filling in). The server looks again at the moment of removing, never trusting an earlier list. The audit
log is not counted as "using" a picture (it only remembers what happened). Only the admin may use it.

**Before the first cleanup on your real server, copy the `services\api\uploads` folder somewhere safe** (a backup costs nothing). Do not run it if the same uploads folder is shared with another system that has its own database (for
example a test copy next to the real one): the cleanup only knows the database it is connected to. Pictures in cloud storage are not covered.

## What I checked on your real file
`ARCFOX.xlsx` (150 rows, 105 pictures), through the real screen in a real browser: first import = 150 versions and 105 pictures. Then a copy of the file with all 105 pictures changed:
* option OFF: "Nothing to import: every row already exists" (the old behaviour: the new pictures ignored);
* option ON: 105 pictures replace old ones; after the import the database pictures are exactly the ones of the new file, **none of the old pictures is left on the server**, and the number of picture files did not grow;
* the cleanup found and removed old unused pictures, left a picture younger than a day alone, and every picture the database uses was still there.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-catalog-photos.js`:
```
node scripts\patch-vehicle-pictures.js
node scripts\patch-vehicle-pictures.js --write
```
It changes four existing files (the vehicle import's plan and routes, the admin's shared `auth.js`, and the import screen), saves each as `<file>.before-vehicle-pictures`, says "already" if run twice, and if ANY file is not what it expects it changes
NOTHING (send that file to the Leap team). **No migration and nothing to install.**
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`.

## Use it
* Vehicle Data > Import from Excel: choose the file, leave the box ticked, **Check file**, read the "pictures replace old ones" tile, **Import**.
* At the bottom of the same screen: **Check for unused pictures**, and if the list looks right, **Remove them**.

## Notes
* A file that lists the same version twice is refused, as before.
* Tests: server `node --test test/vehiclePictures.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/VehicleImportPictures.test.jsx src/UnusedPicturesCard.test.jsx src/unusedPicturesApi.test.js`.
  `scripts/break-check-order-vehicles.py vpserver|vpadmin` breaks the code on purpose (29 ways) and expects the tests to fail.
