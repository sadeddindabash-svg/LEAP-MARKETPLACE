# My Garage with versions: choose brand, model, year and VERSION

Whole files in `leap_garage_versions.zip`. **Apply it after `leap_vehicle_data_stage2.zip`** (it contains `fitment/routes.js` with the Excel import line, and the later versions of `lib/api.ts`, `lib/i18n.ts` and the others). If you changed any of these files by hand since, apply the edits below by hand instead of overwriting.

## What a buyer sees
- **My garage > Add a car:** after Brand, Model and Year there is a fourth step, **Version**, when the chosen year has versions. Each option reads "AWD Flagship · engine · 5 seats" (Arabic on the Arabic site). Choosing one shows a preview (photo, name, engine, seats). The Add button stays off until a version is chosen. A year without versions works exactly as before.
- **Add by VIN** asks for the version too, when the found car's year has versions.
- **The saved car** shows its version, engine and seats; its picture is the version's photo, else the year's, else the brand's. The "Shopping for" bar shows the version.
- **Two versions of the same year are two cars** (also for the 5-car limit). Make default and Remove act on that exact car.
- **Cars saved before this** keep working. If their year now has versions they show "No version chosen" and "Choose its version" (once; to change a version, remove the car and add it again).
- **Not changed (as decided):** the home page picker, search filter, Find a part and part requests still stop at the year. Parts are matched by year: the version does not change which parts are shown.
- **Mobile app:** the same: the version list appears when adding a car whose year has versions; cards show version, engine and seats; "Choose its version" for older cars. **Written but NOT compiled or run** (no Flutter here): run `flutter analyze` and `flutter test` (new test: `test/vehicle_version_test.dart`). `features/garage/add_vehicle_screen.dart` already called `addVehicleToGarage` with the wrong arguments before this change and was not touched: if `flutter analyze` reports it, that is old.

## After applying
1. **Back up the database**, then in `services\api` run `node db\migrate.js` (migration 107). It adds `user_saved_generations.version_id` and **replaces the table's old uniqueness rule** (whatever primary key or unique rule it had, found by looking) with one that includes the version.
2. Restart the backend and the storefront. Press Ctrl+F5.

## Server (`services/api`)
- NEW `db/migrations/107_saved_cars_version.sql`.
- `src/modules/garage/routes.js`: a saved car is generation + year + version. `POST /garage/me` takes `versionId`: required when the year has versions ("Choose the version of this car"), refused when it belongs to another year, not accepted for a year without versions. `PATCH .../default` and `DELETE ...` take `?versionId=`. NEW `PATCH /garage/me/:generationId/:year/version` `{versionId}` for an older car. The answer carries `versionId`, `version {id,name,nameAr,engine,engineAr,seats,photoUrl}` and `versionCount`.
- `src/modules/fitment/routes.js`: deleting a version in Vehicle Data keeps buyers' cars as year-only cars, removes a duplicate if they already had that car without a version, and gives a buyer a default car again if theirs was removed. (It also keeps stage 2's line `router.use('/import', ...)`.)

## Website (`apps/web-storefront`)
`lib/api.ts`, `lib/garage.ts`, `lib/i18n.ts`, `lib/serverMessages.ts`, `components/GarageProvider.tsx`, `components/VehicleCascade.tsx` (new optional `withVersions`, used only by the garage page and the VIN save), `components/FindTools.tsx`, `app/garage/page.tsx`. The cascade also ignores a repeated choice of the same brand or model.
Tests: NEW `components/VehicleCascadeVersions.test.tsx`, `lib/api.garageVersions.integration.test.ts`; changed `lib/garage.test.ts`, `components/stage1b-providers.test.tsx`, `components/FindTools.test.tsx`, `app/stage1b-pages.test.tsx`. Admin side: NEW `apps/admin-dashboard/src/garageVersions.integration.test.js`.

## Arabic texts to have read by a native speaker (new)
Website: "الفئة" (Version), "اختر الفئة", "اختر الفئة لحفظ هذه المركبة", "اختر فئة هذه المركبة", "لم تُحدَّد الفئة", "حفظ الفئة"; seats "مقعد واحد", "مقعدان", "{n} مقاعد", "{n} مقعدًا". Server messages (website and app): "اختر فئة هذه المركبة", "هذه الفئة ليست من هذه السنة", "لديك هذه المركبة بهذه الفئة بالفعل", "لهذه المركبة فئة محددة بالفعل". App: the same three garage texts. I used "الفئة" for "Version" because that is the word in your AITO sheet.

## How it was checked
Real server and database, the real garage page in a real browser (17 checks: English, Arabic, a phone), the website's own functions against the real server, and 14 deliberate breaks that the tests caught. **Not run here:** the Flutter app, your full backend (two old tests that need product tables fail in my copy only), and the production build of the website.
