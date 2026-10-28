# Mobile app: a part that fits many vehicles (product screen)

**I cannot run Flutter, so this has not been run on a device.** The plain-Dart parts are tested (22 tests, 17 deliberate breaks all caught); the screen and widget were only checked for syntax. Please run `flutter analyze` and `flutter test` and try it. If `flutter analyze` prints anything about the new files, send it to me.

## The problem
The product screen's Technical Specifications showed ONE brand, model and year (the first car in the fitment list) for a part that fits many vehicles, exactly like the website did.

## The strategy (the same as the website, drawn in the app's own style)
* **One "Fits" row** replaces the Brand / Model / Year rows: every MODEL the part fits with its years as ranges ("BYD Seal  2022–2024", "BYD Dolphin  2023", "Toyota Camry  2020–2022").
* **Three lines to start with**, then **"+2 more models · 11 vehicles in all"**: pressing it opens the whole list, and "Show fewer" closes it.
* **A part with no fitment at all** says "Universal: fits all vehicles".
* **An older server** (it sends no list) keeps the three old rows exactly as before. If the server could not read the fitment it also sends no list, so an error never looks like "universal".
* Arabic: the Arabic model names, the Arabic words, and the row mirrors.
* The alternating row fill, the 110 px label and the colours are the same as the other rows.

## Needs the server part first
The server must send the grouped list: it comes with `patch-multi-fit.js` (package `leap_fitment_and_garage.zip`; restart the backend after it). Without it the app keeps the old rows.

## Apply (from D:\LEAP-MARKETPLACE)
```
node scripts\patch-app-fits.js
node scripts\patch-app-fits.js --write
cd apps\mobile
flutter analyze
flutter test test\fit_group_test.dart test\app_fits_wiring_test.dart
flutter run --release -d YOUR-PHONE-ID --dart-define=API_BASE_URL=http://YOUR-ADDRESS:PORT
```
The patch changes 3 files (`models\product.dart`, `features\catalog\product_screen.dart`, `core\app_strings.dart`), saves each as `<file>.before-app-fits`, says "already" if run twice, changes NOTHING if a line it needs is missing, and handles Windows line endings. It can be run before or after `patch-garage-parts.js`. New files come from the zip (`lib\models\fit_group.dart`, `lib\widgets\fits_spec_row.dart` and two tests). No new package is needed.

## What to look at on the phone
Open a part that fits several vehicles: the Technical Specifications has one **Fits** row; press "+N more models" to open it and "Show fewer" to close it. Then a part with no fitment (Universal), and Arabic.

## Known limits
* Not run on a device (see the top). The widget uses the same palette fields as the neighbouring rows (`palette.chalk`, `.line`, `.muted`, `.ink`, `.signal`).
* The product header chip: the app's product screen has no "FITS ..." chip (the website does), so there was nothing to change there.
* The Arabic wording should be read by a native speaker.
