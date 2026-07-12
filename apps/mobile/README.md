# Leap Mobile App (Flutter)

Buyer-facing app for iOS and Android. See `/docs/SRS.docx` Section 3.1 for the
full requirement list this implements, and
`/docs/prototypes/leap_mobile_prototype.jsx` for the reference UI/UX.

## Status

This is a **starter skeleton**, not a finished app: real navigation between
all core screens works, but data is placeholder/hardcoded (marked with
`// TODO` comments) until it's wired up to `services/api`.

⚠️ This code was written without access to a Flutter SDK in the environment
that generated it, so it has **not been compiled or run**. It should be
syntactically valid Dart/Flutter, but budget time for a first `flutter pub
get` / `flutter run` pass to catch anything that needs fixing before relying
on it.

## Setup

1. Install Flutter: https://docs.flutter.dev/get-started/install
2. From this folder:
   ```bash
   flutter pub get
   flutter run
   ```
3. Point the app at your local backend (see `../../services/api/README.md`
   for how to run it):
   ```bash
   flutter run --dart-define=API_BASE_URL=http://localhost:4000
   ```

## Structure

```
lib/
├── main.dart               Entry point
├── app.dart                 Router + bottom-nav shell
├── core/
│   ├── theme.dart            Brand colors/theme (matches the prototypes)
│   └── config/app_config.dart  Launch markets, API base URL, feature flags
├── models/                  Vehicle, Product, Order — mirror SRS data entities
├── services/api_client.dart  HTTP client wrapper for services/api
├── widgets/                  Shared components (PlateChip, StatusBadge)
└── features/
    ├── home/                Home + category grid
    ├── garage/               Saved vehicles / YMMT fitment selector
    ├── catalog/              Category browse + product detail
    ├── cart/                 Basket (grouped by supplier)
    ├── checkout/             Checkout, incl. guest-checkout toggle
    ├── orders/               Order history + tracking
    ├── account/              Profile / garage / addresses / support entry
    └── support/              Buyer ↔ Platform chat (no supplier contact)
```

## Next steps to make this real

1. Add a state management layer (Provider is already a dependency) for
   active vehicle, cart contents, and auth session.
2. Replace placeholder data in each screen with real `ApiClient` calls once
   `services/api` has working endpoints.
3. Swap the placeholder launch markets in `core/config/app_config.dart` for
   the real Phase 1 country list.
4. Add `flutter_test` widget tests per screen before this grows further.
