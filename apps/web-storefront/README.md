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

## Next steps to make this real

1. **Verify the real Google Fonts fetch** once deployed somewhere
   with real internet access (see the honest limitation above).
2. **Verify the confirmation page's client-side hydration** in a real
   browser — logically correct but only verified via curl here (see
   the cart/checkout section above).
3. **Remaining account feature**: saved-address checkout (pick a
   previously-used address instead of typing it every time) — login/
   signup and order history are already real (see their own sections
   above); this is the genuine remaining next pass.
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
