# Leap Mobile App (Flutter)

Buyer-facing app for iOS and Android. See `/docs/SRS.docx` Section 3.1 for the
full requirement list this implements, and
`/docs/prototypes/leap_mobile_prototype.jsx` for the reference UI/UX.

## Status

Real navigation between all core screens works. **Authentication, cart,
catalog browsing, and checkout are now all real** — every one of those
calls the actual backend (`services/api`), not placeholders. Order
history (`orders_screen.dart`) and account details are real too. What's
NOT real yet: actual payment capture (see "Cart & Checkout" below — this
is the most important remaining gap, flagged clearly there) and the
Garage/vehicle-fitment screens, which are still placeholder data.

⚠️ This code was written without access to a Flutter SDK in the environment
that generated it, so it has **not been compiled or run**. It should be
syntactically valid Dart/Flutter (every file's braces/parens balance-
checked), but budget time for a first `flutter pub get` / `flutter run`
pass to catch anything that needs fixing before relying on it. The backend
side of every flow described below (cart, order placement, product
fetching) WAS verified against the real running API via curl, matching
exactly what this Flutter code calls.

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

## Cart & Checkout (BUY-030–034)

The main new work in this pass — cart, catalog browsing, and checkout are
now genuinely wired to the backend, not just auth.

- `lib/core/cart_state.dart` — cart state (Provider/ChangeNotifier). Every
  add/remove/quantity-change is a **real network call** to
  `services/api/cart` — there's no local-only cart that gets reconciled
  with the server later. The cart ID is a per-device UUID (via the `uuid`
  package) persisted in secure storage, independent of login, so guest
  checkout works without an account.
- `lib/features/catalog/category_screen.dart` — fetches real products by
  category via `GET /catalog/products`. Tapping a product navigates to a
  real product ID (previously this pushed a hardcoded `/product/sample`
  route that doesn't exist as a real product — fixed as part of this work,
  since it would have broken the moment the product screen started
  fetching real data).
- `lib/features/catalog/product_screen.dart` — fetches the real product by
  ID via `GET /catalog/products/:id` and adds to the real cart.
- `lib/features/cart/cart_screen.dart` — shows real cart contents grouped
  by supplier (`itemsBySupplier`), with a working quantity stepper and
  remove button, both hitting the real API.
- `lib/features/checkout/checkout_screen.dart` — "Place order" calls the
  real `POST /order`, which correctly splits the cart into per-supplier
  sub-orders server-side, then clears the cart.

**Backend changes made alongside this** (see `services/api/src/modules/cart/routes.js`):
- Added `supplierName` to the cart's GET response (needed for the
  supplier-grouped UI) — wasn't there before.
- Made all three cart endpoints (GET/POST/DELETE) return the same full
  item shape, so the client never needs an extra round-trip after a
  mutation just to redisplay the cart.
- Added a new `PATCH /cart/:cartId/items/:productId` endpoint to set an
  *exact* quantity — the existing POST endpoint only adds to whatever
  quantity is already there, which doesn't support a `-` button on a
  quantity stepper.

**IMPORTANT, FLAGGED HONESTLY — this does NOT yet actually charge anyone.**
"Place order" creates a real order with a real total and real per-supplier
splitting — that part is genuine and verified. It does **not** call the
Stripe/APS/PayPal payment module first. The payment method radio buttons
on the checkout screen are currently cosmetic — selecting "PayPal" vs.
"Stripe" doesn't change what happens when you tap "Place order." Wiring
"buyer picked X" to "a real PaymentIntent gets created and confirmed
before the order is placed" is the next real gap, not done here. See the
comment block at the top of `checkout_screen.dart`.

**Verified end-to-end against the real running backend** (curl, not just
code review): browsed a real category → fetched a real product →
added two items from two different suppliers to a cart → adjusted
quantity via the new PATCH endpoint → placed a guest order → confirmed
the order total and per-supplier split were correct → cleared the cart
via the same calls `clearAfterOrder()` makes → confirmed the cart was
empty afterward. Every step matches exactly what the Flutter code above
calls — this wasn't a separate, looser check.

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
├── app.dart                 Router + bottom-nav shell + MultiProvider (Auth, Cart)
├── core/
│   ├── theme.dart            Brand colors/theme (matches the prototypes)
│   ├── auth_state.dart        Session state, real backend calls
│   ├── cart_state.dart         Cart state, real backend calls (new)
│   └── config/app_config.dart  Launch markets, API base URL, feature flags
├── models/                  Vehicle, Product, Order, CartItem — mirror SRS entities
├── services/api_client.dart  HTTP client wrapper for services/api (auth, catalog,
│                               cart, order — all real now)
├── widgets/                  Shared components (PlateChip, StatusBadge)
└── features/
    ├── home/                Home + category grid
    ├── garage/               Saved vehicles / YMMT fitment selector (still placeholder)
    ├── catalog/              Category browse + product detail — real data
    ├── cart/                 Basket, grouped by supplier — real data
    ├── checkout/             Real order placement (payment capture not yet wired)
    ├── orders/               Order history + tracking (requires login)
    ├── account/              Profile / garage / addresses / support entry
    ├── auth/                 Login and signup screens (real backend calls)
    └── support/              Buyer ↔ Platform chat (no supplier contact)
```

## Next steps to make this real

1. **Wire actual payment capture** into checkout — the highest-priority
   remaining gap (see "Cart & Checkout" above). Create a real Stripe
   PaymentIntent (or APS/PayPal equivalent) before calling `POST /order`,
   and only place the order once payment is confirmed.
2. Wire the Garage/vehicle-fitment screens to real data (`GET /fitment/vehicles`
   already exists and works — see `services/api/README.md`).
3. Add `flutter_test` widget tests per screen before this grows further.
4. Swap the placeholder launch markets in `core/config/app_config.dart` for
   the real Phase 1 country list.
5. Get this actually compiled and run on a real Flutter SDK — this entire
   codebase has only been syntax-checked, never built, given this
   environment's constraints.
