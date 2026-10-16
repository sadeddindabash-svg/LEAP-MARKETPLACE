# Leap Auto Parts — Web Storefront

A real, public, search-engine-visible storefront — the piece the
mobile app alone couldn't provide. Built with Next.js (App Router)
specifically because it renders real, crawlable HTML on the server:
someone searching Google for a part lands on a real page with the
real product name, price, and description already in the HTML, not an
empty shell waiting for client-side JavaScript.

## Why this exists

The mobile app (`apps/mobile`) technically runs in a browser too (via
Flutter's web target), but it's a client-rendered, mobile-first app —
weak for search visibility and not built for wide desktop screens.
This is a separate, purpose-built app for exactly that gap: findable
on a computer, usable on a phone's browser, while the native app stays
the primary way to actually place an order.

## Status

**Phase 1: browsing and product pages, the SEO-critical surfaces.**
Confirmed working — every page below was verified by starting a real
production build against the real backend and directly inspecting the
raw server-rendered HTML (not just "it loads in a browser").

**Phase 2 (this pass): cart and guest checkout.** Built and confirmed
against the real backend — a real product can be added to a real
cart, the cart persists across a page refresh, and a real guest order
places correctly with a real delivery address. **Account features
(login/signup, order history, saved-address checkout) are a real,
separate, confirmed next step, not built here yet** — checkout in this
pass is guest-only, matching the mobile app's own guest flow.

## Pages

- **`/`** — homepage: hero, real categories, most recently listed
  real products.
- **`/search`** — real, filterable browsing by category and search
  term (`?q=...&category=...`), a real server-rendered response per
  query so each filtered result is its own real, indexable URL.
- **`/products/[id]`** — a real product's own page, with real
  per-product SEO metadata (`generateMetadata`) built from that
  product's own real name and description — not a generic, repeated
  site-wide title on every page. Includes real reviews already
  submitted for that product.
- **`/sitemap.xml`** — a real, dynamic sitemap generated from the
  actual current product catalog every time it's requested, so every
  real product page is genuinely discoverable, not just the ones a
  crawler happens to stumble onto by following links.
- **`/robots.txt`** — points crawlers at the real sitemap above.
- **`/cart`** — a real, interactive cart (Client Component — no SEO
  reason for this one to be server-rendered). Quantity controls, item
  removal, running total.
- **`/checkout`** — real guest checkout: email plus delivery address,
  placing a real order through the same backend the mobile app uses.
- **`/checkout/confirmation`** — shows the real order number after a
  real order is placed.

## Real cart and checkout (Phase 2)

**Confirmed scope**: guest checkout only in this pass — matching the
mobile app's own guest flow. Account login/signup and saved-address
checkout are a real, separate, confirmed next step.

**`components/CartProvider.tsx`** — the cart is a real, per-visitor,
interactive concern with no SEO value, so it's deliberately the one
part of this app that isn't server-rendered. A real cart ID is
generated once (`crypto.randomUUID()`) and stored in a real cookie
(30-day expiry) so a visitor's cart survives a page refresh or closing
the tab — talks directly to the SAME real backend cart module the
mobile app already uses (`services/api/src/modules/cart/routes.js`),
which itself needs no separate "create cart" call.

**`components/AddToCartButton.tsx`** and **`components/CartIcon.tsx`**
— real Client Components embedded inside otherwise server-rendered
pages (the product page, the root layout's header) — Server Components
can render Client Components with plain, serializable props, so this
doesn't compromise the SEO-critical pages' own server rendering.

**Checkout** places a real order via the same real `POST /order`
endpoint the mobile app's guest checkout uses, with the same real
required address fields (migration 030). On success, the real cart
cookie is cleared (a fresh cart ID is generated next time something is
added, rather than reusing a now-irrelevant one) and the visitor is
sent to the real confirmation page with the real order number.

**A real bug was found and fixed while building this**: the
confirmation page reads the order ID via `useSearchParams()`, which
Next.js's App Router requires to be wrapped in a real `<Suspense>`
boundary — without one, an actual production build fails outright
while trying to prerender the page, rather than just warning.
Confirmed by a real failed build, not assumed; fixed by extracting the
search-param-reading logic into its own component wrapped in
`<Suspense>`.

**Tested against the real backend**: added a real item to a real cart
via the backend API directly, confirmed the real, live-calculated
price came back correctly; placed a real guest order with a real
delivery address through the same endpoint the checkout page calls,
and confirmed a real order number came back. The confirmation page's
actual client-side hydration (reading the order ID from the URL after
the initial "Loading…" server-rendered state) could only be verified
logically here, not visually in a real browser — worth a quick manual
check once running somewhere with one.

## Real verified-purchase badge on reviews (new, migration 035)

See `services/api/README.md`'s equivalent section for the full real
backend design. The product page (`app/products/[id]/page.tsx`) shows
a real "✓ Verified Purchase" badge next to a review's buyer name/date
when that buyer's purchase was genuinely verified at the moment they
submitted it. Confirmed by directly inspecting the rendered page
against a real, delivered order's real review — not just checked for
compile errors.

## Real account login/signup + saved searches (new, migration 039)

**Confirmed scope**: just enough real login/signup to unblock saved
searches — this storefront had no account system at all before this.
Order history and saved-address checkout remain a real, separate,
confirmed next pass, not built here.

**`components/AuthProvider.tsx`** — a real cookie holds the JWT
(30-day expiry, same real pattern and reasoning as the cart ID cookie
in `CartProvider.tsx`) so a session survives a page refresh. Backed by
the exact same real `/auth/signup`, `/auth/login`, `/auth/me`
endpoints every other part of this project already uses — no separate
storefront-only account system.

**`/login`** and **`/signup`** — real, minimal forms. **`AccountLink`**
in the header shows "Log in" when signed out, or the buyer's name plus
a real log-out action when signed in.

**`/saved-searches`** — a real management page (requires login,
matching the backend's own requirement); **`SaveSearchButton`** on the
search page lets a logged-in buyer save the current search term/
category with a real label. See `services/api/README.md`'s "Real
saved searches with notifications" section for the full real backend
design, including a real bug (found and fixed in an earlier pass) this
depends on being fixed correctly.

**Confirmed via a real production build**: all 13 routes compile
cleanly (`npm run build`), and the rendered HTML for `/login`,
`/signup`, and `/saved-searches` was checked directly — the actual
interactive login/signup flow itself could only be reasoned about
logically here, not clicked through in a real browser (same honest
limitation as the checkout confirmation page's client-side hydration).

## Brand system — carried over, not reinvented

Since this is the same real product as the mobile app, not a
rebrand, every design token here is carried over exactly from
`apps/mobile/lib/core/theme.dart` (itself from
`docs/prototypes/leap_mobile_prototype.jsx`):

- **Colors** (`app/globals.css`): `ink`, `chalk`, `line`, `signal`,
  `signal-dark`, `torque`, `gauge`, `amber`, `muted` — the exact real
  hex values from the mobile app's own theme file.
- **Type**: Barlow Condensed for display/headlines (an industrial,
  gauge-cluster face — fitting for an auto parts catalog), Inter for
  body copy, JetBrains Mono for part numbers.
- **Signature element — the "plate chip"**: the license-plate-styled
  badge (`.plate-chip` in `globals.css`) used for real part
  numbers and real vehicle fitment tags, carried over directly from
  `apps/mobile/lib/widgets/plate_chip.dart`'s own header comment:
  "keep it consistent rather than reskinning per-screen."

## Real API integration

`lib/api.ts` is the only place this app talks to the backend —
plain, typed `fetch` calls (no client-side state library needed,
since every call runs inside a real React Server Component). Every
field in its TypeScript interfaces was verified directly against
`services/api/src/modules/catalog/routes.js`'s own real DTO-building
functions (`toBuyerProductDto`, `attachBuyerImages`,
`attachBuyerPrice`, `attachPrimaryFitment`, `toCategoryDto`) rather
than assumed.

Real product images come back from the backend two different real
ways (see `services/api/src/modules/uploads/routes.js`): a real,
relative path for local dev storage, or an already-absolute URL for
real cloud storage. `resolveImageUrl()` in `lib/api.ts` handles both
rather than assuming one shape — prefixing an already-absolute cloud
URL with the API base would have silently broken production images.

Real, server-side revalidation is set to 60 seconds
(`REVALIDATE_SECONDS` in `lib/api.ts`) — product data doesn't need
refetching on every single real request (needless load on the
backend for what's mostly read traffic), but also shouldn't go stale
for long. Tune this once real traffic patterns are known.

## HONEST LIMITATION: Google Fonts could not be verified in this sandbox

`app/layout.tsx` uses `next/font/google` for Barlow Condensed, Inter,
and JetBrains Mono — the real, correct, production implementation.
This sandbox's network access does not include `fonts.googleapis.com`,
so `next build` fails here with a real `403` trying to fetch them —
confirmed directly, not assumed. Every other part of this app (data
fetching, routing, SEO metadata, the sitemap, all three main pages)
was fully built and verified using a temporary, local-fonts-only
version of the layout, then the real Google Fonts version was
restored for this delivered code and separately confirmed to
type-check and lint cleanly (`npx tsc --noEmit`, `npx eslint .` — both
clean) — but the actual real font fetch itself needs verifying once
running somewhere with real internet access.

## A real bug worth knowing about, found while testing this

Twice while testing, a stale `next start` process from an earlier test
was still running and silently serving an outdated build — once
producing a real, confusing 404 for a real, valid product; once
serving the wrong page entirely for `/robots.txt` and `/sitemap.xml`.
Neither was a real bug in the app itself — both resolved by finding
and killing the actual stale process (`ps aux | grep next`) before
starting a fresh one. Worth remembering if a change doesn't seem to
take effect: confirm nothing older is still bound to the port first.

## Setup

```bash
cd apps/web-storefront
npm install
```

Copy `.env.local` and adjust as needed:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

```bash
npm run dev          # local development, http://localhost:3000
npm run build         # real production build
npm run start          # serve the real production build
```

## Testing (new — this app had zero test files before)

**A real, honest gap, found and closed**: unlike every other app in
this monorepo, this one had no test files and no `test` script in
`package.json` at all. Added the same Vitest + jsdom + React Testing
Library toolchain already used in `apps/admin-dashboard` and
`apps/supplier-portal`, adapted for this app's Next.js `@/*` path alias
(`vitest.config.ts` maps it manually, since Vitest doesn't read Next's
own module resolution config).

```bash
npm test
```

Two real test files, 8 tests total, all passing:
- `lib/api.integration.test.ts` (6, REAL backend — skips cleanly if
  `services/api` isn't running, same `describe.runIf(backendUp)`
  pattern used throughout this project's other integration tests) —
  real categories/products load, a real computed price is always a
  positive number, a category filter never leaks a product from a
  different category, product detail fetches the right real product,
  a nonexistent product returns `null` rather than throwing, and a real
  cart genuinely persists an added item across two separate fetches.
- `components/CartIcon.test.tsx` (2, mocked fetch) — no badge on a real
  empty cart, and adding a real item updates the badge without a page
  reload.

Also added a matching `web-storefront` job to
`.github/workflows/ci.yml` (checkout → `npm ci` → `npm run lint` →
`npm test`) — the integration tests will skip in CI (no live backend
there), but the component tests genuinely run and must pass.

## Real order history + order detail (new) — the single biggest gap closed

**Confirmed the actual gap first**: this storefront had login/signup
and cart/checkout, but a buyer who placed a real order here had no way
to ever see it again — checkout only ever showed a one-time
confirmation page. Closed with the same real `GET /order` and
`GET /order/:id` endpoints the mobile app already uses.

- **`/orders`** — real order history, requires login (matching the
  backend's own scoping — `GET /order` is buyer-scoped server-side).
  Shows each order's real computed total, currency, placed date, and
  real derived display status.
- **`/orders/[id]`** — real detail: the actual per-supplier split (one
  order can be fulfilled by multiple suppliers, each with its own
  status/tracking — same structure the admin dashboard and mobile app
  already show), real line items with quantities and prices, the real
  shipping address (or an honest "pending" state), and the real hub
  inspection timeline where one exists.
- **`AccountLink`** now has an "Orders" link alongside the existing
  saved-searches link.
- `lib/api.ts`: new `fetchMyOrders`/`fetchOrderById`, typed against the
  real backend DTO shape (`services/api/src/modules/order/routes.js`)
  rather than assumed.

**Verified end-to-end against the real running backend** — not just
code review: placed a real order for a real signed-up buyer, confirmed
it appears in that buyer's own order history with a real positive
total, confirmed order detail shows the real per-supplier split with
the correct real quantity and the real shipping address, and confirmed
— critically — that a **different** buyer genuinely cannot fetch
someone else's order detail (a real 404, matching the backend's own
ownership check, not just relying on the frontend to behave). Full
suite: 11/11 passing.

## Real wishlist (new)

**`components/WishlistButton.tsx`** — a real heart-toggle on the
product detail page, reusing the same real `GET/POST/DELETE
/wishlist/me/:productId` endpoints the mobile app already uses.
Requires a real logged-in account (unlike the cart, which works for
guests) — prompts to log in rather than silently doing nothing when
signed out.

**`/wishlist`** — a real management page, same login-gated pattern as
`/orders` and `/saved-searches`.

**Reuses `ProductSummary`, not a new type** — the backend's
`GET /wishlist/me` genuinely returns the same product DTO shape as
`GET /catalog/products` (it reuses the catalog module's own DTO-
building helpers directly — see
`services/api/src/modules/wishlist/routes.js`), so there was no real
reason to define a separate wishlist-item shape here.

**Verified end-to-end against the real running backend**: confirmed
`checkWishlisted` correctly starts `false`, confirmed adding a real
product flips it to `true` and makes it appear in the real list,
confirmed removing it correctly reverses both, and confirmed adding
the SAME product twice is genuinely idempotent (no duplicate entry,
no error) — matching the backend's own `ON CONFLICT DO NOTHING`
design. Full suite: 13/13 passing.

## Real review submission (new) — the missing half of reviews

**Reading reviews already existed** (server-rendered, real SEO value
on the product page). **Writing one didn't** — closed that gap.

- **`components/ReviewForm.tsx`** — a real star-rating picker, comment
  field, and up to 3 photos (reusing the same generic
  `/uploads/product-image` upload endpoint every other real photo
  upload in this project uses). Same "Your review is awaiting review"
  wording as `apps/mobile/lib/widgets/reviews_section.dart`, for
  consistency across platforms — every submission goes through real
  admin moderation before appearing publicly.
- **A real, honest handling of the verified-purchase gate**: if
  `require_verified_purchase_for_reviews` is toggled on and this buyer
  hasn't actually received the product, the backend's real 403 message
  is shown as-is, not swallowed into a generic error.
- `lib/api.ts`: new `submitReview`/`uploadReviewPhoto`.

**Verified end-to-end against the real running backend**: confirmed a
real submitted review comes back with real `pending` status, confirmed
the backend genuinely rejects a review with no rating, and confirmed
the verified-purchase flag correctly reflects the real underlying
state in BOTH directions — an order that never actually reached
`delivered` correctly does NOT grant verified status (deliberate
business logic, not a bug I found and then had to work around). Full
suite: 16/16 passing.

## Real referrals (new)

**A genuinely untouched gap, not previously flagged anywhere in this
README** — closed with the same `GET /referrals/me` endpoint the
mobile app already uses (a buyer's code is created on first request if
they don't have one yet, so there's no separate "generate a code"
action needed).

- **`/referrals`** — a buyer's own real code, a real copy-to-clipboard
  shareable link (`{SITE_URL}/signup?ref=CODE`), and real stats
  (friends referred, rewards earned out of the real cap).
- **`app/signup/page.tsx`** — a new optional referral-code field,
  auto-filled from a real `?ref=CODE` URL param when someone actually
  clicks a shared link (still manually editable for a code told to
  someone verbally). Required wrapping the form in a real `<Suspense>`
  boundary around `useSearchParams()` — the SAME hard requirement
  `app/checkout/confirmation/page.tsx` already discovered (a real
  production build fails outright without one, not just a warning).
- **`AuthProvider.signup()`** now accepts an optional `referralCode`,
  passed straight through to the real backend.

**Verified end-to-end against the real running backend** — the full
real loop, not just the API contract in isolation: signed up a real
referrer, confirmed their `totalReferred` starts at `0`, signed up a
SECOND real buyer using the referrer's real code (the exact same call
the signup page itself makes), and confirmed the referrer's real
`totalReferred` count genuinely incremented to `1` afterward. Full
suite: 18/18 passing.

## Real notifications (new) — the last remaining account feature

Reuses the SAME `GET`/`PATCH /notifications/me*` endpoints the mobile
app already uses (migration 019) — real notifications triggered by
real order-status changes, return-status changes, support-ticket
replies, price-drop alerts, and saved-search matches.

- **`components/NotificationBell.tsx`** — an unread-count badge in the
  header, mirroring `CartIcon`'s exact plain-text style (no icon
  library used anywhere in this app). Deliberately *polls* every 30s —
  unlike the cart, which only reacts to real local state changes the
  user causes in this same browser session, a notification arrives
  from a real SERVER-side event the user isn't directly causing here.
  Same reasoning as `apps/mobile/lib/features/orders/
  tracking_screen.dart`'s real auto-refresh fix earlier this session.
- **`/notifications`** — full list, mark-one-read (on click) and
  mark-all-read, with real deep links resolved from each
  notification's real `linkType`/`linkId`.
- **An honest, deliberate gap in the link resolution, not an
  oversight**: a `ticket`-type notification correctly resolves to
  `null` rather than a broken link — this storefront has no
  support-ticket UI at all (unlike the mobile app), so linking
  anywhere would point at a page that doesn't exist.

**Verified end-to-end against the real running backend**: created a
real support ticket, had a real admin account reply to it (the actual
trigger, not a fabricated notification row), confirmed the buyer's
real unread count went from `0` to `1`, confirmed the notification's
real `linkType` is `'ticket'` and correctly resolves to no link,
confirmed marking it read brings the count back to `0`, and confirmed
`markAllNotificationsRead` genuinely clears multiple real unread
notifications at once. Full suite: 21/21 passing.

## Real support tickets (new)

**A real, confirmed gap**: this storefront had no support-ticket UI at
all — the notification bell's own `resolveNotificationLink` had to
deliberately return `null` for ticket-type notifications specifically
because of this. Closed the same way returns was closed: found and
fixed the same real backend gap first (`GET`/`POST /support/
my-tickets/:id*` were `requireAuth` only, mirrored exactly to
`optionalAuth` + matching `guestEmail`), then built the real UI on
top.

- **`/support`** — two real modes: a logged-in buyer sees a real list
  (`GET /support/my-tickets`) plus a "New ticket" form; a guest gets a
  real ticket-ID + email lookup form plus a guest-email-required "New
  ticket" form (there's no "list all my tickets" for a guest without a
  real account — same reasoning as `/orders` and `/returns`).
- **`/support/[id]`** — real thread (messages, reply), working for
  both. If a guest lands here directly without `?guestEmail=` in the
  URL, shows a real inline email prompt rather than a 404.
- **`resolveNotificationLink` fixed** — a `ticket`-type notification
  now genuinely resolves to `/support/[id]`, closing the honest gap
  the notifications feature (built earlier this session) had to leave
  open at the time.

**Verified end-to-end against the real running backend**: filed a
ticket as a real guest, confirmed they can fetch it and reply with
zero login at all, confirmed a genuinely different (wrong) email is
rejected rather than leaking the ticket, and confirmed the existing
logged-in buyer flow is completely unaffected. Zero TypeScript errors.
Full suite: 35/35 passing (also confirmed several earlier, unrelated
failures during this same run were purely real stock depletion from
many hours of cumulative testing against this persistent database —
not a regression — resolved by reseeding, not by any code change).

## Real returns (new) — genuinely the last remaining gap, now closed

**`/returns`** — two real modes: a logged-in buyer sees a real list
(`GET /returns/my-cases`); a guest gets a real case-ID + email lookup
form instead (there's no "list all my cases" for a guest without a
real account — same reasoning as `/orders`).

**`/returns/[id]`** — real thread (messages, photos, reply), working
for both. If a guest lands here directly without `?guestEmail=` in the
URL, shows a real inline email prompt rather than a 404.

**Closes a real, separate gap found and fixed this session, not just a
missing page**: `GET`/`POST /returns/my-cases/:id*` were `requireAuth`
only — a guest who filed a return (already supported via
`POST /returns`'s `guestEmail`) had no way to ever check on it again.
Fixed at the backend, mirroring `GET /order/:id`'s own established
account-or-matching-guestEmail pattern exactly — see
`services/api/README.md`'s matching section.

**Verified end-to-end against the real running backend**: filed a
return as a real guest, confirmed they can fetch it and reply with
zero login at all, confirmed a genuinely different (wrong) email is
rejected rather than leaking the case, and confirmed the existing
logged-in buyer flow is completely unaffected. Full suite: 25/25
passing.

## Real promo code support at checkout (new)

**A real, confirmed gap**: the backend has always fully supported a
real promo code on order placement (real server-side validation, real
discount calculation via `services/api/src/modules/promotions/
helpers.js` — never a client-supplied discount amount), but checkout
never had anywhere to enter one.

- **New `validatePromoCode()`** — calls the backend's own real
  `POST /promo-codes/validate` (`optionalAuth` — works for a guest
  too), giving immediate feedback on whether a code is real and
  currently usable. Deliberately just an "is this code even real right
  now" check, not a discount preview — the actual, authoritative
  discount only ever comes from the real order-placement response
  itself. Replicating the backend's own discount math client-side
  (which handles shipping-portion logic for `free_shipping`-type
  codes) would risk silently drifting out of sync with the real logic
  over time.
- **`placeOrder()` extended** with an optional 4th `promoCode`
  parameter — every existing caller (and every existing test)
  completely unaffected.
- Checkout UI: a real Apply/Remove flow with real inline error
  messages (expired, doesn't exist, already used up — whatever the
  backend's own real reason actually says).

**Verified against the real running backend**: created a real promo
code as admin, confirmed a guest (no login at all) can validate it
successfully, confirmed a nonexistent code is genuinely rejected with
a real reason, and — critically — placed two real orders for the same
real product (one with the code, one without) and confirmed the
difference in their real, server-computed totals is exactly the real
discount amount, not a client-side guess. Zero TypeScript errors. Full
suite: 38/38 passing.

## Real category photos on the home page (new)

**A real, confirmed gap, found by following up on the recent brand/
category work**: the backend has required a real photo on every
category since migration 046, but the home page's "Shop by category"
section never fetched or displayed it — plain text buttons only.

- **`ProductCategory` interface** extended with `photoUrl`.
- Each category card now shows its real photo (via the same
  `resolveImageUrl` helper product images already use), with an
  honest "No photo" fallback for a category that doesn't have one
  (e.g., one created before this requirement existed).

**Verified against the real running backend AND the real rendered
page**: confirmed real category photo URLs genuinely appear in the
actual rendered HTML (via the real dev server, not just the API
response in isolation), and confirmed the "No photo" fallback
correctly renders for categories without one.

**Also fixed, found while doing this work, unrelated to it**: a real
test-fragility bug in the promo code test from batch 36 —
`pickInStockProduct()` could pick a real product priced under a flat
$10 discount (a real $6.90 product exists), and the backend correctly
caps a flat discount at the order's own subtotal (an order can't go
negative) — not a bug in the discount logic, just an exact-equality
test assertion that wasn't robust to which product got picked.
`pickInStockProduct()` now takes an optional `minPrice`, used by that
one test. Zero TypeScript errors. Full suite: 38/38 passing.

## Real out-of-stock indicator on the wishlist page (new)

**A real, confirmed gap, found while following up on the new
back-in-stock alerts feature (`services/api/README.md`)**: the
wishlist page had no stock-status display at all — a buyer couldn't
tell which saved items they were genuinely waiting on without clicking
into each one. No backend change needed: `fetchWishlist`'s response
already included `stockQuantity` the whole time (same real DTO builder
the main catalog listing uses), this was purely a missing display.

**Confirmed NOT a gap on mobile**: the mobile wishlist screen reuses
the same shared `ProductCard` widget the home feed uses, which already
shows real in-stock/out-of-stock status — checked directly before
assuming any mobile work was needed.

**Verified**: confirmed the real backend genuinely returns
`stockQuantity: 0` for a real product set to zero stock via the
supplier portal. Zero TypeScript errors. Full suite: 35/35 passing.

## Real pagination on /search (new)

**A real, confirmed gap**: `GET /catalog/products` had no pagination
at all — every visit to `/search` fetched the ENTIRE real catalog on
every request (119 real products and growing).

- **New `fetchProductsPaginated()`** — a separate function from the
  existing `fetchProducts()` (which every other caller, like the home
  page and wishlist, keeps using completely unaffected). Reads the
  real total count from the backend's new `X-Total-Count` response
  header.
- **`/search`** now shows the real total count (not just the current
  page's count), and real Previous/Next pagination controls — only
  rendered when there's genuinely more than one real page. Preserves
  every other active filter (search term, category, vehicle fitment)
  while paging, so paging through results doesn't silently drop
  whatever the buyer was actually filtering by.

**Verified end-to-end against the real running backend AND the real
rendered page**: confirmed unbounded behavior elsewhere (home page,
wishlist) is completely unaffected, confirmed the real rendered
`/search` page (via the actual dev server) shows genuinely different
real products on page 1 vs. page 2 (not the same page repeated),
confirmed the real total count and page controls render correctly.
Full suite: 35/35 passing.

**Also fixed, while chasing down a recurring failure this surfaced,
not a new regression**: several existing order-placement tests
grabbed `products[0]` unconditionally and assumed effectively
unlimited stock — across many hours of real, cumulative test runs
against this same persistent database, a few specific products' real
stock genuinely ran down to 0 (batch 11's own real stock-validation
feature correctly rejecting the order, not a bug in that feature).
Added a shared `pickInStockProduct()` helper and fixed all 7 affected
tests at the actual root cause, rather than reseeding the database
again each time this recurs.

## Real vehicle-fitment filter for search (new)

**A real, confirmed gap**: this storefront had zero vehicle-based
filtering at all — unlike the mobile app, which has both a search
vehicle picker and My Garage, both built on the real, structured
Brand→Model→Generation cascade (`product_fitment_entries`, migration
010) every real product's fitment is actually stored in.

- **`components/VehicleFilter.tsx`** — a real Client Component (needs
  interactive cascading fetches as a buyer picks each level), reusing
  the exact same `GET /fitment/brands` → `/brands/:id/models` →
  `/models/:id/generations` cascade the mobile app and supplier portal
  already use. A single-year generation applies immediately rather
  than making the buyer pick from a list of one.
- **Navigates via real URL search params** (`generationId`, `year`)
  rather than local-only state — `/search` itself stays a real Server
  Component doing the actual filtering server-side, the same way
  `category`/`q` already work, so a search engine can index each real
  filtered result page on its own, with its own real URL.
- **`fetchProducts()`** extended with `generationId`/`year`, calling
  the same real backend filter the search vehicle picker's own
  earlier work (`services/api/README.md`'s "Brand/Model/Generation
  (Year) filter for search") already built and verified.
- **Deliberately NOT the flat, unpopulated-for-matching reference
  system** — the exact real bug `apps/mobile/README.md`'s "My Garage"
  section describes fixing; this was built directly on the real,
  populated system from the start.

**Verified end-to-end against the real running backend AND the real
rendered page** — not just the API contract in isolation: confirmed
the full real Brand→Model→Generation→Year cascade returns real data at
every level, confirmed filtering by a real generation+year genuinely
narrows to real matching products (54 of the full catalog, neither
zero nor everything), confirmed a nonexistent generation returns
genuinely zero, and confirmed the real rendered `/search` page (via
the actual dev server, not just curl against the API) shows the
correct real count and "matching your vehicle" copy in its real
server-rendered HTML. Zero TypeScript errors. Full suite: 32/32
passing.

## Real account-aware checkout + saved addresses (fixed — a bigger gap than the README once described)

**A real, more fundamental bug found while scoping "saved-address
checkout" (a next-step this README itself listed)**: checkout never
recognized a logged-in buyer at all — `placeGuestOrder` always sent
`guestEmail`, even when `useAuth()` (already used elsewhere in this
app) would have shown a real logged-in user. Every single order placed
through this storefront became a guest order, `buyer_id` null,
completely disconnected from the real account that was logged in the
whole time — checked directly against the real backend, not assumed.

- **Renamed `placeGuestOrder` → `placeOrder`** to match its real,
  dual purpose, and made `app/checkout/page.tsx` genuinely check
  `useAuth()` — the actual missing piece.
- **A logged-in buyer now sees their real saved addresses** (reusing
  the SAME `GET/POST /addresses/me*` endpoints the mobile app already
  uses, migration 017 — up to 3, enforced by the backend, not
  re-checked here), can pick one directly, or add a new one with an
  optional "save for next time."
- **Guest checkout is completely unchanged** — same manual-entry flow
  as before this fix, for anyone not logged in.

**Verified end-to-end against the real running backend**: placed a
real order as a real logged-in buyer with a brand-new address and
confirmed it's genuinely attached to that account (found via the
account's own real order-history endpoint, not just trusting the
response) — not a guest order; placed a second real order using a real
previously-saved address by ID and confirmed the order's real shipping
address matches it; confirmed guest checkout still places a real order
exactly as before; and confirmed the real 3-address cap is enforced
and surfaced correctly to the client. Zero TypeScript errors. Full
suite: 29/29 passing.

## Next steps to make this real

1. **Verify the real Google Fonts fetch** once deployed somewhere
   with real internet access (see the honest limitation above).
2. **Verify the confirmation page's client-side hydration** in a real
   browser — logically correct but only verified via curl here (see
   the cart/checkout section above).
3. ~~**Remaining account feature**: saved-address checkout (pick a
   previously-used address instead of typing it every time) — login/
   signup and order history are already real (see their own sections
   above); this is the genuine remaining next pass.~~ **Done** — see
   "Real account-aware checkout + saved addresses" above. Turned out
   to be a bigger fix than this note implied: checkout wasn't even
   account-aware at all before this pass.
4. **A real, production domain** for `NEXT_PUBLIC_SITE_URL` — the
   sitemap and metadata currently default to `localhost`.
5. **Real analytics** (e.g. Google Search Console verification) once
   deployed, to actually track real search-visibility results.
6. **Image optimization** — `next/image` was deliberately not used
   for product photos (see the code comment in `app/page.tsx`), since
   photo origins are runtime-configurable (local vs. cloud storage)
   and `next/image`'s domain allowlist isn't set up for that yet in
   this project. Worth revisiting once a single, real, fixed image
   host is settled on.

## SEO: what search engines are told (all in `lib/seo.ts`, tested in `lib/seo.test.ts` and `app/seo-routes.test.ts`)

**The rule behind everything: only real data.** Titles, descriptions and structured data are built from what a product really has. A field it does not have (a part brand, a condition, a rating nobody gave) is left out, never invented, because search engines penalise made-up data.

- **Product pages**
  - *Title:* the name, then `OEM <part number>`, then the vehicle (`Brand Model Year`), as much as fits about 62 characters (people search by part number and by car). The layout adds ` | Leap Auto Parts`.
  - *Description:* the product's own words (short), then part number, fitment, stock, price and delivery.
  - *Canonical address:* `/products/<id>`, plus share-card tags (`og:` and `twitter:`).
  - *Structured data* (schema.org JSON-LD, escaped so a product name cannot close the script tag): a `Product` with its real offer (price, currency, in stock or out of stock, part number as `mpn`), a `BreadcrumbList` (Home, category, product), and an `AggregateRating` **only when real reviews exist** (the stored seed rating is never used). Not stated on purpose: `brand` (the storefront is not given the part's manufacturer) and `itemCondition`.
- **Search pages:** a **category page** (`/search?category=brake`) is a real landing page: indexed, titled "Brake System parts", canonical to itself. Every other combination (a typed query, a vehicle filter, page 2...) is **followed but not indexed** (`noindex, follow`) and points at the category page as the one real version.
- **Home page:** a canonical address and `Organization` + `WebSite` data (with the site's search box).
- **Private pages** (`PRIVATE_PATHS`: cart, checkout, login, signup, orders, wishlist, notifications, returns, support, referrals, saved-searches) are kept out **two ways**: `robots.txt` disallows them and each section has a `layout.tsx` with `noindex, nofollow` (they are client components, which cannot export metadata themselves). A test compares the list with the real folders, so **a new section that is neither public on purpose nor listed as private fails the tests**.
- **`/robots.txt`** allows the site, disallows the private paths and points at the sitemap. **`/sitemap.xml`** lists the home page, the catalog, every **category that has products**, and every product (at most 50,000 addresses: split it with `generateSitemaps` when the catalog outgrows that). It has **no `lastModified`, `changeFrequency` or `priority`**: products have no honest "last changed" date (prices are worked out live), and a sitemap that says "changed just now" for every page teaches Google to ignore it. It refreshes with the product data (`REVALIDATE_SECONDS`, 60).
- **The other web pages of the project** (the three portals and the web builds of the two phone apps) say `noindex, nofollow` (checked in `apps/admin-dashboard/src/webIndexing.test.js`). Only the storefront belongs in search results.

**In production you must:** set `NEXT_PUBLIC_SITE_URL` to the real **https** address (it defaults to `http://localhost:3001`, and every canonical address and the sitemap use it), serve the storefront publicly, then register it in Google Search Console and Bing Webmaster Tools and submit `/sitemap.xml`. Remove test products and fake review counts first (`node scripts/remove-test-data.js` in `services/api`); the launch checker lists them.

**Not done yet (the biggest remaining wins):** an Arabic version of the site (`lang="ar"`, right to left, with `hreflang` links), category/part/vehicle landing pages beyond the category page, readable product addresses (keywords instead of ids), and a product feed for Google Merchant Center.

**Run the tests:** `cd apps/web-storefront && npm test` (the API integration tests need the backend running). They are not part of `scripts/run-tests.ps1`.

## The storefront is being brought to the same features as the mobile app (stages)

The mobile app has 44 screens and the storefront had far fewer. The full list of what is missing, and the design of every screen (theme "Navy Workshop", the colours of the Leap logo), is agreed; it is built in stages, each tested before the next:

- **Stage 1a (done): foundation.** English and Arabic with real `/ar` addresses and right-to-left layout, the Navy Workshop theme, the new header, menu, footer and home page, Arabic names from the server on the home, search and product pages, and the search-engine work above kept correct for two languages.
- **Stage 1b (done): garage and finding parts.** See "Stage 1b" below.
- **Stage 1c (done): the full product page.** See "Stage 1c" below.
- **Stage 2 (done): buying.** The cart, the checkout and the address book. See "Stage 2" below. (Real online payment is NOT part of it: see there.)
- **Stage 3a (done): orders after the sale.** See "Stage 3a" below.
- **Stage 3b (done): returns and support.** See "Stage 3b" below.
- **Stage 4a (done): account and sign-in security.** See "Stage 4a" below.
- **Stage 4b (next): the rest of the account.** Quote requests ("My requests"), referrals with their history, notifications, wishlist and saved searches in the new look and in Arabic.

**Cut on purpose:** "Work with Leap" (the menu item and the "Join now" block of the existing website). Not on the web: app lock and the update gate; push notifications become email.

## Languages: English and Arabic (`lib/i18n.ts`, `proxy.ts`)

The language is part of the **address**: `/ar/search` is the Arabic search page, `/search` the English one. `proxy.ts` (Next 16's name for middleware) turns `/ar/...` into the normal route and passes the language to the page in a header (`x-leap-lang`), **always overwriting it**, so a visitor cannot choose the language by sending the header. Every page therefore exists once; nothing was moved.

- **Server Components** read the language with `getLang()` (`lib/lang.ts`); **Client Components** with `useLang()` / `useT()` (`components/LangProvider.tsx`). Texts live in the two dictionaries in `lib/i18n.ts`: a key without an Arabic text is a compile error, a test checks the Arabic is real Arabic and that both languages use the same `{placeholders}`, and a missing translation falls back to English (never blank).
- **Links and navigation keep the language automatically:** every `Link` in the storefront is `components/LocLink.tsx` (it adds `/ar` in Arabic and leaves full URLs and anchors alone), and `router.push` goes through `components/useLocRouter.ts`. Use those, not `next/link` or `useRouter`. A plain HTML `<form action>` must use `localizePath(lang, "/search")`.
- **Names from the server** are asked for in the page's language (`lang=ar` on the product calls) and categories, brands and models use their Arabic name when they have one (`pickName`).
- **Search engines:** each language's page names ITSELF as canonical, lists both languages with `hreflang` (`alternatesFor` in `lib/seo.ts`), the sitemap lists every page twice (English and `/ar`) pointing at each other, and robots blocks the private pages in both languages. The page's `<html lang dir>` is set from the address.
- **Still English for now (their stage):** the cart, checkout, orders, returns, support, notifications, referrals, wishlist, login and sign-up pages (they already work in Arabic addresses and right-to-left, with English text). Where a page has Arabic, it has all of it.
- **Arabic wording is a first version**, written to match the mobile app's own Arabic: have a native speaker review `lib/i18n.ts`.

## Theme: "Navy Workshop" (`app/globals.css`, `components/SiteHeader.tsx`)

Navy `#0B3146` and yellow `#F9B317` (from the logo), Outfit for English and IBM Plex Sans Arabic for Arabic (Outfit has no Arabic letters, so Arabic falls through to the second font). Header: thin bar (tagline, support, language), main bar (logo, search, account, wishlist, alerts, cart), menu (Home, Products, Sections), and a yellow announcement line. Tailwind logical utilities (`ms-`, `end-`, `start-`) are used in new code so right-to-left flips by itself; the older pages still use some left/right classes.

**Settings:** `NEXT_PUBLIC_SITE_URL` (the public https address), `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_LEGAL_BASE_URL` (default `https://www.leapautoparts.com`: the footer links to the policy pages that already exist there, in the visitor's language, instead of copying them). The two announcement lines and the top tagline are texts in `lib/i18n.ts` (`announce_warehouse`, `announce_shipping`, `util_tagline`); they are the wording of the existing website, so edit them when they change.

**Tests:** `npm test` (unit tests; `lib/api.integration.test.ts` needs the backend running). `lib/i18n.test.ts`, `proxy.test.ts`, `components/LocLink.test.tsx` and `app/pages-i18n.test.tsx` cover the language rules, the proxy, the links, the home page and the layout in both languages.

## Stage 1b: garage and finding parts (the mobile app's own rules, on the web)

- **My garage** (`/garage`, signed in): the cars the buyer saved, the SAME garage the mobile app shows (the server's `/garage/me`). The first saved car becomes the default; the default can be changed; a car can be removed; adding is brand, then model, then year. A car's picture is its year photo, else its brand photo. One buyer never sees another's cars (the provider throws the previous buyer's list away when somebody else signs in).
- **"Shopping for"** bar under the menu (signed in): the default car, linking to its parts, with Change. **"Fits my car"** switch on the search page filters to the default car. Neither is shown to a visitor who is not signed in.
- **Find a part** (`/find`, public and indexed; `/find?tab=vin|part|symptom` opens a tab), four ways in, the same four as the app:
  - **Which-part wizard:** car (from the garage, or brand/model/year, or none), then section, then the specific part, then the search filtered by category, part and car. A **part page** (`/search?category=brake&part=Front%20Brake%20Disc`) is a landing page of its own: indexed, with its own title and canonical address (with a car, a query or page 2 it is kept out of the index and points back at the part page).
  - **VIN:** validated first (17 characters, no I, O or Q), decoded by the server, then matched to OUR vehicles with the app's exact rules (`lib/vin.ts`: brand, then model, then the generation whose years contain the year). It says exactly how far the match got (a car, only a model to choose, only a brand, unknown brand, unrecognised) and never guesses; signed in, a found car can be saved to the garage.
  - **Part number:** typed, or a barcode read by the browser's own `BarcodeDetector` from the live camera or from a photo (nothing is uploaded). Browsers without it (Safari, Firefox) are told so and shown typing. **Reading a printed part number from a photo (OCR) is not on the web**: the app does it on the phone; doing it in a browser needs a large OCR engine, so it is left for a later decision.
  - **Symptom:** the app's 8 symptoms with the app's search words (a test reads the mobile app's source, so the two cannot drift apart).
- **Compare** (`/compare?ids=a,b,c`, private): from the **wishlist** (a Compare button picks 2 to 4 saved parts), like the app. Rows: price, rating, stock, delivery, OEM number, weight, verified seller, ships from, in the page's language (the country in Arabic when the server has it). The parts are in the address, so a comparison can be shared. (The OEM cross-reference, the same part number from other suppliers, is a section of the product page, in Stage 1c.)
- **Currency** (the switch in the top bar, shown once the server has rates): every price is in US dollars; the buyer may SEE it in another currency, converted with the server's `/pricing/display-rates`, in whole units, with the Arabic symbol and Arabic digits for the Arab currencies on the Arabic site (`lib/currency.ts`, the app's rules). The choice is remembered in the browser; without one the default comes from the browser's region (ar-SA gives riyals) when the server has a rate for it. **Display only: the order is still placed and charged in US dollars.** It is applied to the product cards, the product page, the cart, the wishlist and compare; the checkout and the order pages (Stages 2 and 3) are rebuilt then.
- **Search-engine rules for the new pages:** `/find` is public and in the sitemap in both languages; `/garage` and `/compare` are private (noindex, blocked in robots in both languages).

**Tests:** `npm test` (the new unit tests: `lib/vin`, `lib/currency`, `lib/symptoms`, `lib/garage`, `lib/compare`, `components/stage1b-providers`, `components/FindTools`, `app/stage1b-pages`). `lib/api.stage1b.integration.test.ts` runs the new calls against the real backend (the garage lifecycle, VIN decoding, the parts of a category, the part filter, the display rates, Arabic) and needs it running.

## Stage 1c: the full product page (the mobile app's sections, in its order)

The product page now has what the app's has. Each section is drawn only when it has something to show, and the lists are drawn on the SERVER (so they are in the page's HTML for a search engine); only the interactive parts run in the browser.

- **Gallery:** every photo, arrows and thumbnails, the arrow keys (reversed in Arabic), the position announced to screen readers. **Share:** the device's share sheet where there is one, else the link is copied. **Confirmed fit:** shown when the buyer's default car is in the part's fit list (the app's rule, by generation). **Notify me when back in stock** on a sold-out part: like the app, the notification IS the wishlist (saving the part is how the buyer asks to be told).
- **"Same part, other listings"** (the OEM comparison): the same OEM part number sold by other suppliers, with price, stock, delivery and verified sellers. **Reviews:** the average and count, three at a time, with photos and the verified-purchase mark. **Customer photos:** the photos buyers added to their reviews. **Similar products.** **"More {brand} parts"** and **Newest products**, ten at a time with "Show more" (more pages exactly when the last page the server sent was full).
- **Writing a review (signed in):** a star rating (required), an optional comment, up to 3 photos (uploaded to the same endpoint the app uses). One review per buyer per part: writing again EDITS it, and it goes back to a moderator, so the buyer sees "awaiting review" or "not approved". Only buyers who received the part can review (the server's rule): refused, the page words it itself from the server's code (`review_requires_purchase`), in the buyer's language. **Reporting a review (signed in):** a reason is required. Rules in `lib/review.ts`.
- **Not here, on purpose:** the app has **no price-drop alert button** (price drops are an automatic signal for wishlisted parts, so none was built), and no product video. **"Request a quote" and "Ask about this part"** are left to the stages that build quote requests and support (an empty link would help nobody).
- **Bug found by the tests and fixed:** the newest-parts grid hid the current part BEFORE deciding whether more pages exist, so a full first page containing it looked short and "Show more" disappeared. It now decides on the page as the server sent it (`LoadMoreGrid`).

**Tests:** `components/stage1c-components.test.tsx`, `components/ReviewsSection.test.tsx`, `app/stage1c-page.test.tsx`, `lib/review.test.ts`, and `lib/api.stage1c.integration.test.ts` against the real backend (other listings, similar, same brand paging, the review refusal code, editing without duplicating, reporting).

## Stage 2: cart, checkout and address book (the mobile app's own rules, on the web)

**Payment is not collected online, in the app or here.** The server has Stripe, PayPal and Amazon Payment Services endpoints (`POST /payment/intent`, `/payment/paypal/capture/:orderId`), but nothing calls them, and placing an order records no payment method or status. The app's checkout shows the payment methods the admin set up for the buyer's country as a CHOICE and then places the order, and the web does exactly the same (the choice is not sent with the order). Collecting payment online would be new work in both apps and on the server (keys, confirming payments, marking orders paid): a separate decision.

- **Cart** (`/cart`): each part with its photo, supplier label, line total, the struck-through price when on sale, "Price updated since you added this" when it moved, and the app's stock hint (nothing until 5 or fewer would remain, then "Only N left in stock", then "You've reached the available stock", with "+" off at the limit). Removing says so and offers Undo. The estimated weight is shown when any line has one. The summary shows the ONE discount the server applied (the bigger of the loyalty discount and the promo code; `appliedDiscountSource`), what was saved, and the total. **The cart now sends the signed-in buyer's token on every call** (before, the server could never apply their loyalty discount or attach the cart to them) and the page's language (Arabic names), and is loaded again when either changes. After an order the cart becomes a new empty one at once (the header count used to stay stale until a reload).
- **Checkout** (`/checkout`), in the order of the app: who is ordering (a guest gives an email; a signed-in buyer's is shown), the delivery address, the payment method (choice only), "Wait and ship together" (only when the cart has parts from more than one supplier; sent as `waitForAllShipments`), the summary with the discount and total, a promo code (put on the CART, so the server checks it and says why when it refuses), and Place order. **Prices are locked when the checkout opens** (`POST /cart/:id/lock-prices`, like the app) and a note says so. A part with less stock now than in the cart is named and blocks the order until fixed. **The same order can never be placed twice**: every order carries an idempotency key, so a double click or a retry returns the first order; the key is kept when no answer came back at all and replaced when the server refused the order. Unlike the app (which asks a guest for the address after the order, using their location), the web asks for the address up front, which the server supports; "Use my location" fills it in the same way.
- **Address form** (`components/AddressFields.tsx`, `lib/address.ts`): the country is chosen from the 40 launch markets (listed in Arabic on the Arabic site, always stored and sent in English, which is what the server resolves), Saudi Arabia needs its address code (four letters and four numbers, stored in capitals), the phone, city and street are required, state and postal code optional. **"Use my location"** asks the browser for the position and OpenStreetMap's Nominatim (the same service, called from the browser, with the same rules as the app: house number and road as the street, the first of city, town, village, county as the city). It is an aid: a refusal or a failure just leaves the form to be typed, and a country we do not serve is not accepted from it.
- **Address book** (`/addresses`, signed in, private): up to three saved addresses (the server refuses a fourth), one the default, added, edited and deleted (with a confirmation) exactly as in the app. Linked from the account menu and the footer.
- **Order confirmation** (`/checkout/confirmation`): names the order; a GUEST is offered "Save your order history" with their email carried to sign-up (`/signup?email=`). A signed-in buyer gets "View your order". **Order pages for guests are not on the web yet** (they come with the orders stage), so "View your order" is only shown to signed-in buyers.
- **Server errors in Arabic:** every place the storefront turns a failed server reply into a message now goes through `lib/serverMessages.ts`, the mobile app's own list of 85 Arabic messages (generated from `apps/mobile/lib/core/server_messages.dart`; a test compares the two so they cannot drift apart). A message not in the list stays English, never blank.
- **Texts:** 83 of the cart, checkout and address texts are the app's own English and Arabic (so the two say the same things); the rest are written for the web and their Arabic needs a native speaker's review (`lib/i18n.ts`).

**Tests:** `npm test` runs the unit tests (`lib/stage2-logic`, `components/stage2-cart`, `app/stage2-cart-checkout`, `app/stage2-account-pages`). With the backend running, `npm run test:integration` runs `lib/api.stage2.integration.test.ts` (the cart as a signed-in buyer, the price lock, promo codes, payment methods, the address book, orders, and the duplicate-order protection against the real server) and `app/stage2-e2e.integration.test.tsx`, which drives the REAL checkout, cart and address pages with the REAL cart and sign-in providers against the REAL backend (only the router is replaced) and then checks the orders and addresses that actually landed. Nothing has been run in a real browser.

## Stage 3a: orders after the sale (the mobile app's own rules, on the web)

- **My orders** (`/orders`): how many shipments are active (the app's rule: shipped, to ship or processing), what was spent this year (`/order/me/annual-summary`), and every order with its status (the app's own status words, in Arabic too). **Track an order** works for anyone: an order ID and the email it was placed with open `/orders/<id>?guestEmail=...`. There are no status tabs: the app has none.
- **Order detail** (`/orders/<id>`, signed in or with `?guestEmail=`), part by part (one card per supplier): the stage as a four-step timeline, the tracking number, the items, the proof-of-delivery photos when the courier sent them, the delivery address, the discount and the total. **Stage rules** (`lib/orders.ts`, the app's own): a part is "preparing" until the hub has sent it on (a supplier's "shipped" only means it reached OUR hub), "shipped" once the hub sent it to the buyer, "delivered" when it arrived; "dispute" is never shown to a buyer.
- **Cancelling:** the whole order can be cancelled only while EVERY part still can (not once a part is on its way or delivered, nor after it went back to the supplier or was discarded at the hub); when only some parts can, each of those gets its own "Cancel this part". Both ask first. A guest cancels with their email. The server enforces every rule again and its reason is shown if it refuses.
- **Request a return:** on every part (the server enforces the return window after delivery, 7 days unless the admin changed it, and says so): a reason and details (both required) and up to three photos (signed-in buyers only, like the app; a guest is told). It goes to the Leap team, who coordinate with the supplier. The buyer is given the link to the return case.
- **English address check:** the inspection hub reads the address in English. When the server's automatic English version has not been confirmed yet (`addressEnglish.source` is "auto"), the buyer is asked to check it: "It is correct" confirms it, "Edit" corrects it in English letters only (Arabic letters are refused here and by the server).
- **Receipt:** "Download receipt" saves the server's PDF (in the page's language). **The sign-in token is sent in a header, never put in a link** (the app has to put it in the address because it opens the PDF in an external viewer; the website does not, so it cannot end up in a browser history or a log). A guest's email is used the way the app does.
- **Reorder:** puts every item of the order back in the cart, one by one; items that cannot be added (gone, out of stock) are named and do not stop the others.
- **Track your package** (`/orders/<id>/tracking`): each part's timeline in the page's language, the tracking number, and the app's "taking longer than expected" notice; it **refreshes itself every 20 seconds while open** (and not while the tab is hidden), like the app.
- **Guests:** the checkout's confirmation page now links a guest to their order. Every order page works with `?guestEmail=`; the server answers "not found" (never "forbidden") to a wrong email, to another buyer, and to anyone else.
- **Texts:** 65 of the order texts are the app's own English and Arabic (including the 7 status words); the rest are written for the web and their Arabic needs a native speaker's review (`lib/i18n.ts`).

**Tests:** `npm test` (quick, no server needed; see "Running the tests"). The new unit tests are `lib/orders` (the rules) and `app/stage3a-pages` (the pages). With the backend running, `npm run test:integration` runs `lib/api.stage3.integration.test.ts`, which checks the calls against the real server (an order as a buyer and as a guest and that strangers get "not found", tracking, a real PDF receipt in both languages, the English address check, cancelling, return requests) and `app/stage3a-e2e.integration.test.tsx` drives the REAL order pages with the REAL cart and sign-in against the REAL server and checks the result there (a guest cancelling, reorder into the real cart, a real PDF, a real return request, the English address confirmed). Nothing has been run in a real browser.

## Running the tests

- **`npm test`**: the quick tests (unit and component tests). They need **no backend and no database**, and never skip. The number of parallel workers is capped at 4 so a machine with many cores does not run out of memory.
- **`npm run test:integration`**: the tests that talk to the REAL backend and database (every `*.integration.test.*` file, including the end-to-end ones that drive the real pages). Start the backend first (`scripts\start-leap.cmd`). The files run **one after another**, because they share one backend and one database. If the backend is not running they skip (with a note), they do not fail.
- **`npm run test:all`**: both, one after the other.
- **Data the tests do not create:** a few older tests depend on data already in the database. The vehicle-filter test needs at least one product with vehicle fitment; it looks for a car that really has products instead of assuming one, and when the database has none it is reported as **skipped, with the reason** (not failed).
- **Stock:** these tests place real orders and every order uses up stock. They ask `lib/testSupport.ts` for a product with plenty in stock, and when none has, it **restocks one of the seeded supplier's own products to 500** through the supplier API (`supplier@leap.dev`). So repeated runs do not run the database dry (they used to, with "No real product with enough stock"). The helper needs `supplier@leap.dev` to own at least one product that is on sale; if not, the message says to reseed or restock by hand.

## Stage 3b: returns and support (the mobile app's own rules, on the web)

- **Support** (`/support`): the app's three counters (all tickets, open requests, resolved: "resolved" means resolved or closed), the list of tickets with their status, and **New ticket** (a subject and what is wrong; a guest also gives an email, which must look like one). A ticket can be about an order (`/support?orderId=...`). A guest who is not signed in gets **Track a ticket**: the ticket ID and the email it was filed under open `/support/<id>?guestEmail=...`. The page says, as the app does, that the message goes to the Leap team and not to the supplier.
- **A ticket's conversation** (`/support/<id>`): the Leap team's messages on one side (`senderRole: "admin"`) and the buyer's on the other, a reply box, and **it refreshes itself every 20 seconds while open** (and not while the tab is hidden). **"Was this resolution helpful?"** (Yes / No) is asked once, only for a ticket that is resolved or closed and has not been answered; the server refuses it earlier and the page shows its reason. A guest without the email in the address is asked for it ("Enter the email this ticket was filed under to view it").
- **Returns** (`/returns`, `/returns/<id>`): the buyer's return requests (the reason, the order it is for, the status in the app's words, in Arabic too), **Track a return** by case ID and email for anyone, and the conversation of a return: its photos, the messages (the team's apart from the buyer's), a reply box and the same 20-second refresh. A return is **made** from the order page (Stage 3a).
- **Contact us** (`/contact`, public and indexed, in the sitemap in both languages): two cards, like the app's: Support and Report a bug. Linked from the footer.
- **Report a bug** (`/report-bug`, kept out of search engines): what happened (required) and, for a signed-in buyer, an optional screenshot; it is sent with what the browser is (the app sends the phone model). **Nothing in the admin dashboard reads bug reports yet**: they are saved in the `bug_reports` table of the database and someone has to look there.
- **Photos must be at least 800 px on their shortest side** (the server's own rule, for screenshots and return photos alike); a smaller one is refused and the page shows the server's reason instead of a vague "could not submit".
- **Tickets and returns compare the guest's email exactly, capitals included** (`Sam@x.com` is not `sam@x.com`), unlike orders, which ignore capitals. The website keeps the email exactly as typed through the whole flow, so it works; a guest who types it differently later gets "Not found". Making the server ignore capitals here too is a small server change that has not been made.
- **Texts:** 53 of the new texts are the app's own English and Arabic (including the 8 ticket and return status words); the rest are written for the web and their Arabic needs a native speaker's review (`lib/i18n.ts`).
- **Tests:** `lib/support` and `app/stage3b-pages` (quick); `lib/api.stage3b.integration.test.ts` (the real server: tickets and returns as a buyer and as a guest and that strangers get "not found", the Leap team answering and changing a status through the admin API, feedback refused while open and kept once resolved, bug reports with a real 800 x 800 screenshot upload and a too-small one refused) and `app/stage3b-e2e.integration.test.tsx` (the REAL pages with the REAL providers against the REAL server) run with `npm run test:integration`.

## Stage 4a: account and sign-in security (the mobile app's own rules, on the web)

- **A real bug fixed: two-step sign-in.** When an account has two-step sign-in on, the server does not answer a correct password with a session but with `{ requiresTwoFactor, userId }`. The website's login ignored that and stored the word "undefined" as the sign-in token, so such a buyer could not sign in on the web at all. Now the password step returns `{ status: "two_factor", userId }`, the login page asks for the 6-digit code, and only the code (`POST /auth/login/2fa`) gives a session. A reply with no token or no user is never turned into a session (login, the code step and sign-up all check).
- **Login** (`/login`): email and password, the code step, "Forgot password?" and "Sign up". `?next=/checkout` sends the buyer back where they were, but **only to a path on this site** (`lib/auth.ts` `safeNext`): `https://other-site`, `//other-site` and `/\other-site` are ignored, because otherwise a link in a phishing email could send a buyer to another site the moment they typed their password. **Sign-up** (`/signup`): email, password (at least 8), optional name and referral code; `?email=` (from the checkout's "create an account" step), `?ref=` and `?next=` are understood.
- **The sign-in cookie** is written with `SameSite=Lax` (the browser does not send it with a form posted from another site) and `Secure` when the site is on https. **Set the site's address to https in production** (`NEXT_PUBLIC_SITE_URL`) so the flag is on.
- **Forgot password** (`/forgot-password`): asks for the email and always answers "If that email is registered, a reset link has been sent." (the server answers the same whether or not the address has an account, so nobody can find out who is registered). **The link in the email opens a page the BACKEND serves** (`GET /reset-password?token=...`), so the website has no reset page of its own; that page's language and look are the server's.
- **My account** (`/account`, with a side menu on every account page, `components/AccountShell.tsx`): the buyer, their photo (change it: uploaded, saved to the account), their numbers (vehicles, orders, wishlist), unread notifications, the **loyalty card**, sign out, and **delete account** (asked twice, like the app: whether, then the password; a wrong password deletes nothing and does not sign out; the order history is kept, the personal data is removed). Not signed in: "You're browsing as a guest" with Log in and Sign up.
- **My tier** (`/account/loyalty`): where the buyer stands, their lifetime spend and every tier with its discount and what unlocks it (names in Arabic where the server has them; colours and icons the app's).
- **Change email** (`/account/change-email`): the new email and the current password. The server answers with a NEW sign-in token for the new email, which is adopted at once, so the buyer stays signed in; the new email signs in and the old one no longer does.
- **Two-factor authentication** (`/account/two-factor`): turn it on (scan the QR code or type the key into an authenticator app, then give the 6-digit code) or off (with the password). A wrong code or password changes nothing.
- **There is no "change password" page**: the app has none either (only the reset by email). The server has the call (`PATCH /auth/me/password`); say if you want it.
- **Texts:** 83 of the new texts are the app's own English and Arabic; about 17 are written for the web and need a native speaker's review (`lib/i18n.ts`).

**Tests:** `npm test` (the new ones: `lib/stage4-logic`, `components/stage4-auth`, `app/stage4-pages`). With the backend running, `npm run test:integration` runs `lib/api.stage4.integration.test.ts` (the **whole two-step lifecycle with REAL authenticator codes**: setup, a wrong code refused, confirm, the password alone giving NO token, the code giving one, then turning it off; changing the email; the photo; loyalty; the neutral reset answer; deleting an account) and `app/stage4-e2e.integration.test.tsx` (the REAL login, sign-up, account, change-email, two-factor and forgot-password pages with the REAL sign-in provider against the REAL server; the first test reproduces the original two-step bug through the real login page). The authenticator codes are made by `lib/testTotp.ts` (checked against the RFC 6238 test vectors). Nothing has been run in a real browser.

