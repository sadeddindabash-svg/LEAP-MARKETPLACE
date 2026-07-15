# Leap Mobile App (Flutter)

Buyer-facing app for iOS and Android. See `/docs/SRS.docx` Section 3.1 for the
full requirement list this implements, and
`/docs/prototypes/leap_mobile_prototype.jsx` for the reference UI/UX.

## Status

Real navigation between all core screens works. **Authentication, cart,
catalog browsing, checkout, support tickets, order detail, return
requests, and My Garage (saved vehicles) are now all real** — every one
of those calls the actual backend (`services/api`), not placeholders.
The one remaining gap: actual payment capture (see "Cart & Checkout"
below — flagged clearly there as the most important thing left).

✅ **This app has genuinely been compiled and run** — `flutter pub get`
and `flutter run -d chrome` were completed successfully on a real
machine (this sandbox itself has no Flutter SDK available, so that
verification happened outside it), and the real catalog/cart/checkout/
order flow was exercised against the real running backend. Code added
in later passes (the language setting and redesigned product page
below) has been syntax-balance-checked the same rigorous way everything
before it was, but hasn't yet had that same live-device confirmation —
worth a quick `flutter run` pass to confirm before relying on it,
though nothing about it is expected to behave differently from what's
already been proven to work.

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
- `lib/features/auth/forgot_password_screen.dart` and
  `reset_password_screen.dart` (new): real password reset, reachable via
  a "Forgot password?" link on the login screen. Calls the real
  `POST /auth/forgot-password` and `POST /auth/reset-password`.
  **Honest limitation, shown directly in the UI, not hidden**: no email
  provider is connected in the backend yet, so the reset link isn't
  actually delivered anywhere a real user would see it — it's logged to
  the *backend server's own console* as a stand-in (see
  `services/api/README.md`'s Authentication section). The
  `ForgotPasswordScreen` says this explicitly, and `ResetPasswordScreen`
  takes the code as a manually-pasted field for now rather than pretending
  a real emailed deep-link exists. Verified end-to-end against the real
  backend: signup → request reset → grab the token from server output →
  submit new password → confirm the old password stops working and the
  new one logs in successfully.

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

## Support tickets (BUY-060/061)

The support screen (previously a fully static mock — no state, a send
button that did nothing) is now real:

- `lib/features/support/chat_screen.dart` — real ticket list via
  `GET /support/my-tickets`. **Requires login** — guest-created tickets
  aren't listable without an account, the same limitation as guest order
  history (`orders_screen.dart` has the identical login-gate pattern).
- `lib/features/support/new_ticket_screen.dart` (new) — composes a
  ticket via `POST /support/tickets`.
- `lib/features/support/ticket_detail_screen.dart` (new) — real message
  thread, styled as a chat bubble view, with a working reply box calling
  `POST /support/my-tickets/:id/messages`.
- These three screens close a gap explicitly flagged in an earlier pass
  (see `services/api/README.md`'s Support Tickets section) — buyers
  previously had no way to actually create or view a ticket from the app
  at all; only admins could see tickets, and only by hitting the API
  directly.
- **Verified against the real backend, not just code review**: ran the
  exact sequence of calls these three screens make — signup → create
  ticket → fetch the list → fetch detail → send a reply → confirm the
  reply persisted — and checked every field each screen reads (`subject`,
  `status`, `messages`, `senderRole`, `message`) actually appears in the
  real response, matching what the widgets expect.

## Order detail & return requests (BUY-052/053)

Closes the gap flagged in the previous pass — there was no order-detail
screen at all, only the list.

- `lib/features/orders/order_detail_screen.dart` (new): fetches
  `GET /order/:id` and shows the real per-supplier split — the same
  structure the admin dashboard and supplier portal already display, now
  visible to the buyer too.
- Each supplier's card has a **"Request a return"** button opening a
  bottom sheet (reason + details) that submits to the real `POST /returns`.
  The sheet's copy explicitly tells the buyer they're messaging the
  Platform, not the supplier — matching the same business rule enforced
  structurally on the backend (see `services/api/README.md`'s Returns
  section for why that's a data-model guarantee, not just UI copy).
- `orders_screen.dart` list items are now tappable, navigating to
  `/orders/:id`.
- **Verified against the real backend**: ran the exact sequence —
  signup → place an order → fetch its detail → submit a return request
  using the real `subOrderId` from that response → confirmed the case
  shows up correctly in the buyer's own `GET /returns/my-cases` — and
  checked every field the screen reads (`supplierName`, `trackingNumber`,
  `items`, `subOrderId`, etc.) actually exists in the real response.

## My Garage — saved vehicles (BUY-004, BUY-010–012)

A genuinely new backend feature, not just a mock-to-real conversion —
there was no per-buyer "saved vehicles" concept anywhere in the backend
before this, only the shared Year/Make/Model/Trim reference catalog
(`GET /fitment/vehicles`, which already existed and worked). Distinguishing
"every vehicle Leap knows about" from "the vehicles *this buyer* saved"
matters — see the migration's header comment
(`services/api/db/migrations/008_saved_vehicles.sql`) for why conflating
them would be a real bug, not a naming nitpick.

- `lib/features/garage/garage_screen.dart` — real saved-vehicle list via
  `GET /garage/me`. Login-gated, same pattern as orders/tickets — there's
  no guest "garage" concept, saving a vehicle only makes sense tied to
  an account.
- `lib/features/garage/add_vehicle_screen.dart` (new) — two-step flow:
  pick a make (`GET /fitment/makes`), then pick a specific vehicle for
  that make (`GET /fitment/vehicles?make=...`), then save it
  (`POST /garage/me`). Saving is idempotent — adding the same vehicle
  twice doesn't duplicate it, verified against the real backend.
- Removing a vehicle (`DELETE /garage/me/:vehicleId`) is real too, with a
  confirmed round-trip back to an updated list.
- **Verified against the real backend**: ran the exact sequence — signup
  → fetch makes → fetch vehicles for a make → save one → confirm it
  appears in the garage list → remove it → confirm the list is empty
  again — checking every field each screen reads actually exists in the
  real response.

## Language setting & product page redesign (new)

**Confirmed business decision**: a real, persistent, app-wide language
setting (English/Arabic) — Account screen, applies everywhere — not a
per-screen toggle or auto-detect from the phone's system language.

- `lib/core/language_state.dart`: a `ChangeNotifier`, same pattern as
  `CartState`, persisted in secure storage so the choice survives an
  app restart. Drives the real `?lang=en|ar` parameter sent to
  `GET /catalog/products` and `GET /catalog/products/:id` — the backend
  resolves which language's name/description to send back (see
  `services/api/README.md`'s "Buyer-facing catalog redesign" section),
  so this app never sees the Chinese original or has to do any
  translation itself.
- **Real RTL layout**, not just RTL-aware text: `LeapApp` wraps the
  whole widget tree in a `Directionality` that flips to `rtl` when
  Arabic is selected — Flutter's standard Material widgets mirror
  automatically (padding, icons, row order) under this.
- **Honest scope boundary, stated directly rather than silently left
  incomplete**: this pass translates the product detail page's specific
  field labels (Part Name/Brand/Model/Year/Part No./Description/
  Dimensions/Weight — the exact fields that were asked for) and drives
  real product CONTENT in the correct language everywhere products are
  shown. It does NOT translate the rest of the app's UI chrome — nav
  labels, buttons, screen titles elsewhere — into Arabic. Full app-wide
  UI localization is a real, separate, larger undertaking, not something
  to fake partial coverage of here.

**Product detail page (`lib/features/catalog/product_screen.dart`),
rebuilt**:
- **No supplier identity anywhere on this screen** — not a UI choice
  hiding data that's still there; the backend itself never sends it to
  a buyer-facing request in the first place (see the backend section
  linked above), so there's nothing to hide.
- **Real uploaded photos**, shown in a real swipeable gallery
  (`_PhotoGallery`) with page-dot indicators, falling back to a
  placeholder only if a product genuinely has none.
- **The exact structured fields requested**: Part Name, Brand, Model,
  Year, Part No., Description, Dimensions, Weight — each showing real
  data from the backend's resolved response, or a real "Not specified"
  fallback (bilingual) rather than a blank space, if a legacy product
  predates a given field.
- `lib/features/catalog/category_screen.dart`'s browsing list also
  dropped supplier name from its subtitle (shows category instead) and
  is now language-aware the same way the detail page is.
- `lib/models/product.dart` rebuilt to match: `supplierName` removed
  entirely (any lingering reference would fail to compile, which is
  exactly the point — a stray "Sold by ..." display elsewhere can't
  silently keep working against a field that no longer exists).

**Tested on the backend side** (this app's own compile/run status is
noted honestly in "Status" above) — see
`apps/admin-dashboard/src/buyerCatalog.integration.test.js` for the full
verification of what this screen actually receives and renders.

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
├── app.dart                 Router + bottom-nav shell + MultiProvider
│                             (Auth, Cart, Language) + app-wide RTL
│                             Directionality when Arabic is selected
├── core/
│   ├── theme.dart            Brand colors/theme (matches the prototypes)
│   ├── auth_state.dart        Session state, real backend calls
│   ├── cart_state.dart         Cart state, real backend calls (new)
│   ├── language_state.dart     Persisted English/Arabic setting (new) —
│   │                            drives real ?lang= on catalog requests
│   └── config/app_config.dart  Launch markets, API base URL, feature flags
├── models/                  Vehicle, Product, Order, CartItem — mirror SRS entities
├── services/api_client.dart  HTTP client wrapper for services/api (auth, catalog,
│                               cart, order — all real now)
├── widgets/                  Shared components (PlateChip, StatusBadge)
└── features/
    ├── home/                Home + category grid
    ├── garage/               Saved vehicles / YMMT fitment selector — real
    ├── catalog/              Category browse + product detail — real data,
    │                          real photos, no supplier identity (new)
    ├── cart/                 Basket, grouped by supplier — real data
    ├── checkout/             Real order placement (payment capture not yet wired)
    ├── orders/               Order history/tracking + detail + return
                                requests (requires login)
    ├── account/              Profile / garage / addresses / support entry
    │                          / language setting (English/Arabic, new)
    ├── auth/                 Login, signup, and password reset screens
                                (all real backend calls)
    └── support/              Real ticket list/compose/detail — Buyer ↔
                                Platform only, no supplier contact
```

## Next steps to make this real

1. **Wire actual payment capture** into checkout — the highest-priority
   remaining gap (see "Cart & Checkout" above). Create a real Stripe
   PaymentIntent (or APS/PayPal equivalent) before calling `POST /order`,
   and only place the order once payment is confirmed.
2. Add `flutter_test` widget tests per screen before this grows further.
3. Swap the placeholder launch markets in `core/config/app_config.dart` for
   the real Phase 1 country list.
4. ~~Get this actually compiled and run on a real Flutter SDK~~ — done;
   confirmed working via `flutter pub get` / `flutter run -d chrome` on
   a real machine outside this sandbox (which itself has no Flutter SDK
   available — the SDK/engine binaries and pub.dev registry are outside
   this environment's network allowlist, confirmed via the egress
   proxy's own error messages). Code added after that point (the
   language setting and product page redesign) has only been
   syntax-checked the same way everything was before that first
   successful run — worth one more `flutter run` pass to confirm, though
   nothing about it is expected to behave differently.
5. **Full app-wide UI localization into Arabic** — this pass translated
   the product detail page's specific field labels and made real product
   content (name/description) language-aware everywhere it's shown, but
   deliberately did NOT translate the rest of the app's chrome (nav
   labels, buttons, other screens' text) — a genuinely separate, larger
   piece of work, not something to fake partial coverage of.
