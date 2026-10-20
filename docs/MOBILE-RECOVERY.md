# Mobile app: undoing what leap_garage_versions.zip replaced, and applying only its edits

## What went wrong
`leap_garage_versions.zip` contained five mobile files as WHOLE files, made from my copy of the project. Your project has mobile features my copy never had (for example `lib/widgets/customer_photos_section.dart`, which calls `ApiClient().fetchReviewPhotos`, and something that calls `fetchSameModelProducts`). Replacing `api_client.dart` removed those methods from it, so `flutter analyze` now reports them as undefined. The same zip, and `leap_garage_limit.zip` before it, also replaced `app_strings.dart`, `server_messages.dart` and `garage_screen.dart`, which may have lost texts and messages that your newer screens use (the analyzer cannot see that: it shows up as raw keys on screen). The fix is to put YOUR versions back and apply only my edits to them. The zip has been corrected (it no longer contains those five files), and from now on shared files are changed by edits, never replaced.

## Steps
1. **See what is different.** In PowerShell:
   ```
   cd D:\LEAP-MARKETPLACE
   git status --short apps/mobile
   git log --oneline -8 -- apps/mobile/lib/services/api_client.dart
   ```
2. **Put your versions back.** Choose the last commit BEFORE you extracted `leap_garage_versions.zip` (for the three files from `leap_garage_limit.zip` you may need one before that zip: look at `git log --oneline -8 -- apps/mobile/lib/core/app_strings.dart` and pick the last commit that still had your newer texts, for example one that contains `customer_photos`):
   ```
   git checkout <commit> -- apps/mobile/lib/services/api_client.dart apps/mobile/lib/models/vehicle.dart apps/mobile/lib/features/garage/garage_screen.dart apps/mobile/lib/core/app_strings.dart apps/mobile/lib/core/server_messages.dart
   ```
   Without git, restore those five files from any earlier copy of your project (a backup, a zip of the project).
3. **Apply only my edits to them.** First look, then do it:
   ```
   node scripts\patch-mobile-versions.js
   node scripts\patch-mobile-versions.js --write
   ```
   The first command changes nothing and says, for each file, how many edits it needs. A file in which an edit cannot be placed is never touched: it is reported so the edit can be made for your version of it (send me that file and the output). With `--write`, the original of each changed file is kept next to it as `*.before-garage-versions.bak`.
4. **Check.**
   ```
   scripts\check-mobile.cmd
   node scripts\check-app-texts.js
   ```
   `check-mobile` should now report only the errors that were already there before (the old `add_vehicle_screen.dart`, and the two scanner screens whose packages are not in `pubspec.yaml`). `check-app-texts` lists any text the app asks for that `app_strings.dart` does not have: those must be restored from the earlier version of the file.

## The old errors that are not from my work
- `lib/features/garage/add_vehicle_screen.dart`: an old screen nothing uses; delete it.
- `lib/features/catalog/barcode_scanner_screen.dart` and `part_number_scanner_screen.dart`: they need the packages `mobile_scanner` and `google_mlkit_text_recognition`, which are not in `pubspec.yaml`, and nothing uses these screens either. Either add the packages (`flutter pub add mobile_scanner google_mlkit_text_recognition`) if you want the scanners, or delete the two files.

## The website and the server
The same zip also replaced some website and server files as whole files. If your website or server has features my copy never had, check:
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
npx tsc --noEmit
```
It must print nothing. An error like "has no exported member" or "is not assignable to DictKey" means a whole-file replacement removed something: restore that file from git the same way and send me the file so I can make my changes to it as edits.
