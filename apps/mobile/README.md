# Leap Mobile App (Flutter)

Buyer-facing app for iOS and Android. See `/docs/SRS.docx` Section 3.1 for the
full requirement list this implements, and
`/docs/prototypes/leap_mobile_prototype.jsx` for the reference UI/UX.

## Status

Real navigation between all core screens works. **Authentication is now
real** — signup, login, and session persistence all call the actual
backend (`services/api`), not placeholders. Catalog/order/cart data is
still placeholder/hardcoded (marked with `// TODO` comments) pending
further wiring.

⚠️ This code was written without access to a Flutter SDK in the environment
that generated it, so it has **not been compiled or run**. It should be
syntactically valid Dart/Flutter, but budget time for a first `flutter pub
get` / `flutter run` pass to catch anything that needs fixing before relying
on it.

## Authentication

- `lib/core/auth_state.dart` — session state (Provider/ChangeNotifier),
  persists the JWT in `flutter_secure_storage` (Keychain/Keystore-backed,
  not plain SharedPreferences), and restores the session on app start by
  verifying the saved token against `GET /auth/me`.
- `lib/features/auth/login_screen.dart` / `signup_screen.dart` — real
  forms calling the real backend.
- Account screen shows a login/signup prompt when logged out, or the
  real user's name/email with a working logout when logged in.
- Checkout screen is auth-aware: shows "Ordering as {email}" when logged
  in, or a guest-email field + "guest checkout" messaging when not —
  matches the guest-checkout product decision in the Charter.
- Orders screen requires login to view order history (the backend scopes
  `GET /order` to the authenticated buyer) and shows a login prompt
  otherwise, rather than silently failing.
- **Not yet wired**: the actual cart → checkout → `POST /order` submission.
  Cart state isn't in a shared Provider yet (see `cart_screen.dart`) — the
  checkout screen's "Place order" button still just navigates to `/orders`
  without calling the API. Auth is ready for this; the cart-state work is
  the remaining piece.

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
    ├── orders/               Order history + tracking (requires login)
    ├── account/              Profile / garage / addresses / support entry
    ├── auth/                 Login and signup screens (real backend calls)
    └── support/              Buyer ↔ Platform chat (no supplier contact)
```

## Next steps to make this real

1. Add a shared cart state (Provider) so checkout can actually submit real
   orders via `POST /order` — auth is ready for this (send the logged-in
   user's ID or the guest email field), the cart just isn't centrally
   tracked yet.
2. Replace remaining placeholder data (catalog browsing, order details)
   with real `ApiClient` calls.
3. Swap the placeholder launch markets in `core/config/app_config.dart` for
   the real Phase 1 country list.
4. Add `flutter_test` widget tests per screen before this grows further.
