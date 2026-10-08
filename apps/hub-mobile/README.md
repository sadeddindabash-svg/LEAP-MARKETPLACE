# leap_hub_mobile

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## What the app does about faulty units, closed flags, replacements and passwords

The app matches the hub web portal:
- **Faulty unit (confirmed by the platform):** a red panel lists the faulty items and the supplier's **return address**; the worker chooses **return to the supplier** (photo + return tracking number required) or **discard at the hub** (photo required). Until they do, the case stays open. The platform never shows the hub anything about money. *The portal can also print a return label; on the phone the address is shown instead.*
- **Closed flags:** a flag the platform closed shows as **Closed / 已关闭** (grey), is not listed under the **Flagged** filter (it stays under **All**), and its page says nothing more is needed. Shipments that were returned to the supplier or discarded now have their own labels and banner (before, the app showed the raw word).
- **Replacements:** a free replacement for a faulty unit carries a **Replacement / 补发** tag in the queue and a banner on its page.
- **Passwords:** an account created or reset by an admin starts on a **temporary password**. The first time the worker signs in, the app asks them to **choose their own** before anything else (same rules as the portal: at least 8 characters, not the same as the temporary one). A wrong temporary password shows a message; it does not sign the worker out.

Tested: the wording table and the server's replies are checked by `apps/admin-dashboard/src/hubMobileStrings.test.js` and `hubMobileContract.integration.test.js` (which does what the app does against the real backend); the model logic by `test/widget_test.dart` (run `flutter test`). **The Dart was read and parsed with a real Dart grammar but not compiled or run**: please run `flutter analyze` and `flutter test` in `apps/hub-mobile`, then rebuild.

## The QR scan screen

`MobileScanner` (ML Kit, bundled model: no Google services needed) reads the shipment id from the QR code on the parcel label. **On the first release build the scanner failed on a Huawei phone** with "Camera error: genericError ... on a null object reference" and scrambled class names (`w4.c`, `s4.b`): Flutter shrinks and RENAMES the code of every release build (R8), and the scanner finds its own parts by their original names. `android/gradle.properties` therefore sets `shrink=false` (read by Flutter's Android plugin), so the release build keeps readable names; the cost is a somewhat larger app, irrelevant for an internal tool. If the camera still cannot start, the screen now says so in Chinese or English, shows the technical reason small, and offers **Back to the list** (search by order ID always works).

