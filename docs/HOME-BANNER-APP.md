# Home banner in the mobile app

## What it is
The same advertisement banner as the website's home page, in the app: **above the "Shopping for" card** (under the search bar). It uses the **same photos, seconds, links and the same switch** as the website: when the admin chooses "The banner" in Admin > Settings > Home banner, the app shows it; when the admin chooses
"The headline and sub-headline", the app shows nothing (and takes no space). It also shows nothing, without any error, if the server cannot be read.

* **Language:** the English photo in English, the Arabic photo in Arabic (the other one when a language has none). The slides move the other way in Arabic, like the website.
* **Each photo stays for its own seconds**, then the next slides in; it goes round for ever. A finger on it holds it; it holds while the app is in the background and when the phone is set to reduce animation (a swipe still works).
* **Dots** show which photo it is.
* **A tap** opens what the admin set: a **part** (the app's product screen), a **category** (the category screen) or a **web page** (the phone's browser). A photo with no link is not tappable.
* The photos are 5 : 2, full width, with rounded corners.

## IMPORTANT: written without being run on a phone
My workspace has no Flutter, so the **widget has never run**. What I could do: the banner's data logic (`lib/models/home_banner.dart`) is plain Dart and **its 13 tests were run** (with Dart 3.13) and checked by 12 deliberate breaks;
the widget and the edited home screen **parse**, and the widget **type-checks against stand-ins** of the Flutter classes it uses (not the real framework). So expect that something may need a small fix: please try it and tell me what you see.

## Apply (from D:\LEAP-MARKETPLACE)
1. Unzip, replacing files. (The backend must already have the website's banner package, `leap_home_banner.zip`: the app reads the same server address.)
2. Add the one package the banner needs (this changes your `pubspec.yaml`; I did not edit it myself because my copy of it is older than yours):
```
cd D:\LEAP-MARKETPLACE\apps\mobile
flutter pub add url_launcher
cd D:\LEAP-MARKETPLACE
```
3. Add the banner to the home screen (two small edits in `apps\mobile\lib\features\home\home_screen.dart`; the file is saved as `home_screen.dart.before-home-banner-app` first; "already" if run twice; if the file is not what the patch expects it changes NOTHING and says so):
```
node scripts\patch-home-banner-app.js
node scripts\patch-home-banner-app.js --write
```
4. Check it:
```
cd D:\LEAP-MARKETPLACE\apps\mobile
flutter pub get
flutter analyze
flutter test test\home_banner_test.dart
flutter run
```
**If `flutter analyze` prints anything about these files, copy it to me: it is almost certainly a small slip.**

## Try it on the phone
1. In the admin portal choose "The banner" (with at least one photo): the app's home shows it above "Shopping for" (pull down to refresh the other parts; the banner itself is read when the home screen opens, and the server keeps it for up to 30 seconds).
2. Choose "The headline": the banner is gone and nothing is left empty.
3. Switch the app to Arabic: Arabic photos, sliding the other way.
4. Tap a photo with a part link, a category link and a web link.
5. Hold a finger on it: it stops; let go: it carries on. Turn on "remove animations" in the phone's settings: it no longer slides by itself.

## Notes
* Android and iOS need no extra permission or setting for opening web pages in this way.
* The banner is not re-read by pull-to-refresh (only when the home screen opens). Tell me if you want that.
* Tests: `flutter test test\home_banner_test.dart`. Not covered by any test: the widget on a phone.
