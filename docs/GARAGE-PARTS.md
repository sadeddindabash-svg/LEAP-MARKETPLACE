# Mobile app: "View compatible parts" now opens the parts that fit

**I cannot run Flutter, so this has not been run on a device.** The plain-Dart parts are tested (17 tests, 15 deliberate breaks all caught); the screen was only checked for syntax. Please run `flutter analyze` and `flutter test` and try it. If `flutter analyze` prints anything about the new files, send it to me.

## The problem
In My garage, "View compatible parts" only closed the garage page and handed the chosen car back to whoever had opened it. The garage is opened from Account > My garage and from the home "Shopping for" card, and neither uses that answer, so nothing seemed to happen.

## What changed
* The button opens a new **"Parts for your car"** screen for THAT car (the garage entry whose button you pressed): the car and its version at the top with a **Change** link (back to the garage), "42 parts fit this car", **category chips** (All, Brakes, ... with counts; shown when there is more than one category), and the app's normal product cards (each opens its product page).
* A car with no matching parts shows "No parts fit this car yet." A failed load shows the usual message with Retry. Arabic is mirrored and uses the Arabic car names.
* **No server change:** it uses the filter the app already has (the car's generation and year).
* If the screen is ever opened without a car it shows the garage instead.

## Apply (from D:\LEAP-MARKETPLACE)
```
node scripts\patch-garage-parts.js
node scripts\patch-garage-parts.js --write
cd apps\mobile
flutter analyze
flutter test test\vehicle_parts_filter_test.dart test\vehicle_parts_wiring_test.dart
flutter run --release -d YOUR-PHONE-ID --dart-define=API_BASE_URL=http://YOUR-ADDRESS:PORT
```
The patch changes 3 files (`core\app_strings.dart`, `features\garage\garage_screen.dart`, `app.dart`), saves each as `<file>.before-garage-parts`, says "already" if run twice, changes NOTHING if a line it needs is missing, and handles Windows line endings. New files come from the zip (`lib\models\vehicle_parts_filter.dart`, `lib\features\garage\vehicle_parts_screen.dart` and two tests); no new package is needed.

## What to look at on the phone
My garage > press **View compatible parts** on a car: the new screen opens with that car's parts; press a chip; open a part; press **Change**. Try each car if you have two.

## Known limits
* The new screen uses `ProductCard`, `productCardHeightFor` and `ProductGridSkeleton` exactly as the category screen does, but I could not see those widgets' own files.
* The category chip names are shown as stored (underscores become spaces, first letter capital); they are not translated.
