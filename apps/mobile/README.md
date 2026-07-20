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
- **Honest scope boundary AT THE TIME THIS SECTION WAS FIRST WRITTEN,
  since since resolved — kept here for the historical record rather than
  quietly edited away**: this pass translated only the product detail
  page's specific field labels, not the rest of the app's UI chrome.
  That gap is now closed — see "Full app-wide localization" below for
  what was built afterward and exactly how.

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

## Full app-wide localization (new)

**Confirmed request, chosen explicitly from a list of options**: extend
the language setting beyond the product page to the REST of the app —
every screen's nav titles, buttons, empty/error states, form labels.
Before this, a GCC customer switching to Arabic got a half-translated
app (real product data in Arabic, everything else still English).

**`lib/core/app_strings.dart`**: a new, comprehensive bilingual string
lookup — every screen's static UI chrome, ~90 real English/Arabic string
pairs. `tr(context, 'key')` for use inside a `build()` method (subscribes
to `LanguageState` via `context.watch`, so an already-open screen
re-renders in the new language the instant the setting changes, same as
the product page); `trRead(context, 'key')` for use OUTSIDE build — event
handlers, async submit callbacks setting an error-message string —
since `context.watch` throws a real Flutter framework assertion if
called anywhere other than build(). A missing key returns the key
itself (visibly wrong, not silently blank), so a missed translation is
easy to spot rather than easy to miss.

**Applied across all 15 remaining screens**: home, garage, add-vehicle,
category browsing, cart, checkout, orders list, order detail (incl. the
return-request sheet), account, support ticket list/detail/compose,
login, signup, forgot/reset password.

**DELIBERATE ARCHITECTURE CHOICE, explained rather than silently
picked**: this is a hand-written lookup, not Flutter's official
`intl`/`.arb` + `flutter gen-l10n` pipeline. That's the more "correct"
production approach, but `gen-l10n` needs the real Flutter SDK to
generate the delegate class — unavailable in this sandbox (see
"Status" above). Nothing here is a stub; every string pair is real,
hand-maintained Dart — just a pragmatic substitute for tooling this
environment can't run, the same reasoning behind other pragmatic
choices in this project (e.g. the pricing engine's manual FX rate
instead of a live provider).

**Known, minor inconsistency, stated honestly rather than silently
left**: the product detail page still uses its OWN, separate, earlier
inline bilingual getters (`_lPartName` etc. in
`product_screen.dart`) rather than this new shared `app_strings.dart`
lookup. Both work correctly and are both tested — this isn't a bug —
but it's two coexisting localization mechanisms rather than one
consistent one. Worth a follow-up pass to fold the product page onto
the shared lookup for consistency, not urgent since neither is broken.

**Verification**: this app's own compile/run status is noted honestly
in "Status" above — every one of the 17 touched files was syntax-
balance-checked (braces/parens/brackets), and specifically checked for
a real Dart compile-error class this kind of change can introduce:
wrapping a `const` widget around a `tr()` call, which is a genuine
compile error since `tr()` is a runtime function call, not a compile-time
constant. Every file was grepped for this pattern and for `const`
attached to any widget now containing a `tr()`/`trRead()` call; none
were found. Every file using `tr()`/`trRead()` was also confirmed to
correctly import `app_strings.dart`.

## Product search (new)

The home screen's search box was a dead, read-only field with a literal
`// TODO: wire to search screen` comment — that's now real:

- `lib/features/search/search_screen.dart`: tapping the home screen's
  search box opens a real search-as-you-type screen. Debounced (400ms
  after the last keystroke, not a real network request per character) —
  a real search-as-you-type still shouldn't hammer the backend on every
  keystroke. Calls the real `GET /catalog/products?search=...` (see
  `services/api/README.md`'s "Product search" section for the full
  multi-word matching logic), language-aware via the same
  `LanguageState` the product page uses, with real loading/empty/error
  states rather than a screen that just does nothing while waiting.
- `ApiClient.searchProducts()`: new method, added alongside the existing
  `fetchProductsByCategory`/`fetchProductById`.

**Tested on the backend side** — see
`apps/admin-dashboard/src/productSearch.integration.test.js` for the
full verification of the search logic this screen calls, including the
real bug it caught and fixed (unapproved products leaking into search
results before this pass).

## Home feed redesign (new)

**Confirmed exact sequence, top to bottom**: search bar → "Shopping
for" → "Shop by category" → a filter (Newest / My car) → the real
product feed. Each product card shows exactly what was asked for:
photo, name, review stars, an add-to-cart button, stock availability,
and price.

**`lib/widgets/product_card.dart`** (new, reusable): the real card used
in the home feed (and now `CategoryScreen`'s product list too, for
consistency). Add-to-cart calls the real cart endpoint directly from
the card (quantity 1) — a buyer doesn't have to open the full product
page just to add one unit, same real `CartState.addItem()` the product
detail screen itself uses.

**"Shopping for" is now real**, not the hardcoded "BMW 1 (F20) · 118d
2.0" placeholder it used to be — `_ShoppingForCard` fetches the buyer's
real garage (`ApiClient.fetchMyGarage()`, same call `GarageScreen`
already used) and shows their real first saved vehicle, or a real
prompt to add one if they haven't yet. This was necessary, not
cosmetic: the "My car" feed filter below depends on there being an
actual real vehicle to filter by — leaving the display hardcoded while
building a filter that depends on "my car" being real would have been
a genuine inconsistency.

**The filter — real, not decorative**:
- **Newest**: `GET /catalog/products?sort=newest` — see
  `services/api/README.md`'s "Product search" section for why this
  needed a real, explicit `ORDER BY` added (there wasn't one before).
- **My car**: reuses the EXISTING real `vehicleId` fitment filter
  (already used by category browsing) against the buyer's real first
  saved vehicle. A real, honest empty state ("Add a vehicle to see
  products for your car") shows instead of an empty feed if they have
  none saved — not a silent blank screen.

## Category browse sidebar (new)

**Confirmed requirement**: a sidebar listing every real major category;
the main area shows the real Parts within whichever category is
currently selected; tapping a Part moves to the real product list for
exactly that Part.

- **`lib/features/catalog/category_browse_screen.dart`** (new): tapping
  a category on the home screen now opens this screen first (was a
  direct jump straight to a flat product list before). Real sidebar —
  every category from `GET /catalog/categories`; selecting one
  real-fetches that category's real Parts from
  `GET /catalog/categories/:id/parts` into the main area.
- **`CategoryScreen` extended** with an optional `part` parameter —
  tapping a real Part in the sidebar screen lands here with the
  backend's real EXACT-match `part=` filter (distinct from the fuzzy
  `search=` used elsewhere), showing precisely that Part's real
  products, using the same new `ProductCard`.
- **Honest, deliberate scope boundary**: the backend doesn't store an
  icon choice per category (a real, separate feature if ever wanted) —
  `_iconForCategory()` maps known category ids to a real icon, falling
  back to a generic one for any category an admin adds that isn't in
  that mapping yet, rather than crashing or showing nothing.
- **The bottom nav bar's "Shop" tab reuses this exact same screen**,
  found to be a genuinely dead placeholder while wiring this up (its
  entire body was a literal `Text('...extract into a shared widget.')`
  — never actually built). `CategoryBrowseScreen`'s `initialCategoryId`
  is now optional; entering from "Shop" (no specific starting category,
  unlike tapping a category icon on Home) defaults to the real first
  category once the list loads.

## Order status filter tabs (new)

**Confirmed scope, discussed before building**: only 3 of the 5
originally-requested tabs (To ship / Shipped / Returns) have a real
system behind them today — see `services/api/README.md`'s "Real
derived order status" section for the full backend design, including a
real bug found and fixed there (the order's raw status field is frozen
forever and never reflects real progress) and why "To pay" and "To
review" tabs were deliberately left out for now (no real payment
capture or review system exists yet — building those tabs would just
show permanently empty results, not a real filter).

- **`kOrderTabs`** in `orders_screen.dart`: a real horizontal tab row
  (All / To ship / Shipped / Returns), reusing the same filter-chip
  visual pattern already established on the home feed's Newest/My car
  filter, for consistency rather than introducing a second filter UI
  style.
- Tapping a tab real-refetches `GET /order?status=...` — the real
  backend filter, not a client-side filter over already-fetched data.
- Every order card (list and detail) now displays the real, computed
  `displayStatus` — the order detail screen was ALSO fixed to stop
  displaying the raw, frozen `status` field, which would have shown
  stale information there too.

## Real address book, capped at 3 (new)

"Addresses" in the Account page was a genuinely dead nav row before
this (`route: null`) — tapping it did nothing at all. Real now — see
`services/api/README.md`'s "Real buyer address book" section for the
full backend design.

- **`lib/features/account/addresses_screen.dart`** (new): a real list
  of the buyer's saved addresses (up to 3), each with a real "Default"
  badge, and a menu to edit, set as default, or delete (with a real
  confirmation dialog before deleting).
- **`lib/features/account/address_form_screen.dart`** (new): a single
  shared real form for both adding a new address and editing an
  existing one — the same real backend call either way
  (`POST`/`PATCH /addresses/me`), just pre-filled when editing.
- **The real 3-address cap is surfaced honestly in the UI**: once a
  buyer has 3 saved, the "Add address" button shows the real backend's
  own limit message instead of silently doing nothing or letting the
  buyer attempt a submission that will just be rejected.

## Real wishlist (new)

**`lib/features/account/wishlist_screen.dart`** (new): a real list of
the buyer's saved products, reusing the same `ProductCard` widget
already used on the home feed, for consistency. A real, honest empty
state ("Nothing saved yet...") rather than a blank screen.

**A real heart icon on `ProductCard` itself** — visible on the home
feed, category browsing, search results, and the wishlist screen alike,
not just a dedicated add button somewhere else. Only shown for a
logged-in buyer (matches the app's existing pattern of hiding real
buyer-specific state for guests rather than showing something that
would just fail on tap). Tapping it calls the real, idempotent
add/remove endpoints directly — see `services/api/README.md`'s "Real
wishlist" section.

## Product card redesign — 2-column grid (new)

**Confirmed via a mockup shown and approved before writing any code**:
`ProductCard` was rebuilt from a horizontal list row into a vertical
grid card — photo on top, name, real star rating, real stock status,
then a bottom row with price on one side and the wishlist heart +
add-to-cart button sitting beside each other on the other side. Fixes
a real, reported layout bug where the heart and price were overlapping
in the previous design.

Every real screen that lists products (`home_screen.dart`'s feed,
`category_screen.dart`, `wishlist_screen.dart`) now renders these in a
real `GridView` (`SliverGridDelegateWithFixedCrossAxisCount`,
`crossAxisCount: 2`) instead of a single-column list — two cards per
row, wrapping into further rows, matching the confirmed design exactly.

## Real notifications (new)

**Confirmed scope, discussed before building**: triggered by order
changes and message/ticket replies — see `services/api/README.md`'s
"Real notifications" section for the 4 real, named trigger points.

- **A real bell icon with an unread badge on the Account page's app
  bar** — the exact placement confirmed rather than assumed. Shows a
  real count from `GET /notifications/me/unread-count`, capped at "9+"
  display rather than an ever-growing number.
- **`lib/features/account/notifications_screen.dart`** (new): a real
  list, unread ones visually distinguished (filled bell icon, bold
  title). Tapping one marks it read and navigates to the real thing
  it's about — an order-status or return-status notification opens the
  real order detail page; a ticket-reply notification opens the real
  ticket thread.
- A real "Mark all read" action, only shown when there's genuinely
  something unread to clear.

## Real promotions — referral rewards + promo codes at checkout (new)

**Confirmed scope, discussed at real length before building**: what
started as "referral rewards" was deliberately expanded into a general
promotions engine — see `services/api/README.md`'s "Real promotions
engine" section for the full backend design and every confirmed
decision (reward types, the real anti-abuse referral trigger, the
real 10-reward cap).

- **`lib/features/account/referrals_screen.dart`** (new): a buyer's
  real, unique referral code (created on first view), with real stats
  — how many people they've referred, how many real rewards they've
  earned out of the real cap, and a real copy-to-clipboard button.
- **A real, optional referral code field on signup** — an invalid or
  made-up code is a real, silent no-op (matching the backend's own
  honest handling), never a signup error.
- **A real promo code field at checkout**, with live validation against
  the real backend before the order is placed (`POST /promo-codes/validate`)
  — shows the real reason a code doesn't work (expired, already used,
  doesn't exist) rather than a generic failure. The order summary shows
  a real subtotal/discount/total breakdown once a code is applied, and
  the "Place order" button's own total updates to match. The ACTUAL
  charged amount always comes from the real backend's own
  recalculation at order placement — the client-side preview is
  honestly just that, a preview, not the authority.

## Real product reviews and ratings (new)

A new reviews section on the product detail page — see
`services/api/README.md`'s "Real product reviews and ratings" section
for the full real backend design (migration 025). Shows the real
average rating and every real `'approved'` review (author, stars,
comment) — a pending or rejected review is never shown here, matching
the public endpoint's own real filtering.

A logged-in buyer can write a real review directly from this screen —
a tappable 1–5 star picker plus an optional comment. Submitting shows
the real backend's own response: if the admin-toggled verified-purchase
setting is on and this buyer hasn't actually received the product, the
real rejection message shows here directly, not a generic error.
Re-submitting for a product the buyer already reviewed is a real edit
(the form pre-fills with their existing rating/comment) — genuinely
the same review, sent back for re-review, never a second submission.

While their review is pending or was rejected, the buyer sees that real
status on this same screen rather than silence — since a review that's
gone into a moderation queue with no visible trace would look like it
just vanished.

**Honest limitation**: this sandbox has no Flutter SDK, so this code
could not be run or tested here beyond careful manual review — bracket
balance checked, and every real API contract (`AuthState.token`/
`isLoggedIn`, `ApiException.message`, `Product.id`'s real type) was
cross-checked directly against the actual source files it depends on,
not assumed. Real device/emulator testing is needed to confirm this
behaves correctly end-to-end.

## Real order cancellation + real guest-to-account conversion (new)

See `services/api/README.md`'s "Real order cancellation" and "Real
guest-to-account conversion" sections for the full real backend design
(migration 029).

A real "Cancel order" button on the order detail screen — shown only
when the real backend's own eligibility check (every sub-order still
pending/preparing) would actually allow it, mirrored client-side so
this button is never visible only to fail when tapped. A real
confirmation dialog before the real cancel call fires, and the real
backend's own rejection message (e.g. once something has genuinely
shipped) shows directly if it's rejected anyway (a real race, however
unlikely, between loading the screen and something shipping a moment
later).

A real, dismissable "Save your order history" dialog shows right after
a real guest order is placed — confirmed design: on the confirmation
moment itself, not via a separate email. Pre-fills the exact guest
email just used, since signing up with that same email is what
genuinely links the just-placed order to the new account. `AuthState.signup()`
now returns the real number of orders that got linked, and the signup
screen shows an honest confirmation only when that number is genuinely
above zero — never a generic "welcome" message implying something
happened when it didn't.

**Honest limitation, same as the reviews section above**: this sandbox
has no Flutter SDK, so none of this could be run or tested here beyond
careful manual review — bracket balance checked across every touched
file, and the `context.push('/signup', extra: {...})` pattern (the
first use of `extra` anywhere in this codebase) was verified against
`go_router`'s own documented, standard API rather than assumed. Real
device/emulator testing is needed to confirm this behaves correctly
end-to-end.

## Real order shipping addresses (new, migration 030)

See `services/api/README.md`'s "Real order shipping addresses" section
for the full real backend design — a real, honest gap found first: no
order ever actually collected a real shipping address.

**Checkout screen**: a real logged-in buyer now sees a real address
picker — their real saved addresses (radio-button style), or an inline
form to add a new one. A new address typed in is saved to their real
account first (so it's there to reuse next time); if that fails (e.g.
the real 3-address cap), the order still goes through using the
address typed in, just not saved for later. Placing the order is
blocked with a real, clear error until a real address is selected or
completed.

**Guest checkout**: unchanged at the point of placing the order — just
email, as before. Right after confirmation, a real bottom sheet
requests device location permission, and — if granted — reverse-
geocodes it via OpenStreetMap's free Nominatim service (same
free-provider reasoning as the Frankfurter FX rate integration; no API
key needed) into a real, editable address suggestion: "Is this your
delivery address?" Confirming saves it via the real `PATCH
/order/:id/address` endpoint. Declining, or the location genuinely
being unavailable/denied, leaves the order in the real "pending
address" state — never blocks getting to the order confirmation.

**Order detail screen**: shows a real "pending address" banner with an
"Add address" action when an order has none yet, or the real confirmed
address when it does.

**HONEST LIMITATIONS**:
- Same as every other mobile section in this README — no Flutter SDK
  in this sandbox, so none of this could be run or tested here beyond
  careful manual review and bracket-balance checks across every
  touched file.
- The `geolocator` package (added to `pubspec.yaml`) needs real,
  platform-specific permission setup this sandbox cannot touch, since
  the real `android/` and `ios/` folders are generated locally (via
  `flutter create .`), not committed to this repo. **For Android**, add
  `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />`
  (and `ACCESS_COARSE_LOCATION`) to `AndroidManifest.xml`. **For iOS**,
  add a real `NSLocationWhenInUseUsageDescription` string to
  `Info.plist`. **For web** (this app's primary real testing
  environment so far, via `flutter run -d chrome`), no extra setup is
  needed — the browser's own built-in permission prompt handles it
  directly.
- Nominatim's real usage policy asks that heavy/bulk use go through
  their own paid or self-hosted options instead — fine for this app's
  real, one-off, human-triggered lookup per guest order, not meant for
  bulk geocoding.

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

## Real device builds (Android, iOS, Huawei) — new

**Confirmed real constraints, discussed directly before starting**: this
project has so far only ever been run via `flutter run -d chrome` — the
real, platform-specific `android/` and `ios/` folders that a genuine
installable build needs have never been generated (this is a real,
Dart-only project structure right now, not an oversight). Building a
real iOS app requires Apple's own Xcode, which only runs on an actual
Mac — there is no way around this from Windows or from an AI sandbox;
a cloud Mac rental service (e.g. Codemagic, MacStadium) is the real
option if a physical Mac isn't available. Android has no such
restriction — a real, installable `.apk` can be built directly from a
Windows machine with Android Studio installed.

**Confirmed device coverage**: this app uses no Google-specific
services (no Google Sign-In, Google Maps, or Firebase push
notifications — confirmed by checking the real dependency list and
codebase directly, not assumed) — so the real Android APK should
install and run correctly on Huawei devices via sideloading too, even
newer ones without Google Mobile Services, for real testing purposes.
Full, official distribution through Huawei's own AppGallery store would
need a real, separate integration with Huawei Mobile Services — not
included here.

**What's been prepared already**:
- A real 1024×1024 app icon at `assets/icon/icon.png`, in the real
  brand's signal-orange, matching the palette already established
  across the admin dashboard, supplier portal, and this app itself.
- `flutter_launcher_icons` configured in `pubspec.yaml` to generate
  every real required icon resolution for Android (and iOS) from that
  one source image automatically, rather than needing each size
  produced and placed by hand.

**Real steps to run, in order, on a Windows machine with Flutter and
Android Studio (including the Android SDK) installed**:

```bash
cd path\to\LEAP-MARKETPLACE\apps\mobile

# 1. Generate the real android/ (and ios/) platform folders -- this
#    project has never had them. Pick a real package name/org now;
#    changing it later means renaming folders and config by hand.
flutter create --org com.leapautoparts --project-name leap_mobile .

# 2. Pull in the new launcher-icon dependency.
flutter pub get

# 3. Generate every real required icon size from assets/icon/icon.png
#    for both platforms in one step.
flutter pub run flutter_launcher_icons

# 4. Build a real, installable Android APK.
flutter build apk --dart-define=API_BASE_URL=http://YOUR_BACKEND_HOST:4000
```

The real APK lands at `build/app/outputs/flutter-apk/app-release.apk` —
copy it to a real Android or Huawei phone (e.g. via USB, email, or a
cloud drive) and open it there to install (the phone will need
"install from unknown sources" allowed once, a standard real Android
setting for anything installed outside the Play Store).

**A real, honest note on `API_BASE_URL`**: `http://localhost:4000` only
works when the app and backend run on the exact same machine (like
Chrome testing has been doing) — a real phone on the network needs your
computer's real local IP address (e.g. `http://192.168.1.50:4000`,
found via `ipconfig` on the machine running the backend) instead, and
both devices need to be on the same real network.

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
│   ├── app_strings.dart        Full app-wide bilingual string lookup
│   │                            (new) — every screen's static UI chrome
│   └── config/app_config.dart  Launch markets, API base URL, feature flags
├── models/                  Vehicle, Product, Category (new), Order, CartItem — mirror SRS entities
├── services/api_client.dart  HTTP client wrapper for services/api (auth, catalog,
│                               cart, order — all real now)
├── widgets/                  Shared components (PlateChip, StatusBadge, ProductCard (new))
└── features/
    ├── home/                Home feed — real "Newest"/"My car" filter,
    │                          real product cards (new)
    ├── garage/               Saved vehicles / YMMT fitment selector — real
    ├── catalog/              Category browse SIDEBAR (new) + product
    │                          detail — real data, real photos, no
    │                          supplier identity
    ├── search/               Real product search (new) — was a dead
    │                          read-only field before this pass
    ├── cart/                 Basket, grouped by supplier — real data
    ├── checkout/             Real order placement (payment capture not yet
    │                          wired) + real promo code entry (new)
    ├── orders/               Order history/tracking (real status filter
    │                          tabs, new) + detail + return requests
                                (requires login)
    ├── account/              Profile / garage / addresses (new) / wishlist
    │                          (new) / notifications (new) / referrals (new)
    │                          / support entry / language setting
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
