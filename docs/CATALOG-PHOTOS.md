# Real photos for the catalog (62 sections, 731 parts)

## What changed
The Categories page of the admin portal has a fourth tab, **Photos**:
1. **Where we are**: how many sections and parts have a real picture (the rest show the "photo coming soon" tile), how many pictures are still to make (793 in all: 62 sections and 731 parts), a line for each section, and two buttons:
   **Download the shot list** (everything, or only what is missing).
2. **Import pictures**: choose pictures named by their code, look at the **preview** (every picture has a status), press **Import**. Nothing is saved before that.
3. **Earlier imports**: the last 5 imports, each with **Undo**.
4. **Until a picture is ready** (a switch, OFF at first): show the first photo of the best-rated live product for a section or part that has no picture yet.

## The shot list
A spreadsheet to hand to whoever makes the pictures (a designer, a photographer, or an image-generating tool). One row for every picture needed: the 62 sections first, then the parts. Parts that are only different sizes of one
thing (Engine Oil 1 L / 4 L / 5 L) share ONE row ("Applies to codes") and one picture. Each row has: the file name (the code), the names in English, Arabic and Chinese, what to show, and a ready-to-use prompt in one common style.
**Priority 1** = sections, **2** = parts that already have live products, **3** = the rest. A second sheet, "How to use", repeats the rules below.

## Making the pictures (what I suggest)
* One object, three-quarter view, soft studio light, plain light background (EEF2F6), no brand, no text. The same look for all 793 matters more than detail: they are shown between 40 and 72 pixels wide.
* At least 800 x 800 pixels (the import needs 400 x 400 at the very least). JPG, PNG or WebP. A transparent background becomes white.
* **Name each file by its code**: `BRK.jpg` for a section, `BRK-001.jpg` for a part. Capitals or small letters, `_` for `-` are all fine. For parts that share a picture, name it after the FIRST code of the row.
* Have someone who knows car parts check every picture before importing: an image tool can draw a part with the wrong shape or the wrong number of bolts. Use a tool whose terms allow commercial use, and never copy pictures from other websites.

## Importing
1. Admin portal > Categories > **Photos** > **Choose pictures**. Select all the pictures of the folder at once (Ctrl+A in the file window). There is no ZIP: choosing the files themselves needs nothing to install.
2. The browser reads each picture, cuts its centre square and saves it at 512 x 512 (so start from square pictures when you can). The preview shows each with a status: **new**, **replaces a picture**, **has a picture: kept**, **no such code**,
   **name is not a code**, **not a picture**, **too small**, **same code twice**. "also BRK-001, BRK-003" means the picture is shared by those sizes.
3. By default a section or part that already has a real picture is left alone. Tick "Replace pictures that are already real" to change them.
4. Press **Import**. They are sent 20 at a time; the shop checks every one again. A problem is shown for its own picture and the others are still saved.
5. **Undo**: under "Earlier imports". It puts back what each item had before (a replaced picture comes back; a picture that someone changed since is left as it is) and deletes the pictures nobody uses any more.
   Only the last 5 imports can be undone. The website shows new pictures within about a minute.

## The switch
Off: the "photo coming soon" tile. On: for a section or part with no picture, the website shows the first photo of its best-rated live product. It only changes what shoppers see; the numbers on this page still count real pictures only,
and the admin screens still show the placeholder. The pictures of products differ in style, and a supplier's photo can carry a logo, so leave it off unless you prefer it to the tile.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-footer.js`:
```
node scripts\patch-catalog-photos.js
node scripts\patch-catalog-photos.js --write
```
It changes three existing files (the catalog admin routes, the public catalog routes, and the Categories page's tabs), saves each as `<file>.before-catalog-photos`, says "already" if run twice, and if ANY file is not what it expects it changes
NOTHING (send that file to the Leap team). **No migration and nothing to install** (the shot list uses the spreadsheet library the catalog import already uses).
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront as before.

## Notes
* The list of earlier imports is kept in the platform settings (no new table).
* Pictures are saved like product photos (cloud storage when it is set up, otherwise the uploads folder). 793 pictures of about 40 KB is about 30 MB.
* Not covered: the mobile app shows whatever picture the shop gives it, so it follows, but I have not tested it.
* Tests: server `node --test test/catalogPhotos.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/CatalogPhotosPanel.test.jsx src/photoPrep.test.js src/CategoriesPhotosTab.test.jsx`.
  `scripts/break-check-order-vehicles.py cpserver|cpadmin` breaks the code on purpose (51 ways) and expects the tests to fail.
