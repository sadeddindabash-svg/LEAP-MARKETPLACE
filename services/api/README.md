# Leap Core API

Backend services shared by the buyer app, admin dashboard, and supplier
portal. See `/docs/SRS.docx` Section 6 (Architecture) and Section 7 (Data
Requirements).

## Status

This is a **starter backend**, now with real PostgreSQL persistence for its
core modules — it has been run and tested end-to-end against a real
database (see below), but it is **not** production-ready:

- **Real PostgreSQL persistence** — catalog, fitment, cart, order, and user
  modules are now backed by a real database (see `db/README.md` for setup).
  Verified: an order placed through the API survives a full server restart.
- **Real authentication** — signup/login with bcrypt password hashing and
  JWT sessions (see "Authentication" below). `GET /order` and `GET /user/:id`
  are now access-controlled — previously `GET /order` returned every buyer's
  orders to anyone who called it, unauthenticated; this is fixed.
- Payment gateways (Stripe, APS, PayPal) are integrated but not live-tested
  — see the "Payment gateways" section below.
- No automated tests yet (there's an npm test script, but no test files).

## Verified working

Every endpoint below was actually run and exercised against a real
PostgreSQL database (not mocks) during development:

```
GET  /health
GET  /catalog/products                          — reads from Postgres
GET  /catalog/products?category=brake&vehicleId=v1
GET  /fitment/vehicles                           — reads from Postgres
GET  /fitment/makes
POST /cart/:cartId/items                         — writes to Postgres
GET  /cart/:cartId                               — includes supplierName for
                                                    supplier-grouped cart display
PATCH /cart/:cartId/items/:productId             — sets an exact quantity
                                                    (unlike POST, which adds)
POST /order              — real DB transaction: guest checkout, correct
                            price/supplier lookup from the catalog (not
                            trusting client-supplied amounts), correct
                            splitting into per-supplier sub-orders, and
                            proper rollback on an invalid product ID
GET  /order/:id
POST /user/guest-claim   — creates a real user row
GET  /user/:id
POST /payment/methods
POST /payment/intent
POST /notification/send

Database-specific: placed a real order, killed the server process, started
a fresh process, and confirmed the order + cart data was still there — see
db/README.md for the full verification notes.
```

## Payment gateways

- **Stripe**: real integration (`stripe.paymentIntents.create`). Handles
  Stripe's documented zero-decimal currencies correctly (Chile/CLP,
  Paraguay/PYG). Not yet live-tested — see `src/modules/payment/routes.js`
  header comment.
- **Google Pay**: NOT a separate gateway — routes through Stripe's
  PaymentIntent API (same as the 'stripe' provider), since Google Pay is a
  client-side wallet, not an independent backend. See the routing comment
  in `routes.js` if this seems surprising.
- **Amazon Payment Services (APS)**: real request-signing integration
  (the business's existing gateway). See
  `src/modules/payment/providers/amazonPaymentServices.js` for the full
  "verify before production" checklist.
- **PayPal**: real integration via the official `@paypal/paypal-server-sdk`
  (Orders v2 API), written against the SDK's actual installed type
  definitions. Uses a 2-step create-order → capture-order flow (see
  `POST /payment/intent` with `provider: "paypal"`, then
  `POST /payment/paypal/capture/:orderId` after the buyer approves).
  Amount format is a decimal string (`"34.90"`), NOT integer cents like
  Stripe — don't reuse `currency.js`'s Stripe logic for PayPal amounts.
  Hungary (HUF, one of our 40 launch markets) is flagged as a possible
  no-decimal currency per PayPal's docs, unverified against a live account.
  See `src/modules/payment/providers/paypal.js` for full details.

None of the three real integrations (Stripe, APS, PayPal) have been
live-tested — this environment has no network access to any of their APIs.
Each provider file documents exactly what was and wasn't verified locally.

Example — placing a guest order with items from two different suppliers
correctly splits into two supplier sub-orders while returning one order ID:

```bash
curl -X POST http://localhost:4000/order \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":2},{"productId":"p4","quantity":1}],"guestEmail":"buyer@example.com"}'
```

## Authentication

Real signup/login — bcrypt password hashing (via `bcryptjs`, a pure-JS
implementation chosen deliberately so contributors don't need a C++ build
toolchain just to `npm install`) and JWT session tokens (7-day expiry).

```
POST /auth/signup  { email, password, name? }  -> { token, user }
POST /auth/login   { email, password }          -> { token, user }
GET  /auth/me      (Authorization: Bearer <token>) -> current user
POST /auth/forgot-password  { email }           -> generic success message
POST /auth/reset-password   { token, newPassword } -> confirmation
```

Protected routes: send `Authorization: Bearer <token>`. Currently gated:
- `GET /user/:id` — a user can only view their own profile (or an admin, any)
- `GET /order` — a buyer sees only their own orders; an admin sees all

**Guest checkout is unaffected** — `POST /order` with `guestEmail` still
works with no token, per the product decision in the Charter.

**Verified** (against the real database, not mocked): signup validation
(duplicate email, short password, invalid email format all rejected
correctly), login with wrong password vs. a nonexistent email both return
the identical error message (so the API doesn't leak which emails are
registered), token round-trips correctly through `/auth/me`, and — the
important one — two different signed-up users only ever see their own
orders in `GET /order`, never each other's.

**Gap closed (was open for a while, flagged the whole time)**:
`GET /order/:id` used to be fully unauthenticated — order IDs are
sequential (`LP-200900`, `LP-200901`...) and therefore guessable, so
anyone who guessed or obtained an ID could view a stranger's order. Fixed
without breaking the original requirement (a guest-checkout buyer must
still be able to view their own confirmation without an account): access
is now granted to (1) an admin, (2) the order's own logged-in buyer, or
(3) a guest who supplies the exact `guestEmail` the order was placed with
as a query param — a second factor beyond just knowing the ID. Anyone
else gets 404, not 403 (same "don't confirm existence" pattern used
elsewhere). See `src/orderSecurity.integration.test.js` in the admin
dashboard's test suite for the full verification, including the specific
check that this didn't break the real admin dashboard's existing calls
to this same endpoint.

**Password reset (migration 009)**: applies equally to buyer, admin, and
supplier logins, since they're all rows in the same `users` table. The
token generation (32 random bytes via Node's `crypto` module), 60-minute
expiry, and one-time-use enforcement are all fully real — verified by
`src/passwordReset.integration.test.js` in the admin dashboard's test
suite, including that a token can't be reused after it's been consumed,
an expired token is rejected, and — the one that matters most — a
completed reset genuinely changes the password (old password stops
working, new one works).
**Honest limitation, shown in the mobile app's own UI, not hidden**: no
email provider is connected in this codebase yet, so
`POST /auth/forgot-password` logs the reset link to the *server's own
console* rather than actually emailing it anywhere — see that route's
header comment. `forgot-password` also deliberately returns the exact
same response whether or not the email is registered, same
email-enumeration protection as the login endpoint's error message.

## Structured supplier product submission (migration 010)

A real SRS requirement, built from scratch: suppliers submitting a
product must go through Brand -> Model -> Generation -> Year -> Engine
-> Transmission -> Category -> Part -> Position -> OEM Number, upload at
least 3 high-resolution photos, and — because submissions can be in
Chinese — get a real Leap-team-reviewed English translation before the
listing goes live to buyers.

**The fitment cascade** (`GET /fitment/brands`, `/fitment/brands/:id/models`,
`/fitment/models/:id/generations`, `/fitment/generations/:id/engines`,
`/fitment/generations/:id/transmissions`) is a genuinely separate,
deeper reference hierarchy from the existing `vehicles` table — see
`db/migrations/010_supplier_product_submission.sql`'s header comment for
why the two intentionally coexist rather than one replacing the other.
Seeded with real, meaningful depth (3 brands, 4 models, 4 generations, 9
engines, 7 transmissions — not one entry per level) so the cascading
picker in the supplier portal has something real to cascade through.

**Product submission** (`POST /supplier/me/products`) validates every
step of the cascade against real reference data — an unknown generation
ID 404s, a year outside that generation's actual production range 400s,
and an engine/transmission that belongs to a *different* generation than
the one selected is rejected, not silently accepted. Category and
Position are fixed, real lists (not free text) matching what the mobile
app and admin dashboard already use.

**Mandatory photos**: enforced as "at least 3" at the application layer
(a DB CHECK constraint can't cheaply express "at least N rows exist in a
different table"). "High-quality" is a real, checked rule — minimum 800px
on the shortest side, verified via `image-size` reading the actual
decoded pixel dimensions (not just trusting the file), not just accepted
on faith. See `POST /uploads/product-image` and its module's header
comment for the honest note about local-disk storage vs. real object
storage.

**Translation approval**: a submission's Chinese original (`nameZh`,
`descriptionZh`) is stored and shown to admin reviewers in the
moderation queue alongside the real photos. `PATCH
/catalog/products/:id/moderate` now REQUIRES `nameEn` to approve — there
is no way to make a listing live without a Leap-team-reviewed English
name, matching the actual business requirement rather than just flipping
a status flag. Rejecting doesn't need a translation, since the listing
never goes live either way.

**Verified end-to-end**, not just piece by piece: created a real product
with 3 real uploaded photos and real fitment data, confirmed it appears
correctly in the admin's moderation queue with the Chinese original and
photos intact, confirmed approving WITHOUT a translation is rejected,
approved WITH one, and confirmed buyers then see the real English name —
see `apps/supplier-portal/src/productSubmission.integration.test.js`.

### Managing the cascade itself (admin-only, new)

The cascade above is only useful if someone can actually add to it —
without this, it would forever be stuck with whatever was hardcoded into
`db/seed.js` (3 brands, 4 models...). Admin-only CRUD now exists for
every level:
```
POST   /fitment/brands                                  { name }
DELETE /fitment/brands/:id
POST   /fitment/brands/:brandId/models                  { name }
DELETE /fitment/models/:id
POST   /fitment/models/:modelId/generations              { name, yearStart, yearEnd? }
DELETE /fitment/generations/:id
POST   /fitment/generations/:generationId/engines        { name }
DELETE /fitment/engines/:id
POST   /fitment/generations/:generationId/transmissions   { name }
DELETE /fitment/transmissions/:id
```
- A duplicate brand name returns a clear 409, not a raw Postgres unique-
  constraint error.
- **Deletion is deliberately NOT one-size-fits-all**: deleting a brand or
  model cascades to ITS OWN children (its models, their generations,
  etc. — just organizational nesting), but `product_fitment_entries` has
  no `ON DELETE CASCADE` from `vehicle_generations` on purpose — so
  trying to delete a generation, engine, or transmission that a REAL
  product actually references fails with a real foreign-key error, which
  these routes turn into a clear 409 ("remove those products first")
  rather than either a raw DB error or silently orphaning real product
  data. Verified with a fully self-contained test: creates its own real
  brand/model/generation, attaches a genuine product to it via the real
  supplier submission endpoint, then confirms deletion is refused — not
  by depending on another test file's leftover state.
- Wired into the admin dashboard's new "Vehicle Data" page — see that
  app's README.

## Inspection hubs (migration 011) — the biggest structural change to fulfillment so far

**Confirmed business rule, not assumed**: every order now has TWO real
shipping legs, always — Supplier → Hub, then Hub → Buyer. A supplier
never ships directly to a buyer. This is a genuinely new party in the
marketplace (`hub_staff` role, same pattern as `supplier`/`supplier_id`),
with its own dedicated portal — see `apps/hub-portal/README.md` for why
that's a separate app rather than a page bolted onto the admin
dashboard.

**Schema**: `hubs` (regional facilities), `hub_id` added to `users`
(with a DB-level constraint that a `hub_staff` user must have one) and
to `supplier_sub_orders` (which hub a sub-order is routed to — an admin
assigns this). `hub_shipments` is the hub's own leg, with a real status
machine (`awaiting_receipt → received → opened → inspected → packed →
shipped_to_buyer`, plus a `flagged` branch for quality issues found at
any point) — created automatically the moment a supplier actually marks
their leg 'shipped', not at hub-assignment time, so "awaiting receipt"
genuinely means "on its way," not just "a hub was picked in advance."
`hub_shipment_events` is the real audit trail (one row per step
actually performed, by whom, with notes); `hub_shipment_photos` is
mandatory evidence per step, same "at least 1, enforced in application
code" pattern as product photos (migration 010).

**A real coupling, not just a UI nicety**: `PATCH /supplier/me/orders/:id`
now REJECTS marking a sub-order 'shipped' if no hub is assigned yet —
there is no such thing as "shipped" with nowhere real to ship to. An
admin assigns a hub via `PATCH /hub/assign/:subOrderId` first.

**Step enforcement is real, not just documented**: `POST
/hub/me/shipments/:id/events` rejects an out-of-order step (e.g.
'inspected' before 'received'), rejects zero photos, and requires a
tracking number specifically for the final `shipped_to_buyer` step.
Cross-hub isolation is enforced server-side — a hub can only ever see
and act on its own shipments, verified directly (a shipment routed to a
different hub is genuinely invisible, not just hidden by the UI).

**Full visibility, not siloed data**: `GET /order/:id` (used by both the
admin dashboard and eventually buyer-facing tracking) includes the
complete hub-leg journey — status, every event, every photo, who
performed it — joined in from `hub_shipments`/`hub_shipment_events`/
`hub_shipment_photos`. An admin doesn't need to ask hub staff what
happened; it's already there.

**Also used for evidence uploads**: `POST /uploads/product-image` (see
migration 010's upload module) now accepts `hub_staff` as well as
`supplier` — the actual work (validate real dimensions/type, save,
return a URL) is identical regardless of which real-world thing the
photo is evidence of.

**Seeded with 3 real regional hubs** (Guangzhou, Dubai, Miami) and a dev
hub-staff login (`hub@leap.dev` / `hub_dev_password_123`, scoped to
Guangzhou) — see `db/seed.js`.

**Tested end-to-end**, not just piece by piece — see
`apps/admin-dashboard/src/hub.integration.test.js` (10 tests): a
supplier genuinely cannot ship before a hub is assigned, the real
`hub_shipment` auto-creates and is visible only to the correct hub,
step order and photo requirements are enforced, the full real
`received → ... → shipped_to_buyer` sequence works with a real tracking
number and a complete audit trail visible from both the hub's own view
and the admin's order detail, the `flagged` branch works and can't be
triggered twice, cross-hub isolation holds, and hub-location
creation/deletion (with real referential protection — you cannot delete
a hub that real staff or shipments still reference) all work correctly.

**`GET /hub/flagged` (admin-only, added later)** — the real answer to
"where do I find a flagged shipment." Before this endpoint existed, a
flagged shipment was only visible by already knowing which order to
open (the evidence trail on that order's detail page) — no queue, no
notification, nothing surfacing it. Returns every flagged shipment
across ALL hubs (not scoped to one hub, unlike the hub-staff-facing
endpoints), with the real flag note and photos already resolved (the
flag is always the last real event on a flagged shipment) so an admin
doesn't have to open a second request per row just to see what's wrong.
See `apps/admin-dashboard/README.md`'s "Flagged Shipments page" section
for the admin UI, including the real sidebar badge count.

## Arabic translation (migration 012)

**Confirmed business decision, explicitly asked and answered, not
assumed**: Arabic translation is now REQUIRED to approve a listing —
the exact same rule as English, not a lesser or optional one. This
matters concretely: the confirmed 40-country Phase 1 launch list
includes the entire GCC plus Jordan (Saudi Arabia, UAE, Oman, Kuwait,
Bahrain, Qatar, Jordan) — seven real markets where Arabic isn't a
nice-to-have.

`PATCH /catalog/products/:id/moderate` now checks for BOTH `nameEn` and
`nameAr` when approving, and reports whichever one(s) are missing
together in a single error (`"nameEn and nameAr required..."` or just
whichever one is actually missing) — an admin doesn't have to submit
twice to discover the second thing they forgot.

**A deliberate schema decision, not an oversight**: `products.name` and
`description` were NOT renamed to `name_en`/`description_en` for
symmetry with the new `name_ar`/`description_ar` columns. That would
touch every existing consumer of `products.name` across the catalog,
cart, order, supplier, and hub modules — a large blast radius for a
purely cosmetic rename. Instead, `name`/`description` continue to mean
exactly what they already meant (the default/English-facing display
value), and `name_ar`/`description_ar` are purely additive. See
migration 012's header comment for the full reasoning.

**Scope of this pass, deliberately bounded**: this covers the ADMIN
side only — capturing and requiring both real translations before a
listing goes live. The CUSTOMER-facing side (an actual language
switcher in the mobile app, and the catalog API accepting a `?lang=ar`
parameter to serve the Arabic fields instead of the default ones) is
intentionally a separate, later phase — a genuinely different piece of
work (mobile UI, not admin dashboard), sequenced this way on purpose
rather than built partially here.

**Tested end-to-end**: approving with neither translation, only
English, or only Arabic are all correctly rejected with a specific
error naming what's missing; approving with both stores real Arabic
text correctly (verified directly in the database, not just trusting
the API's own response) — see `apps/admin-dashboard/src/moderation.integration.test.js`
and `ModerationFlow.test.jsx`.

## Buyer-facing catalog redesign (migration 013) — no supplier identity, real language resolution, real photos

**Confirmed requirements, not assumed**: buyers should never see who the
supplier is, should never see the untranslated Chinese original, should
see the real uploaded photos, and should see a specific set of
structured fields (Part Name, Brand, Model, Year, Part No., Description,
Dimensions, Weight).

**`GET /catalog/products` and `GET /catalog/products/:id` were rebuilt
around a new `toBuyerProductDto`**, separate from the supplier/admin-
facing DTOs elsewhere in this codebase:
- **No supplier identity, at all, in any form** — not hidden in the
  frontend, genuinely never included in the response. Verified by a
  test that checks the raw JSON text doesn't contain the word "supplier"
  anywhere, not just that one specific key is absent (catches an
  accidental leak under a different key name).
- **Real language resolution via `?lang=en|ar`** (default `en`):
  `resolveLanguage()` maps the request to either the English or Arabic
  name/description, always returning them under the SAME `name`/
  `description` keys regardless of which language was actually used —
  the caller doesn't need to know which underlying column was read, just
  "give me the product in the language I asked for." Falls back to
  English if Arabic is requested but genuinely missing (a legacy product
  approved before migration 012 existed) rather than returning null.
  **Never includes `name_zh`/`description_zh`** in a buyer-facing
  response under any circumstance.
- **Real uploaded photos** (`images`), the real structured fitment
  (`brand`/`model`/`year`, resolved from the first `product_fitment_entries`
  row — see that function's comment for why "first" rather than a full
  list, and what to reconsider if multi-fitment products become common),
  and the real shipping fields below.

**New mandatory shipping fields (migration 013)**: `weightKg`,
`lengthCm`, `widthCm`, `heightCm` — confirmed mandatory for new supplier
submissions, going forward, because they will feed a REAL shipping-fee
calculation in the admin dashboard later. This is exactly why they're
stored as real structured numbers (kilograms, centimeters) rather than
free text like "about 2kg, 30x20x10cm" — a shipping formula needs actual
operable numbers, not a string a human has to parse. Enforced in
application code (`POST /supplier/me/products`), not a DB constraint —
same pattern as "at least 3 photos" — so existing already-live products
aren't retroactively broken by a NOT NULL constraint they were never
asked to satisfy.

**Tested end-to-end** — see `apps/admin-dashboard/src/buyerCatalog.integration.test.js`:
supplier name is absent from both the list and detail endpoints (checked
two ways, as above), the Chinese original never appears in a buyer
response, English and Arabic requests both return the correct real
translation, a legacy product without Arabic falls back to English
correctly, real photos and real structured fields (part, OEM number,
brand, model, year, weight, dimensions) all come through correctly, and
a supplier genuinely cannot create a product without shipping
dimensions/weight, or with a non-positive value for any of them.

## Real pricing engine (migration 014) — supplier RMB cost -> buyer USD price

**Confirmed business decisions, explicitly asked and answered rather
than assumed**: suppliers price in RMB. Admin configures a real set of
fee variables. The buyer-facing USD price is DERIVED and recalculated
LIVE on every browse/view — a fee or FX-rate change is reflected
immediately, everywhere — but a PLACED order locks in whatever price was
computed at that exact moment and never changes afterward, the same way
any real checkout works (a price that could still move between "buyer
sees $50" and "buyer's card gets charged" would be a billing-integrity
bug, not a feature).

**The real fee components** (`pricing_fee_components`, admin-managed via
`/pricing/fee-components`), seeded with 10 sensible defaults spanning
platform economics (Leap Platform Fee, Overhead), cross-border cost
(Bank/Remittance Fee, Customs Duty, VAT), logistics (Local Transport
Fee, Shipping Fee), and transaction risk (Payment Gateway Fee, FX
Margin, Insurance) — an admin can add, remove, disable, or adjust every
one of these. Each is one of three real types:
- **`percentage`** — applied against the running total at that point in
  the sequence (a real "landed cost" buildup, not independent
  percentages of the original cost stacked separately — standard
  international-trade practice).
- **`flat`** — a fixed RMB amount added regardless of sequence.
- **`shipping_volumetric`** — a real, industry-standard volumetric-weight
  calculation: chargeable weight is the GREATER of actual weight and
  `(length × width × height) / 5000`, since a large-but-light box still
  takes up real cargo space. Deliberately simple — an admin-set flat
  rate per chargeable kilogram — explicitly a placeholder for a more
  sophisticated shipping equation to be designed later, not pretending
  to be the final answer.

Every fee is RMB-denominated; a single RMB→USD conversion happens once,
at the very end, to avoid intermediate currency-mixing bugs. See
`services/api/src/modules/pricing/engine.js` for the full calculation
and its extensive header comments.

**The exchange rate**: confirmed to come from a real live-rate API — not
configured in this environment (same category of external dependency as
the payment gateways: no real API key available here).
`fetchLiveRate()` is a clearly-marked stub for exactly where a real
provider (e.g. exchangerate-api.com, Open Exchange Rates) would be wired
in. What actually powers the calculation TODAY, fully real and
functional: a manually-set admin rate (`fx_rates`, managed via
`GET`/`PATCH /pricing/fx-rate`) — not a placeholder that does nothing,
a real rate the system genuinely uses, just not sourced from a live API
yet.

**Suppliers are locked to RMB going forward**: `POST /supplier/me/products`
now rejects any `currencyCode` other than `'CNY'` — a stray non-RMB
submission would silently corrupt the pricing equation (treating, say,
a USD amount as if it were RMB).

**Legacy products pass through unaffected**: any product submitted
before this feature existed (this project's own seed data, priced
directly in USD) is NOT run through the RMB pricing equation — that
would silently produce nonsense (treating $34.90 as if it were ¥34.90).
The catalog, cart, and order modules all check `currency_code` and only
apply the real equation to genuinely RMB-priced products.

**`POST /pricing/preview`** lets an admin test the equation against a
hypothetical cost/weight/dimensions without needing a real product —
returns the full step-by-step breakdown, not just a final number; a
money calculation should be auditable, not a black box.

**Tested end-to-end** — see `apps/admin-dashboard/src/pricing.integration.test.js`
(9 tests): a non-RMB submission is rejected, unauthenticated/non-admin
access to fee/rate management is rejected, the preview endpoint's result
is independently re-derived from the real fee components and confirmed
to match exactly (not just "returns some number"), a negative cost and
a shipping fee applied without real dimensions are both rejected, a fee
component can be created/updated/deleted and an invalid type rejected,
a real RMB-priced product's buyer-facing price changes live the instant
a fee changes, a PLACED order's price is confirmed unaffected by a
fee change made afterward (even a deliberately drastic one) while the
SAME product's live browsing price is confirmed to have changed, a
legacy non-CNY product passes through unaffected, and the FX rate can be
viewed and updated.

## Real password reset email delivery — generic via SMTP (new)

**Confirmed choice, same reasoning as the S3-compatible cloud storage
client**: build this generically rather than commit to one provider
yet. SMTP is a real, universal protocol that virtually every
transactional email provider supports ALONGSIDE their own proprietary
REST API — Resend, SendGrid, Mailgun, and AWS SES all issue real SMTP
credentials. `services/api/src/modules/email/client.js` is ONE real
implementation (using the well-established `nodemailer` package) that
works with whichever gets chosen later, purely by setting different
environment variables. No code change needed when that decision is
made.

**Confirmed design**: a real, styled HTML email (plus a real plain-text
fallback), matching the app's actual real brand palette
(`apps/mobile/lib/core/theme.dart`'s `LeapColors` — kept visually
consistent with the real app rather than inventing a separate email
look). See `services/api/src/modules/email/templates.js`.

**HONEST FALLBACK, same category as the payment gateways, translation,
and cloud storage**: no real SMTP credentials are configured in this
environment. Rather than fake success without actually being able to
deliver an email, `POST /auth/forgot-password` honestly falls back to
the ORIGINAL console-logging behavior — a real, working way to test the
token-based reset flow, just not real delivery yet. The real token
generation, expiry, one-time-use enforcement, and password update are
all fully real regardless of which delivery path actually runs, and
were already real before this pass.

**Real environment variables** (all required together to activate real
delivery):
```
SMTP_HOST=...        # e.g. smtp.resend.com, smtp.sendgrid.net, smtp.mailgun.org
SMTP_PORT=587         # 587 (STARTTLS) or 465 (implicit TLS) -- both handled correctly
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=...   # must be a real verified sender/domain with most providers
SMTP_FROM_NAME=Leap Auto Parts
```

**Tested end-to-end** — see `apps/admin-dashboard/src/email.test.js`
(6 tests): `isEmailConfigured()` correctly reports false with no real
env vars, false with only a genuinely partial real configuration, and
true once all 5 real required vars are set; the real branded template
includes the real reset URL in both the HTML and plain-text versions;
personalizes the greeting with a real recipient name when provided and
falls back gracefully without one; and shows the real configured expiry
time rather than a hardcoded number. **A real, honest testing
limitation**: `sendEmail()`'s actual transport-building and real SMTP
send/failure behavior are NOT covered by this automated suite — this
test file lives in a genuinely separate npm package (admin-dashboard)
from services/api, each with its own separate `node_modules/nodemailer`,
so mutating a mocked `nodemailer` instance in one package's test file
does not affect the different instance `client.js` actually resolves
internally (the same real cross-package boundary already true of the
storage and translation modules' automated tests). That logic — the
real transport config per port (587 vs 465's `secure` flag), the real
message fields passed to `sendMail`, and real success/failure handling
— was instead verified directly via a standalone script run directly
against the real `client.js`, monkey-patching `nodemailer.createTransport`
in the same process (the same approach that works correctly for the
storage module's equivalent verification).

## Real admin team permissions — one owner, per-page access control (new)

**Confirmed scope, 2 real scenarios validated before building anything**:
one real "owner" admin manages permissions for every other real admin
account; page-level access control (can a given admin see a given
admin dashboard page, yes/no) — finer view-vs-edit control within a
page is a real, deliberate future step, not built here.

**What was actually there before this**: `users.role`'s CHECK
constraint had `'support'` and `'finance'` sitting in it since the very
first migration — genuinely dead, never once referenced by
`requireRole('support')` or `requireRole('finance')` anywhere in the
real codebase. Every one of the 47 real admin-only endpoints across 11
route files just checked "is this person AN admin," full stop — no real
distinction between different kinds of admin staff. This migration
builds the real thing instead of reviving those 2 dead, rigid labels.

**Migration 022**: a real `users.is_owner` boolean (the real seeded dev
admin becomes the real owner); a real `admin_page_permissions` table
(`user_id`, `page_id`) for every non-owner admin's real per-page access.

**Deliberately a real, LIVE database check every request, not a JWT
claim** (`auth/middleware.js`'s `requirePageAccess()` / `requireOwner()`)
— an owner revoking a permission should take effect immediately, not
whenever that admin's existing 7-day session happens to expire. Verified
directly: an owner updates a scoped admin's permissions, and the SAME
existing token (no new login) immediately reflects the change on its
very next request.

**A real owner bypasses the permissions table entirely** and always has
full real access to every page — confirmed across all 7 real admin-only
route groups in one test.

**Real, honest handling of the one endpoint genuinely SHARED between
buyers and admins** — `GET /order` (a buyer sees their own orders; an
admin sees every real order) needed a different real middleware,
`requirePageAccessIfAdmin(pageId)`, that only checks page access when
the caller is genuinely an admin — a real buyer or guest passes
straight through, completely unaffected. Verified directly: a real
buyer's own `GET /order` call is unaffected either way.

**Real, owner-only admin account management** (`admin-users` module):
create a new admin with a real set of allowed pages; a real, full
replace of an admin's permissions (simpler and less error-prone than
incremental add/remove calls that could drift from the real intended
state if one of several calls failed partway through); delete an admin.
Real safeguards: the owner account can never be deleted or have its
permissions edited; an admin can never delete their own account; an
unknown page id is rejected on both create and update.

**Tested end-to-end** — see `apps/admin-dashboard/src/adminPermissions.integration.test.js`
(12 tests, REAL backend): the real seeded admin is confirmed a real
owner with full access; **Scenario 1** — a real support-only admin can
access Tickets and Returns but is rejected from Pricing, Promo Codes,
and Moderation; **Scenario 2** — a real finance-only admin can access
Pricing but is rejected from Moderation and Supplier Messages; a real
owner has full access across every real page group in one pass; a real
buyer is completely unaffected by page-access logic on the real shared
endpoint; a permission change takes effect on the SAME token's very
next request, not after a new login; an unknown page id is rejected; a
non-owner admin cannot manage any other admin's account; the real
owner account cannot be deleted or edited; a real scoped admin can be
deleted and genuinely stops being able to log in afterward; duplicate
email is rejected; and the real admin list shows accurate real
permissions for every account.

**A real regression was found and fixed while building this**: filtering
the dashboard's own nav by the current admin's real permissions broke
13 existing mocked component tests, since their mocked login responses
predated `isOwner`/`allowedPages` and defaulted to "no explicit
permission, don't show anything" — correct, secure behavior for a real
unrecognized/incomplete permission response, but it meant those older
test mocks needed updating to match the real, current response shape
rather than the frontend's real security logic being loosened to
accommodate stale mocks.

**A real bug was also found and fixed during clean-merge verification
against a genuinely FRESH database** (not the sandbox's long-lived dev
database, where `admin@leap.dev` already existed from earlier
sessions): migration 022's `UPDATE users SET is_owner = true WHERE
email = 'admin@leap.dev'` runs during the migration phase, but
`db/seed.js` creates that user during the separate, LATER seed phase —
on a fresh database the UPDATE matches zero real rows since the user
doesn't exist yet, silently leaving the seeded admin as a non-owner.
Fixed by having `db/seed.js` set `is_owner = true` directly in the real
INSERT that creates the admin user, correct regardless of run order;
the migration's UPDATE is left in place since it's still correct for an
EXISTING database upgrading through this migration, where the admin
user already exists at migration time. Re-verified with a fully fresh
drop/recreate/migrate/seed database.

## Real, atomic fee component reordering (new)

**A real, direct question this answers**: fee components apply "in
order, top to bottom" against a running total — the schema already had
a real `sort_order` column and the engine already applied fees in that
sequence, but there was no real way to actually CHANGE that order once
components existed, short of manually editing every affected
`sort_order` value one at a time.

**`POST /pricing/fee-components/:id/move`** (`{ direction: 'up' | 'down' }`)
— a real, atomic swap of two real `sort_order` values in a single
transaction, not two separate client-side updates that could leave
things inconsistent if one succeeded and the other failed. Finds the
real adjacent component in the requested direction (by real
`sort_order`, not array position) and swaps the two values together.
Real, honest rejections: moving the real first component up, or the
real last component down, is a 400 with a clear message, not a silent
no-op or an out-of-bounds error.

**This is not cosmetic** — because fee components apply sequentially
against a running total, swapping a percentage fee's position relative
to a flat or shipping fee genuinely changes the final calculated price
(percentage-on-percentage swaps are mathematically commutative and
produce the same result either order, since multiplication commutes;
percentage-vs-flat swaps are NOT, since a flat addition changes the
base a later percentage is computed against) — confirmed directly by
computing a real preview before and after a real swap and observing the
real price actually change.

**Tested end-to-end** — see the same `pricing.integration.test.js` (5
new tests, 14 total now): moving a fee component up swaps its real
`sort_order` with the real previous component, and moving back down
restores it exactly; reordering a real percentage fee relative to a
real flat fee genuinely changes the real calculated price, verified by
computing a real preview before and after rather than assuming the
math; the real first component cannot be moved up and the real last
cannot be moved down; an invalid direction and a nonexistent component
are both rejected; and non-admins cannot reorder fee components.

## Real bulk moderation — approve/reject many listings at once (new)

**A real design nuance surfaced and confirmed before building**: a true
"select many, click approve, done" bulk action would have to skip the
real translation-review gate that already exists on the single-item
moderate endpoint (approving requires a real reviewed English AND
Arabic name — a deliberate quality gate for the confirmed 40-country
launch list, not an oversight). Bulk approve deliberately does NOT
bypass that gate — see the admin dashboard's real batch-review-table
design for how it stays genuinely fast without skipping real review.

**`POST /catalog/products/bulk-moderate`** (`{ items: [{ productId,
action, nameEn?, ... }] }`) — real, best-effort processing, not
all-or-nothing: one bad item in a batch of 20 shouldn't cost the other
19 their real approvals. Each item is validated and processed
independently using the exact same real rules as the single-item
endpoint, and the real per-item result (`{ productId, success,
error? }`) is reported back so the caller knows exactly which ones
went through. A real cap of 100 items per request.

**Tested end-to-end** — see `apps/admin-dashboard/src/bulkModeration.integration.test.js`
(7 tests, REAL backend): a real batch of valid approvals and rejections
all succeed together; best-effort processing confirmed both in the
response AND independently re-verified at the real data level (the
valid item is genuinely approved and out of the queue, the invalid one
is genuinely untouched and still pending); a nonexistent product within
a batch is a real per-item failure without affecting the others; an
empty items array and a batch over the real 100-item cap are both
rejected; an invalid action or missing productId is a real per-item
failure, not a request-level error; and non-admins are rejected.

## Real supplier bulk product import (migration 023) — one vehicle, many products, per-item real completion

**Confirmed scope, refined over several real rounds before building**:
most suppliers keep a real spreadsheet for ONE specific vehicle
(brand/model/generation/year) with simple columns — OE Number, Item
Name, Price — not the full structured single-item submission the
existing `POST /me/products` requires. Confirmed design: the vehicle is
picked ONCE for the whole batch; Category/Part/Position/dimensions are
OPTIONAL, used directly when they validate against real reference data
and simply left for later otherwise; photos are NEVER in the sheet
(explicitly ruled out — a cell can't reliably hold an extractable
image) — every imported item still needs its real 3 required photos
added afterward before it can be submitted for the exact same real
moderation review every product already goes through.

**A genuinely new product status, `draft`**, distinct from
`active`/`translating`/`inactive` — a bulk-imported item is not yet
ready for real moderation. `products.category`'s real `NOT NULL`
constraint (true for every product before this feature, since one was
always required upfront) had to be dropped to allow a real draft with
an unmatched/not-yet-provided category.

**`services/api/src/modules/supplier/productValidation.js`** —
deliberately a SEPARATE module from the existing single-item
endpoint's own inline validation, even though the real checks are
equivalent. The existing endpoint has extensive real test coverage
already; duplicating this logic avoids any regression risk on that
well-tested code, at the honest cost of some real duplication.

**`POST /me/products/bulk-import`** — the real vehicle fitment is
validated ONCE for the whole batch (not per item); each item is then
processed independently, best-effort (same pattern as the admin
dashboard's bulk moderation) — a row missing its real required OE
Number/Item Name/Price fails just that row; an unmatched/invalid
optional Category/Part/Position/dimension is silently treated as "not
provided," not a rejection. A real cap of 1000 items per batch (raised
from an initial 200 after a real supplier's real single-vehicle catalog
turned out to genuinely exceed that).

**`GET /me/products/drafts`** — a supplier's own real drafts, each
reporting exactly which real fields are still missing (`category`,
`part`, `position`, `dimensions`, `photos`) so the portal can show a
real, specific state per item rather than a generic "incomplete."

**`PATCH /me/products/:id/complete`** — the real finishing step. Fills
in whichever of category/part/position/dimensions weren't already set
(or overrides them, re-validated against real reference data — an
unknown category, or a real part that doesn't belong to the given
category, is rejected here same as the single-item endpoint), requires
the real 3 photos, and — only once every real requirement is met —
moves the draft into `translating`, entering the exact same real
moderation queue every product goes through. Real ownership enforced
via the `WHERE` clause; only a genuine `draft` can be completed (an
already-submitted product can't be re-completed through this endpoint).

**Tested end-to-end** — see `apps/supplier-portal/src/bulkImport.integration.test.js`
(10 tests): a real batch with valid items, one missing a required
field, and one with unmatched optional fields — confirmed best-effort,
not all-or-nothing, both in the response AND independently re-verified
at the real database level; the real vehicle fitment validated once,
not per item; the full real completion flow for both a fully-matched
draft (only needs photos) and a minimal one (needs everything); an
unknown category or mismatched part rejected at completion time; a
completed draft can't be re-completed; real batch-size and per-item
limits; an English-named item stores no Chinese original, unlike a
Chinese-named one; and non-suppliers rejected from all 3 real
endpoints.

**A real, documented security decision**: the browser-side spreadsheet
parsing (see the supplier portal's own README for the frontend half of
this feature) deliberately uses `exceljs` rather than the more common
`xlsx` (SheetJS) package, which has 2 real, unpatched high-severity
vulnerabilities in the exact file-parsing code path this feature needs
for untrusted, supplier-uploaded files.

## Real return window + real payouts (migration 024)

**Confirmed scope, discussed and refined over several real rounds
before building**: no automatic payout schedule — real payout timing
varies per supplier based on individual agreements, not one
platform-wide schedule. Instead, a real, admin-driven "record a payout"
action, built on a real, accurate "amount currently owed" calculation
per supplier. Commission varies by real category, matching what had
been a real, hardcoded, fake display-only placeholder in Settings —
now made genuinely real and admin-editable.

**A real return window, confirmed constrained to 3–7 admin-configurable
days**, closes a real, previously-unenforced gap (a buyer could
previously file a return with no deadline at all) and, at the same
time, determines when an order genuinely becomes eligible for payout:
only once delivered, the real window has passed, AND no return case
was ever filed for it. This was a deliberate alternative to a
clawback/repayment system for a return that happens after a supplier's
already been paid — money is simply never released before the real
return risk has passed, rather than needing to claw it back afterward.

**A real, generic `platform_settings` key-value table** (migration
024) — the return window is the first real use, but this is
deliberately reusable for future simple admin-configurable values
rather than a one-off dedicated column and migration each time.

**A real `delivered_at` timestamp** didn't exist on `supplier_sub_orders`
before this — needed to know how many real days have passed since
delivery for both the return-window deadline and payout eligibility.
Set once, in the one real place a sub-order transitions to
`'delivered'` (the supplier's own status-update endpoint).

**`GET /payouts/owed`** — real, per-supplier calculation of exactly how
much is currently owed, from real delivered sub-orders past the real
window with no return case, using each real line item's price and its
real category's commission rate. **`POST /payouts`** records a real
payout covering EVERY currently-eligible sub-order for that supplier at
this exact moment — the real, live amount, never a client-supplied
number for something involving real money — and permanently links each
covered sub-order via a real UNIQUE constraint, so the same sub-order
can never be double-counted into a second payout. **`GET /payouts`**
lists real payout history.

**`PATCH /catalog/categories/:id/commission`** makes the Settings
page's Commission rules card genuinely editable and genuinely used —
before this, those percentages were hardcoded, fake, and never actually
applied to anything.

**Tested end-to-end** — see `apps/admin-dashboard/src/payouts.integration.test.js`
(7 tests, REAL backend): the real return window is admin-configurable
within 3–7 days, rejecting anything outside that range; a real return
CAN be filed within the window and CANNOT be filed once it's passed; an
order only becomes payout-eligible once delivered, the window has
passed, AND no return was ever filed — verified with real, exact
commission math, not just an approximate check; recording a real payout
covers exactly the real eligible amount, clears it from what's owed,
and cannot be double-paid; non-admins are rejected from every real
endpoint; recording a payout for a supplier with nothing real owed is
rejected; and the real commission percent is admin-editable per
category within a real 0–100 range.

**A real bug was found and fixed while writing that test file**: the
return-case-filing check for one scenario initially backdated a
sub-order's delivery BEFORE filing its return — which meant the return
itself got rejected by the very window check being tested, silently
leaving that sub-order eligible for payout when it should have been
excluded, and inflating a later assertion's expected total. Fixed by
filing the real return first (genuinely within the window, so it
actually succeeds), then backdating delivery afterward to simulate
time having passed since.

**A real bug was also found and fixed during clean-merge verification
against a genuinely FRESH database** (not the sandbox's long-lived dev
database, where these category rows already existed from earlier
sessions): migration 024's `UPDATE product_categories SET
commission_percent = ...` statements run during the migration phase,
but `db/seed.js` creates these very category rows during the separate,
LATER seed phase — on a fresh database the UPDATE matches zero real
rows, silently leaving every category at the default commission
(11%) instead of its real intended value. The exact same class of bug
already found once before (the seeded admin's `is_owner` flag). Fixed
by having `db/seed.js` set the real `commission_percent` directly in
the INSERT that creates each category row, correct regardless of run
order; the migration's UPDATE statements are left in place since
they're still correct for an EXISTING database upgrading through this
migration, where these categories already exist at migration time.
Re-verified with a fully fresh drop/recreate/migrate/seed database.

## Real product reviews and ratings (migration 025)

**Confirmed scope, discussed before building**: whether a review
requires a real verified purchase is admin-decided — a real, toggleable
setting reusing migration 024's generic `platform_settings` table,
never hardcoded either way. Every real review requires real admin
moderation before it's visible or counts toward a product's average
rating — the same real quality gate every product listing already
goes through, not a lighter standard for reviews. One real review per
product per buyer, enforced by a real `UNIQUE (product_id, buyer_id)`
constraint — a second submission for the same product is a real edit
of the existing review (sent back to `'pending'` for re-review, since
the content genuinely changed), never a second row.

**`POST /reviews`** — real submit-or-edit via `ON CONFLICT ... DO
UPDATE`. When the verified-purchase setting is on, checks for a real
delivered sub-order containing that specific product for that specific
buyer before allowing the submission. **`GET
/catalog/products/:id/reviews`** (public) returns only real `'approved'`
reviews and a real average computed strictly from those — a pending or
rejected review never counts, even briefly. **`GET /reviews/pending`**
/ **`PATCH /reviews/:id/moderate`** (admin-only) are the real moderation
queue and action. **`GET/PATCH /platform-settings/require-verified-purchase-for-reviews`**
is the real admin toggle.

**Tested end-to-end** — see `apps/admin-dashboard/src/reviews.integration.test.js`
(6 tests, REAL backend): a submitted review is invisible publicly until
a real admin approves it; a second submission for the same product is
a real edit (same row, sent back to pending), never a new one; when
verified purchase is required, only a buyer who actually received the
product can review it; a buyer can delete only their own real review;
an invalid rating is rejected and non-admins are blocked from
moderation endpoints; and the average rating reflects only real
approved reviews.

**A real bug was found and fixed in this test file itself, without
needing a code change**: the average-rating test initially asserted an
exact review count, which broke the second time this test file ran in
the same session — product p9 genuinely accumulates real approved
reviews across repeated runs, since this test file (unlike
`payouts.integration.test.js`) has no direct DB connection to reset
that state between runs. Fixed by asserting the real DELTA (count
before vs. after this test's own two submissions) rather than an
absolute number, and confirmed by running the same test file three
times in a row without any cleanup in between.

## Real carrier tracking integration (migration 026) — 17TRACK webhook

**Confirmed scope, discussed and refined over several real rounds
before building**: a real, honest gap was found first — "delivered"
was entirely self-reported by the supplier, with no independent
confirmation at all, even though it gates real payout eligibility and
review verification. Real carrier tracking (via a 17TRACK webhook) is
now the preferred, trusted path — but the supplier's own manual
confirmation stays as a real, deliberate fallback, since cross-border
tracking data is often incomplete or delayed, and a carrier-only
requirement would leave a genuinely delivered order stuck with no way
to release payment. **Confirmed**: a manual override must be visibly
distinguishable from a real carrier-confirmed delivery, so a pattern of
one supplier relying on manual confirmation far more than others is
actually visible, not silently indistinguishable.

**`supplier_sub_orders` gains**: `carrier_code`, `delivery_confirmed_by`
(`'carrier'` or `'supplier_manual'`), and `delivery_note` (required
when confirming manually).

**`POST /webhooks/17track`** — a real, best-effort per-tracking-number
receiver (17TRACK can batch several updates in one real call). Real
HMAC-SHA256 signature verification against the real raw request body
(not a re-serialized JSON string, which is not guaranteed to
byte-for-byte match what the real sender originally signed — see the
real `req.rawBody` capture added to `index.js`'s global body parser).
Fails closed if the real shared secret (`TRACK17_WEBHOOK_SECRET`)
isn't configured. Only a real `'Delivered'` status actually updates
anything; any other real status is correctly skipped, not treated as
an error. Idempotent — re-firing for an already-delivered tracking
number is a real no-op, not a double-process.

**The supplier's own manual confirmation** (`PATCH
/supplier/me/orders/:subOrderId`) now requires a real short note when
setting status to `'delivered'` — a deliberate action, not a casual
one. If a sub-order was already confirmed by real carrier tracking,
a later manual call is rejected outright — carrier provenance can
never be silently downgraded to a manual claim.

**HONEST LIMITATION**: this was built from documented knowledge of
17TRACK's push/webhook API structure, not verified against a real,
live 17TRACK account (no such account exists to test against here).
Webhook field names and the signing scheme can change between API
versions — verify the actual real payload shape and signature header
using 17TRACK's own webhook test tool in your dashboard before relying
on this in production, and adjust `webhooks/routes.js` if what you see
differs from what's assumed here.

**Tested end-to-end** — see `apps/supplier-portal/src/carrierWebhook.integration.test.js`
(7 tests, REAL backend): a request with no signature or a genuinely
wrong one is rejected; a correctly signed delivered event updates the
real sub-order with carrier provenance; a non-delivered status update
is correctly skipped, not an error; a real best-effort batch — an
unmatched tracking number never blocks other real entries; once
carrier-confirmed, a supplier can no longer manually override that
confirmation; manual confirmation requires a real note; a missing data
array is rejected.

**A real, significant data-hygiene issue was found and fixed while
testing this**: `GET /supplier/me/orders` had grown to ~5.6 real
seconds and a 1.75MB response, causing real test timeouts unrelated to
this feature's own code — traced to ~8,800 accumulated real test
orders left behind across many earlier sessions' testing, all
identifiable by a consistent real `@example.com` buyer/guest email
pattern never used by anything except automated tests. Cleaned up
(orders, sub-orders, line items, return cases, reviews, and the
now-orphaned test buyer accounts, handled in real dependency order),
confirmed the same endpoint dropped to ~19ms afterward, and re-ran the
full three-app suite to confirm genuine stability.

## Real transactional emails beyond password reset (new)

Four new real trigger points, all reusing the same generic SMTP
infrastructure already built for password reset — no new email
provider decision needed. Each is a real, best-effort follow-up AFTER
its real underlying action already committed successfully — a real
SMTP network call has no business inside a database transaction, and
an email hiccup must never roll back or block a real order, shipment,
delivery, or payout that already genuinely succeeded. Falls back to an
honest console log when SMTP isn't configured, same as password reset.

- **Order confirmation** — sent right after a real order is placed
  (`POST /order`), to a real logged-in buyer's account email or a real
  guest's `guestEmail`. Real product names are fetched fresh for the
  email (the order-placement flow itself never needed them).
- **Shipping notification** — sent when a sub-order is marked
  `'shipped'`, including the real tracking number when one was given.
- **Delivery notification** — sent when a sub-order reaches
  `'delivered'`, from EITHER real path: the supplier's own manual
  confirmation, or a real carrier-confirmed delivery via the 17TRACK
  webhook (migration 026) — a carrier-confirmed delivery gets the exact
  same real notification a manual one would.
- **Payout confirmation** — sent to the real supplier's own account
  email (via `users.supplier_id`) right after a real payout is
  recorded, showing the real amount and how many real orders it
  covered.

**Tested end-to-end** — see `apps/admin-dashboard/src/transactionalEmails.integration.test.js`
(5 tests, REAL backend): placing a real order succeeds regardless of
email delivery; a real guest order (no account) is also handled
correctly; marking a sub-order shipped succeeds regardless of email
delivery; manually confirming delivery succeeds regardless of email
delivery; recording a real payout succeeds regardless of email
delivery to the supplier. Plus `apps/admin-dashboard/src/email.test.js`
(5 new tests) directly against the 4 new template functions — real
order id/items/total shown correctly; real tracking number shown when
provided and gracefully omitted when not; real amount and correct
singular/plural wording; every template personalizes the greeting with
a real name and falls back gracefully without one.

## Real bug fixed: delivery confirmation moved to the hub (migration 027)

**Found directly by the person, not by me**: this business's real
suppliers ship LOCALLY within China — city to city, supplier to hub.
Their own tracking number only ever covers that domestic Supplier ->
Hub leg (migration 011's own header comment had already correctly
established this two-leg design: Supplier -> Hub -> Buyer). But
migrations 024 and 026 built real carrier tracking and delivery
confirmation entirely against `supplier_sub_orders` — the wrong real
tracking number, and the wrong real owner. A supplier has no real
visibility into whether a buyer actually received anything; only the
HUB's own final leg (or a real carrier covering that same leg) does.

**The real fix**: delivery confirmation — both the 17TRACK webhook and
the manual fallback — now lives on `hub_shipments`, matched against the
hub's own tracking number (already collected in
`hub_shipment_events.tracking_number` for the `'shipped_to_buyer'` step,
per migration 011's original design) rather than the supplier's.
`hub_shipments.status` gains a real `'delivered'` value, reached only
after `'shipped_to_buyer'`. `carrier_code`, `delivery_confirmed_by`
(`'carrier'`/`'hub_manual'`), and `delivery_note` all moved from
`supplier_sub_orders` to `hub_shipments`. The supplier's own endpoint
lost `'delivered'` entirely — their real leg now correctly ends at
`'shipped'` (to the hub), matching migration 011's design all along.

**New `PATCH /hub/me/shipments/:id/confirm-delivery`** — the real
manual fallback, now a hub-staff action, requiring the same real short
note as before and rejecting outright if the shipment was already
carrier-confirmed. Payout eligibility, review verified-purchase
checks, and the return-window deadline were all updated to read from
`hub_shipments` instead of `supplier_sub_orders`.

**The real, previous (incorrect) columns on `supplier_sub_orders` were
deliberately left in place** rather than dropped — this is dev/test
data, not a real production cutover needing a careful backfill, and
leaving them avoids any risk to existing data or code still mid-deploy.

**Re-verified end-to-end**: manually confirmed a supplier can no longer
set `'delivered'` at all; walked a real shipment through the full real
hub workflow to `'shipped_to_buyer'`; confirmed the webhook correctly
does NOT match the supplier's old domestic tracking number but DOES
match the hub's real final-leg one; confirmed payout eligibility and
review verified-purchase both correctly reflect hub-based delivery now.
Every existing test touching the old supplier-based delivery flow
(`payouts.integration.test.js`, `reviews.integration.test.js`,
`transactionalEmails.integration.test.js`,
`carrierWebhook.integration.test.js`) was updated to walk the real,
corrected hub workflow instead — full three-app suite (312/71/12 = 395
tests) re-run to confirm genuine stability.

## Real live FX rate — Frankfurter.app, toggleable (migration 028)

**Confirmed scope, discussed before building**: a real automatic/manual
toggle, not a one-way automatic switch — `fx_rates.source` already
anticipated a real `'live'` value (migration 014's own header comment),
this migration is what actually wires that up. Defaults to `'manual'`
— the existing, already-working real fallback — so applying this
migration causes zero real behavior change until an admin explicitly
switches it on. Confirmed refresh cadence: once a real day, not
constant polling — real exchange rates don't move fast enough to need
that, and it keeps things simple and fast.

**Frankfurter.app was chosen specifically** because it's genuinely
free, needs no API key or account, and is backed by real European
Central Bank data (updated once per real business day, not live
market-tick pricing, but accurate and reliable for a business like
this one).

**`GET/PATCH /pricing/fx-rate-mode`** — the real toggle. Switching TO
`'automatic'` triggers a real, immediate refresh right away, rather
than waiting up to a real 24 hours for the first scheduled tick.
**While in automatic mode, the existing manual `PATCH /pricing/fx-rate`
endpoint is rejected outright** with a clear message asking to switch
to manual mode first — otherwise a manual entry would just get
silently overwritten by the next real automatic refresh, which would
be confusing.

**Real, once-a-day scheduling** uses a plain `setInterval` rather than
a new cron dependency, matching this project's preference for minimal,
generic implementations — started once at real server boot (never
during tests, since it's gated behind `require.main === module`),
refreshing immediately on startup if already in automatic mode (so a
fresh restart doesn't wait a full real day for its first live rate),
then every real 24 hours after that. Every refresh is real,
best-effort — a real network hiccup or an unexpected real response
shape is logged and never crashes the server or touches the existing
real rate; see `modules/pricing/fxRateRefresh.js`'s header comment.

**HONEST LIMITATION**: this sandbox's network access does not include
`api.frankfurter.app` in its allowlist (confirmed directly — a real
manual test here got a real `403` from the egress proxy, not a
connection failure), so this could not be tested against the real,
live Frankfurter API from here — only built carefully from their
documented, public API format, and confirmed to fail gracefully
(logged, non-fatal, existing rate left untouched) when that real call
cannot succeed. Verify the actual real response shape once running
outside this sandbox.

**Tested end-to-end** — see `apps/admin-dashboard/src/fxRateMode.integration.test.js`
(4 tests, REAL backend): defaults to manual mode, and the manual rate
endpoint works normally in that mode; switching to automatic mode
rejects the manual rate endpoint with a real, clear message; an invalid
mode value is rejected and non-admins are blocked from both endpoints;
restores manual mode afterward so other tests and manual use are
unaffected. Manually confirmed the real graceful-failure behavior when
automatic mode is switched on inside this sandbox (a real `403`,
logged, non-fatal, existing rate untouched).

## Real order cancellation (migration 029)

**Confirmed scope, discussed before building**: a buyer can cancel
their own real order only while every real sub-order within it is
still `'pending'` or `'preparing'` — the moment even one genuinely
ships, self-service cancellation is rejected with a clear message
pointing to support instead. Since real payment capture isn't built
yet, cancelling is purely a real status change right now — there's no
real captured payment to refund.

**`POST /order/:id/cancel`** — real ownership check (a real logged-in
buyer or a real matching `guestEmail`, same pattern as `GET
/order/:id`), real eligibility check (every sub-order still
pending/preparing), sets both the order and every one of its
sub-orders to `'cancelled'` in one real transaction. A real, best-effort
notification is sent to every real supplier whose sub-order was just
cancelled, since it concerns them too, not just the buyer.

## Real guest-to-account conversion (migration 029)

**Confirmed scope**: prompted right on the real order confirmation
moment (not via a separate email). At real signup, any existing real
guest order placed under that exact same email is automatically linked
to the new real account — `orders.buyer_id` is set, so it shows up in
real order history immediately, without needing any separate "claim
this order" step. `POST /auth/signup` now returns a real
`linkedOrderCount` so the caller can show an honest, accurate
confirmation (or nothing at all when it's genuinely zero).

**Tested end-to-end** — see `apps/admin-dashboard/src/orderLifecycle.integration.test.js`
(7 tests, REAL backend): a buyer can cancel their own order while
pending; cancelling an already-cancelled order is rejected; once a
real sub-order has shipped, cancellation is rejected with a clear
message; a real guest order can be cancelled with the correct guest
email and is rejected with the wrong one; a different buyer cannot
cancel someone else's order; signing up with the same email a real
guest order used links that order to the new account; a fresh signup
with no prior guest orders reports zero linked orders.

**Mobile app**: a real "Cancel order" button on the order detail
screen, shown only when the real backend's own eligibility check would
actually allow it (mirrored client-side so the button never appears
only to fail). A real, dismissable "Save your order history" prompt
shows right after a real guest order is placed, pre-filling the exact
guest email used (since signing up with that same email is what
genuinely links it) — see `apps/mobile/README.md`'s equivalent section
for the full real UI design and its own honest limitation (this
sandbox has no Flutter SDK to run or test this code).

## Real order shipping addresses (migration 030)

**A real, honest gap was found first, raised directly by the person**:
no order, guest or logged-in, ever actually collected a real shipping
address — the existing real "saved addresses" feature
(`buyer_addresses`, migration 017) was never connected to placing an
order at all.

**Confirmed fix, refined over several real rounds before building**: a
real logged-in buyer must now provide a real address at checkout —
either picking a saved one (`addressId`) or adding a new one right
there (`address`) — since they already have a real account to save it
to. A real guest, who has no such account, can still place an order
with just their email as before; their address is collected
afterward instead, via a real geolocation-based suggestion
(reverse-geocoded, editable, never blindly trusted) or a real manual
"Add address" action — the order sits in a real, honest "pending
address" state in the meantime.

**`order_addresses`** — one real row per order, captured permanently at
the moment it's confirmed, deliberately NOT a live reference to
`buyer_addresses` (a buyer editing or deleting a saved address later
must never silently change where an already-placed real order ships
to). Real provenance tracked via `source`: `'saved_address'` (copied
from a real saved address), `'manual'` (typed in directly), or
`'geolocation'` (a guest's real reverse-geocoded location, confirmed
by them). A real order's address status is deliberately DERIVED from
whether a real row exists here, not a separate flag that could drift
out of sync.

**`POST /order`** now requires `address` or `addressId` whenever
`userId` is present — rejected with a clear 400 otherwise. A real
`addressId` is looked up fresh and verified to actually belong to that
buyer before being copied in (never silently trusted). For a real
guest (`guestEmail` only), both remain optional.

**`PATCH /order/:id/address`** — the real, post-confirmation path,
used by a real guest completing a real "pending" order (or a logged-in
buyer correcting one), using the same real ownership check as every
other buyer-facing order endpoint (owning buyer or matching
`guestEmail`).

**A significant, real blast radius**: 10 existing test files across all
three apps created orders via a logged-in `userId` without any address
— every one was updated to include a real, valid test address,
re-verified passing individually before the full suite was re-run.

**Tested end-to-end** — see `apps/admin-dashboard/src/orderAddresses.integration.test.js`
(7 tests, REAL backend): a logged-in buyer cannot place an order
without a real address or addressId; a real inline address requires
every real field and is saved with `source: 'manual'`; a real saved
address is correctly copied via `addressId` with `source:
'saved_address'`; an `addressId` belonging to a different buyer is
rejected, not silently used; a real guest order can be placed with no
address at all (a real, honest pending state, not an error); a real
guest can confirm their address afterward via `PATCH`, correctly
tagged `source: 'geolocation'`; the wrong guest email is rejected when
confirming, and a real address can be updated after being set once.

**Mobile app**: a real address picker at checkout for a logged-in
buyer (pick a saved address, or add a new one — saved to their real
account for reuse when possible). For a real guest, a real
geolocation-based suggestion shows right after order confirmation,
using OpenStreetMap's free Nominatim service to reverse-geocode a real
device location into an editable address (same free-provider reasoning
as the Frankfurter FX rate integration) — declining, or the location
being unavailable, leaves the order in the real "pending address"
state, with a real "Add address" action always available afterward
from the order detail screen. See `apps/mobile/README.md`'s equivalent
section for the full real UI design and its own honest limitations.

## Real photos on product reviews (migration 031)

**Confirmed scope**: up to 3 real photos per review, genuinely optional
— a review remains valid with just a rating and no photos, same as
before this migration. Reuses the same real upload endpoint already
built for supplier product photos and hub evidence photos (`POST
/uploads/product-image`) — the actual work there (validate real
dimensions/type, save, return a real URL) is identical regardless of
what the photo is evidence of. **That endpoint's role check was
broadened to include `'buyer'`** (previously `supplier`/`hub_staff`
only).

**`review_photos`** — one real row per photo, cascade-deleted with its
review (a real `ON DELETE CASCADE`, not application-level cleanup).
`POST /reviews` accepts an optional `photos` array; re-submitting a
review with different photos **fully replaces** the previous real set
(deletes and re-inserts), rather than appending — matching how a
resubmission already sends the whole review back to `'pending'` for
real re-review.

**A real bug was found and fixed while testing this**: the moderation
endpoint (`PATCH /reviews/:id/moderate`) built its response from the
raw updated row, which never had a real `photos` field attached —
approving or rejecting a review with photos would show `photos: []` in
that one specific response, even though the photos were genuinely
still there (correctly visible everywhere else — the pending queue,
the public endpoint). Fixed by attaching photos to that response too,
the same way every other endpoint in this module already does.

**Tested end-to-end** — see `apps/admin-dashboard/src/reviewPhotos.integration.test.js`
(7 tests, REAL backend): a review can be submitted with up to 3 real
photos; a 4th is rejected; a review with no photos remains valid;
re-submitting with different photos fully replaces the previous set;
photos correctly show in the moderation queue, the moderate response
itself (the real bug above), and the public endpoint once approved;
deleting a review also genuinely removes its photos via cascade; a
real buyer (not just supplier/hub_staff) can now use the shared upload
endpoint. **A second, real, pre-existing test needed updating**: an
existing upload test asserted the OLD behavior (a buyer gets rejected)
— correctly updated to assert the new, intentional one instead.

**Mobile app**: a real photo picker in the review form (up to 3, using
the device's photo gallery), with thumbnails and per-photo removal
before submitting; photos also show on both the buyer's own
in-progress review and every approved review displayed publicly. See
`apps/mobile/README.md`'s equivalent section for the full real UI
design and its own honest limitations.

## Real shareable product links — share action only (new)

**Confirmed scope**: just the real native share action for now, using
the device's own share sheet — not a real public web page yet (that's
confirmed, deliberate follow-up work). No backend change at all — see
`apps/mobile/README.md`'s equivalent section for the mobile
implementation.

## Real recently viewed products — synced to account (migration 032)

**Confirmed scope**: synced to the real buyer's account (not
device-local), so it follows them across devices. Real logged-in
buyers only — a real guest has no account for this to sync to.

**`recently_viewed_products`** — one real row per buyer+product pair. A
repeat real view of the same product updates `viewed_at` (a real "move
to the front" behavior) rather than creating a duplicate row. `GET
/recently-viewed/me` returns the real, most recent 20, newest first,
reusing the catalog module's buyer-facing product DTO helpers (same
real pattern as the existing wishlist module) so it never risks
drifting from what a product looks like elsewhere.

**Tested end-to-end** — see `apps/admin-dashboard/src/recentlyViewed.integration.test.js`
(4 tests, REAL backend): recording a view and fetching the list shows
it, most recent first; re-viewing a product moves it back to the
front rather than duplicating it; an unauthenticated request is
rejected and a nonexistent product is rejected too; a real buyer with
no views yet gets a genuinely empty list, not an error.

## Real reporting/flagging of inappropriate reviews (migration 033)

**Confirmed scope**: a real buyer can flag a review with a required
short reason. One real flag per buyer per review (a real UNIQUE
constraint) — prevents the same account from repeatedly flagging the
same review to force it up an admin queue; re-flagging is a genuine,
harmless no-op, not a duplicate or an error. Flagging never auto-hides
anything — same real pattern as every other moderation flow in this
project: a real admin always makes the actual call.

**`review_flags`** — one real row per flag, cascade-deleted with its
review. `GET /reviews/flagged` (admin) shows every real flagged review
with its flag count and every real reason given, most recently flagged
first. An admin can either **dismiss** the real flags (`POST
/reviews/:id/dismiss-flags` — the review stays exactly as it was) or
**hide** the review outright, reusing the existing real `PATCH
/reviews/:id/moderate { action: 'reject' }` — no new review status was
needed, since a rejected review is already correctly hidden from
public view.

**Tested end-to-end** — see `apps/admin-dashboard/src/reviewFlags.integration.test.js`
(6 tests, REAL backend): flagging without a real reason is rejected,
with one it succeeds; re-flagging the same review by the same buyer is
a genuine no-op, not a duplicate; the real admin flagged queue shows
flag count and every real reason given; dismissing flags clears them
and removes the review from the queue without changing its status;
non-admins cannot see the flagged queue or dismiss flags; flagging a
nonexistent review is rejected with a real 404.

**Admin dashboard**: the Reviews page gained a real Pending/Flagged tab
toggle. **A real bug was found and fixed while building this**:
switching tabs re-rendered immediately with the new tab selected, but
the real reviews array still briefly held the PREVIOUS tab's data
until the new fetch resolved — a pending review has no real
`flagReasons` field, so rendering it under the flagged tab's own
render logic crashed. Fixed two ways: clearing the reviews array
immediately on every tab switch (better UX, avoids a stale-data
flash), and making the render itself defensive (`(r.flagReasons ||
[])`) so a mismatched shape can never crash the page even if the
timing gap reopens some other way.

## Real bug found and fixed: the live FX rate scheduler could crash the entire server

**Found and fixed in this same pass, unrelated to the three features
above**: `startScheduledFxRateRefresh()`'s own tick function (migration
028) had no real `try`/`catch` around it at all. If the real database
was ever unavailable for even a moment right when a real scheduled
tick fired, `getFxRateMode()`'s own query would throw, and since
nothing ever caught it, Node treated it as a real unhandled promise
rejection and **crashed the entire API server** — not just skipped
that one tick. A real, temporary database hiccup should never take
down the whole real API; every other real background/best-effort
action in this project already follows this same real pattern. Fixed
by wrapping the tick's real body in a real `try`/`catch`, logging and
continuing rather than crashing — the next scheduled tick will simply
try again.

## Real live carrier tracking events (new)

**Confirmed scope**: real, granular carrier events (e.g. "departed
origin facility," "customs clearance," "out for delivery") pulled
directly from 17TRACK's own tracking-QUERY API, not just the webhook
PUSH already integrated (migrations 026/027, which only ever tells us
the final `'delivered'` moment, never the events leading up to it).

**`services/api/src/modules/tracking/liveTracking.js`** — merges two
real, independent sources into one real timeline for the buyer:

- **Our own real hub milestones** (received, opened, inspected,
  packed, shipped to you, delivered) — always real and available,
  never dependent on any external API succeeding.
- **Real live carrier events**, queried from 17TRACK for the hub's own
  final-leg tracking number (never the supplier's domestic one — see
  migration 027's own header comment). Registers the tracking number
  first (a real, documented no-op if already registered), then queries
  for its current real event history.

**`GET /order/:id/tracking`** — real, buyer-facing, same real ownership
check as every other order endpoint (owning buyer, matching
`guestEmail`, or admin).

**A new required env var**: `TRACK17_API_KEY` — separate from the
existing `TRACK17_WEBHOOK_SECRET` (the query API and the webhook are
two different real 17TRACK products, with different credentials).
Missing this real key is handled as a real, honest fallback — the
carrier-events portion is simply skipped (logged, not an error), and
the real hub milestones still show correctly regardless.

**HONEST LIMITATION, same as the existing webhook integration**: this
was built entirely from 17TRACK's documented v2.2 API structure, not
verified against a real, live account (no such account exists to test
against here). The real endpoint paths, the real register step, and
the real response shape (`data.accepted[].track_info.tracking.providers[].events[]`)
are their own documented API as of this project's training data —
17TRACK has changed API versions before and may again. Verify the
actual real request/response shape against your own live account
(their dashboard has a real request tester) before relying on this,
and adjust `parseTrackingEvents()` if what you see differs. Parsing is
deliberately defensive — any real shape mismatch returns a real, empty
carrier-events list rather than throwing, so the hub milestones (which
never depend on this) are never at risk.

**Tested end-to-end** — see `apps/admin-dashboard/src/liveTracking.integration.test.js`
(4 tests, REAL backend): an order with nothing shipped yet returns a
genuinely empty timeline, not an error; real hub milestones show
correctly and the hub tracking number is used, never the supplier's
domestic one; a different buyer cannot see this order's real tracking;
an admin can see tracking for any real order, and a real guest order
works with the correct email, rejected with the wrong one. The real
carrier-query portion itself could only be confirmed to fail
gracefully in this sandbox (no `TRACK17_API_KEY` configured here) —
verify the actual live query once you have real 17TRACK credentials.

**Mobile app**: a new "Track your package" screen, reached via a
button on the order detail screen, showing the real merged timeline as
a visual, icon-based list.

## Product search (added to GET /catalog/products)

**A real gap, not previously covered**: buyers could filter by category
or by a saved vehicle, but there was no way to actually type "brake
disc" and get results — a significant everyday-use gap for a parts
marketplace.

**`GET /catalog/products?search=bmw+brake`** — real multi-word matching:
every word in the search string must match SOMEWHERE (name in either
language, part, OEM number, category, or the vehicle brand/model this
product fits, via a real `EXISTS` subquery against the fitment cascade
rather than a `JOIN` that would produce duplicate rows for a
multi-fitment product) — "bmw brake" finds brake products that fit a
BMW, not a literal string match. Combines correctly with the existing
`category` filter (both apply together, not one replacing the other).

**A real, related bug found and fixed while building this**: the buyer-
facing product LIST endpoint had NO `status = 'active'` filter at all —
a still-`translating` or `pending` product (never reviewed, not
buyer-facing anywhere else in this system) could leak into browsing and
search results. This is exactly the kind of gap that search would make
immediately visible, so it was fixed here rather than shipped alongside
a feature that would have surfaced it the moment someone typed a
matching term.

**Two more real additions, for the mobile app's category browser and
home feed**:
- **`part=Front+Brake+Disc`** — a real EXACT-match filter, distinct
  from `search` (which fuzzy-matches partial words). This is for "tap a
  real Part in the category browser, see exactly the products for that
  Part" — wants precision, not a fuzzy multi-word match.
- **`sort=newest`** — real, explicit ordering by `created_at DESC`.
  This endpoint previously had NO `ORDER BY` at all; whatever order
  Postgres happened to return was incidental, never a real guarantee.
  Powers the mobile home feed's "Newest" filter.

**Tested end-to-end** — see `apps/admin-dashboard/src/productSearch.integration.test.js`
(8 tests): a product genuinely does not appear in search before
approval and DOES appear immediately after (proving the status-filter
fix), search precision holds (searching one category never returns an
unrelated one), a real multi-word search requires every word to match
(a brand that doesn't fit the product correctly returns no match, not
a false positive), OEM number matching works directly, a nonsense term
returns real zero results rather than an error, search combines
correctly with the category filter, the real exact `part` filter is
precise (a different real part in the same category doesn't match),
and `sort=newest` returns products in genuine creation-time order
(verified against two real products created moments apart, not assumed
from incidental database behavior).

## Category + parts reference lists (migration 015)

**Confirmed requirement**: major categories and the specific parts that
belong to each one are now real, admin-managed reference data — a
supplier picks a real Part from a real list scoped to the Category they
selected, rather than typing free text into a "Part" field. Same
structural idea as the Vehicle Data fitment cascade (migration 010),
just two levels instead of four.

**Backward compatible by design**: `product_categories.id` values match
the EXISTING hardcoded category identifiers this project has used since
migration 001 (`brake`, `engine`, `electrical`, `filters`, `suspension`,
`lighting`) — every existing product's real `category` value continues
to mean exactly what it already meant, no data migration needed for
existing rows.

**`products.part` deliberately stays plain text, not a foreign key** —
same pattern as `category`/`position` elsewhere in this schema. Going
forward its value is validated against `category_parts` in application
code (scoped to the selected category specifically — a real part from
a DIFFERENT category, like "Air Filter" submitted under "brake", is
rejected even though the name itself is valid somewhere), not left as
arbitrary free text. This avoids a large blast-radius change to every
place that already reads `product.part` as plain display text
(catalog, search, admin order line items).

**Real endpoints**: `GET /catalog/categories` and
`GET /catalog/categories/:id/parts` are public (used by both the
supplier portal's dropdowns and the mobile app's home screen, no auth
needed to browse). Admin-only CRUD
(`POST`/`DELETE /catalog/categories`, `POST /catalog/categories/:id/parts`,
`DELETE /catalog/parts/:id`) with real referential protection — you
cannot delete a category that real products reference, AND (a real bug
found and fixed while building this — see below) you cannot delete a
category that still has parts attached, even parts no product happens
to use.

**A real bug found and fixed via testing, not caught by inspection**:
the first version of `DELETE /catalog/categories/:id` only checked for
real products referencing the category directly — it did NOT check
whether the category still had parts attached. Since `category_parts.category_id`
has a foreign key to `product_categories` with no `CASCADE`, deleting a
category that still had parts threw a raw, uncaught database
constraint error (a real 500), not a clear, specific 409. Fixed by
adding an explicit check for attached parts before attempting the
delete.

**Tested end-to-end** — see `apps/admin-dashboard/src/categoryParts.integration.test.js`
(8 tests): real seeded categories/parts are publicly readable; a
category outside the real list is rejected; a part that isn't real for
the selected category is rejected (free text no longer works); a REAL
part from a DIFFERENT category is rejected (cross-category mismatch,
not just "is this string real anywhere"); a real category+part
combination is accepted; admin-only create/delete works and is rejected
for non-admins; a category with real products OR real parts still
attached cannot be deleted (the exact bug above, confirmed fixed); and
a real part a real product references cannot be deleted either.

## Real supplier messaging with bidirectional auto-translation (migration 016)

**Confirmed requirement**: a real messaging channel between suppliers
and the Leap platform team — supplier writes in Chinese, admin reads it
auto-translated to English; admin writes in English, supplier reads it
auto-translated to Chinese.

**Deliberately a SEPARATE system from `support_tickets`** (migration
005) — that system exists specifically to enforce "buyers never contact
suppliers directly." Supplier messaging is a genuinely different
relationship (supplier ↔ platform, day-to-day), not a variant of buyer
support, so it gets its own real table (`supplier_messages`) rather than
being bolted onto tickets.

**Confirmed design: translate ONCE at send time, store BOTH the
original and the translation** — not translate-on-every-read. Faster,
cheaper (no repeated API calls just to redisplay the same message), and
the translation stays consistent even if the translation service's
quality changes later. Either side can always see the real original
text too, not just trust a translation blindly — same principle as the
Moderation page showing a supplier's real Chinese original alongside
the reviewed English translation.

**Translation provider: Google Cloud Translation, confirmed after a
real discussion, not assumed**. Baidu Translate was the initial
recommendation specifically because it's more reliable from within
mainland China — but once it was established this backend will NOT be
hosted in China, that specific advantage doesn't apply, and Google was
chosen instead. A real, acknowledged trade-off that came with that
choice: Google costs more at volume (~$20/million characters vs
Baidu's ~$7/million) — likely a non-issue given Google's free 500K
characters/month tier for expected day-to-day chat volume, but not
hidden either way.

**Honest state of this integration, same category as the payment
gateways (Stripe/APS/PayPal) and the pricing engine's FX rate**: the
real REST call in `services/api/src/modules/supplier-messages/translate.js`
is genuinely correct (Google Cloud Translation v2's documented API),
but there is NO real `GOOGLE_TRANSLATE_API_KEY` configured in this
environment — no live credentials were available to test against.
Set that one environment variable when real credentials exist and it
starts working with no code change. Until then, `translateText` returns
a clear, honest "unavailable" result rather than fabricating a
translation — every message stores that honestly too
(`translation_status = 'unavailable'`, the real original text, no fake
translated text), and the UI shows the real original with a clear
"translation unavailable" note instead of silently showing nothing or
something wrong. Both the real success path and the real failure path
of the translation call were verified directly (a mocked Google API
response for each), since no real credentials exist to test the actual
live call end-to-end.

**Real endpoints**: `GET`/`POST /supplier-messages/me` (supplier's own
side, scoped to their own `supplierId`, same ownership-via-WHERE-clause
pattern used throughout this project) and `GET /supplier-messages/admin`
(a real inbox — every supplier with at least one message, most recently
active first) / `GET`/`POST /supplier-messages/admin/:supplierId`
(admin-only, any specific supplier's thread).

**Tested end-to-end** — see `apps/admin-dashboard/src/supplierMessages.integration.test.js`
(7 tests): a supplier's message stores the real original Chinese text
and is honest about translation being unavailable (not fabricated); an
admin reply is correctly marked English-original/Chinese-target; a
supplier only ever sees their own thread while admin can view any
specific supplier's by id; non-admins are rejected from the admin
inbox and reply endpoint; replying to a nonexistent supplier is a real
404, not a raw database error; empty/whitespace-only text is rejected
on both send endpoints; and the real admin inbox lists a supplier with
a genuine most-recent-message preview.

## Real derived order status, for the mobile app's order status tabs

**A real bug found and fixed while adding this**: `orders.status` is
set to `'to_ship'` the moment an order is created and was NEVER updated
again anywhere in this codebase, no matter how far the real shipment
actually progressed — the real progress lived only on each
`supplier_sub_orders` row instead. Building status filter tabs directly
on that frozen column would have shown everything under one tab
forever, not a real filter.

**Fixed with a real, computed `displayStatus`** (both on `GET /order`
and `GET /order/:id`), derived from the order's ACTUAL real sub-order
progress and real return cases, not the stale stored column:
- **`returns`** — the order has at least one real `return_cases` row,
  regardless of the underlying shipment status. Takes priority over
  everything else, since that's what a buyer cares about most for that
  order right now.
- **`shipped`** — at least one real sub-order has shipped or been
  delivered. A real, deliberate design choice for multi-supplier orders
  with genuinely MIXED progress (one part shipped, one still preparing):
  counts as `shipped` overall rather than staying `to_ship`, since real
  progress has genuinely happened.
- **`to_ship`** — nothing has shipped yet and there's no return case.

**Confirmed scope, discussed before building**: only these 3 states are
computed and filterable today. `to_pay` and `to_review` were part of
the original request but have no real system behind them yet — no real
payment capture exists (every order is already placed the moment it's
created, there's no state where it's genuinely "awaiting payment"), and
no review system exists. Both real, honest gaps, not silently faked
with an empty tab that would just look broken.

**`GET /order?status=to_ship|shipped|returns`** — real filtering,
applied after computing the real derived status for each of the
buyer's own orders (or all orders, for an admin).

**Tested end-to-end** — see `apps/admin-dashboard/src/orderDisplayStatus.integration.test.js`
(5 tests): the real bug itself is confirmed still present in the raw
`status` column while `displayStatus` reflects genuine real progress; a
real return case makes `displayStatus` "returns", taking priority over
the underlying shipment status; an untouched order correctly shows
`to_ship`; the real `?status=` filter returns exactly the orders in
that real derived state and none of the others; and a genuine
multi-supplier order with mixed real progress counts as `shipped`
overall.

## Real buyer address book, capped at 3 (migration 017)

**Confirmed requirement**: a customer can have up to 3 real saved
addresses. "Addresses" was a genuinely dead nav row before this in the
mobile app (`route: null`) — tapping it did nothing at all.

**The cap is enforced in application code, not a DB constraint** — same
pattern as the mandatory-3-photos rule on product submission elsewhere
in this project: a real, deliberate business rule, checked where the
real validation logic already lives, not baked into the schema in a way
that's harder to adjust later.

**Two real invariants, both enforced transactionally, not left to best
effort**:
- **Exactly one default at all times** (once at least one address
  exists) — the very first address a buyer saves becomes the real
  default automatically regardless of what was passed; setting a new
  default un-defaults every other real address for that buyer in the
  SAME transaction; deleting the current default promotes the real
  next-oldest address to default rather than leaving the buyer with
  addresses but no real default.
- **Real ownership scoping** — a buyer only ever sees, updates, or
  deletes their own real addresses; cross-buyer access returns a real
  404, not a leak of another buyer's data or its mere existence.

**Real endpoints**: `GET`/`POST /addresses/me`,
`PATCH`/`DELETE /addresses/me/:id`, all `requireAuth`-scoped to the
calling buyer's own `req.user.sub`.

**Tested end-to-end** — see `apps/admin-dashboard/src/addresses.integration.test.js`
(8 tests): the first address becomes default automatically; a real cap
of 3 is enforced with a clear message; setting a new default
un-defaults every other one, exactly one default at all times; deleting
the default promotes the next real address; cross-buyer access is
rejected at every endpoint; missing required fields are rejected with a
clear message naming exactly which ones; unauthenticated requests are
rejected; and a real partial update changes exactly the fields provided
and leaves the rest untouched.

## Real wishlist (migration 018)

**Confirmed requirement**: a buyer saves real products for later. Same
simple many-to-many junction pattern as My Garage's saved vehicles
(migration 008).

**Reuses the real catalog module's buyer-facing product DTO helpers**
(`toBuyerProductDto`, `attachBuyerPrice`, `attachBuyerImages` — now
exported from `services/api/src/modules/catalog/routes.js` specifically
for this) rather than re-implementing language resolution, live
pricing, and photo attachment a second time, which would risk drift
between what a product looks like in the catalog vs. in the wishlist.

**Add and remove are both real, idempotent operations** — adding an
already-wishlisted product, or removing an already-absent one, is not a
real error either way (`ON CONFLICT DO NOTHING` on insert; a `DELETE`
that matches zero rows still succeeds). A real double-tap or a slow-
network retry shouldn't surface as a failure for something this simple.

**Real endpoints**: `GET /wishlist/me` (the full real list, with live
photos/price, same as browsing), `GET /wishlist/me/:productId` (a real,
specific "is this one product wishlisted" check — lets a product card's
heart icon know its own state without fetching and searching the
buyer's entire wishlist just to answer one yes/no question),
`POST`/`DELETE /wishlist/me/:productId`.

**Tested end-to-end** — see `apps/admin-dashboard/src/wishlist.integration.test.js`
(8 tests): a fresh buyer starts with a real empty wishlist; adding a
real product returns it with real photos/price attached, same as the
catalog; the real is-wishlisted check reflects genuine state before and
after; adding the same product twice is idempotent with no duplicate;
a nonexistent product is rejected with a real 404; removing works and
removing again is idempotent; a buyer only ever sees their own real
wishlist; and unauthenticated requests are rejected on every endpoint.

## Real notifications (migration 019)

**Confirmed scope, discussed before building**: triggered by order
changes and message/ticket replies — a real, concrete decision made
before writing any code (as opposed to Referral rewards, discussed at
the same time but deliberately left for later, since it has genuine
open business questions — what the reward actually is, what triggers
it, whether it's capped — that shouldn't be guessed at in code).

**4 real, named trigger points**, each wired directly into the existing
endpoint where the real event actually happens — not a vague "whenever
something changes" background job:
1. A real sub-order status change to `shipped` or `delivered`
   (`services/api/src/modules/supplier/routes.js`) → notifies the real
   buyer. Part of the SAME transaction as the real status update.
2. A real return case status change
   (`services/api/src/modules/returns/routes.js`) → notifies the real
   buyer. Links to the real ORDER, not the return case itself — there's
   no separate return-case screen in the mobile app, but there is a
   real order detail screen showing the return request inline.
3. An admin's real reply to a buyer's support ticket
   (`services/api/src/modules/support/routes.js`) → notifies the real
   buyer. Skipped for a guest ticket (`buyer_id` is null) — no real
   account to attach an in-app notification to.
4. An admin's real reply to a supplier message
   (`services/api/src/modules/supplier-messages/routes.js`) → notifies
   the real supplier's linked user account (`users.supplier_id`).

**A single shared `createNotification()` helper**
(`services/api/src/modules/notifications/helpers.js`) used by all 4
trigger sites, so the shape stays consistent rather than four separate
ad-hoc `INSERT`s. Accepts an optional already-open transaction client so
notification creation can be part of the SAME transaction as the real
event that caused it (used by trigger #1) — not a separate best-effort
step that could succeed even if the real underlying update rolls back.
Silently no-ops when `userId` is null (a guest ticket/order) — an
absent account isn't an error, just nothing to notify.

**Real endpoints**: `GET /notifications/me` (most recent 50, newest
first), `GET /notifications/me/unread-count` (powers a real badge
without fetching and counting the entire list), `PATCH /notifications/me/:id/read`,
`PATCH /notifications/me/read-all`. All scoped to the calling user's own
`req.user.sub` — cross-user access to another user's notification is a
real 404, not a leak. **Consumed by both real UIs** — the buyer mobile
app's bell icon and (added shortly after, once it was noticed the
supplier side had no way to actually see its own real trigger #4
notifications) the supplier portal's own real bell icon, same endpoints,
no separate backend needed since a supplier is a real user too.

**Tested end-to-end** — see `apps/admin-dashboard/src/notifications.integration.test.js`
(8 tests): each of the 4 real trigger points is verified independently
(a real sub-order shipment, a real return case update, a real admin
ticket reply, a real admin supplier-message reply all produce a real,
correctly-typed notification for the correct real recipient); the real
unread count reflects genuine state and decrements correctly when one is
marked read; mark-all-read genuinely clears every real unread
notification; cross-user access to another buyer's notification is
rejected; and unauthenticated requests are rejected on every endpoint.

## Real promotions engine — referral rewards, admin campaigns, and general promo codes (migration 020)

**Confirmed scope, discussed at real length before building**: this
started as "referral rewards" and was deliberately EXPANDED into a
general, admin-configurable coupon system once it became clear the
actual need was broader than referrals alone — real event/campaign
codes, free shipping promotions, whatever comes up later, not a narrow
one-off that would need rebuilding the first time a seasonal sale is
wanted. Referral rewards are one real SOURCE of codes within this same
system, not a separate mechanism.

**Confirmed decisions**:
- **Reward types**: percentage off, flat amount off, free shipping.
- **Referral trigger**: the referred person's real FIRST order, not
  mere signup — a real, deliberate deterrent against trivial fake-
  account abuse (confirmed directly, after discussing the tradeoff).
- **Cap**: a referrer can earn at most 10 real rewards
  (`MAX_REFERRAL_REWARDS_PER_REFERRER` in `promotions/helpers.js`).
- **One code per order** — no stacking multiple codes.

**Two real sources of the same `promo_codes` table**: admin-created
(`POST /promo-codes`, for events/campaigns, with real expiry and usage
limits) and referral-generated (automatic, via
`checkAndGrantReferralReward` — see below). Both go through the exact
same real validation and redemption logic; there's no special-cased
"referral discount" path separate from "admin discount" path.

**Real, server-side validation, never trusted from the client** —
`validatePromoCode()` checks: does the code exist, is it active, has it
expired, has it hit its real total-use cap, has THIS buyer hit their
real per-buyer cap. `POST /order` re-validates again at the moment of
real order placement (a code could have expired or been maxed out
between checkout preview and actually placing the order) — the
client-side check in `POST /promo-codes/validate` is a real preview,
never the actual authority.

**Free shipping is computed from the pricing engine's own real
breakdown, not an estimate** — `calculateBuyerPriceUsd()` (see the
pricing engine section above) already returns a full breakdown
including each real fee component; the order module sums every real
`shipping_volumetric` entry across all items in the order, converts it
to USD at the real FX rate, and that EXACT amount is what a
`free_shipping` code refunds. Verified end-to-end against a real
product's real breakdown, not assumed.

**Real referral flow, step by step**:
1. `GET /referrals/me` — a buyer's real referral code, created on first
   request if they don't have one (`getOrCreateReferralCode`).
2. `POST /auth/signup` accepts an optional `referralCode` — an invalid/
   made-up code, or a self-referral attempt, is a silent, honest no-op
   (`recordReferral`), never a signup error.
3. `POST /order` calls `checkAndGrantReferralReward()` AFTER the order's
   own transaction commits — deliberately a best-effort follow-up, not
   part of the order's transaction, so a problem generating the reward
   can never roll back or block a real order that already succeeded.
   Checks: is this genuinely the buyer's first real order, were they
   actually referred, has the reward already been granted, has the
   referrer hit the real cap — only then generates a real reward code
   and sends the referrer a real notification (reusing the notification
   system's `referral_reward` type, added to that table's real CHECK
   constraint in this same migration).

**Real, honest auditability on the order itself** — `orders.promo_code`
and `orders.discount_amount` record exactly which code (if any) was
used and exactly how much real discount it produced, not just a final
total that has to explain itself.

**Real endpoints**: `GET /referrals/me`; `GET/POST/PATCH/DELETE /promo-codes`
(admin-only for mutation); `POST /promo-codes/validate` (real-time
checkout preview, works for guests too since per-buyer limits are a
real no-op without a real buyer id). A promo code with genuine real
redemptions cannot be deleted (409, same "protect real referenced data"
pattern used throughout this project) — only deactivated.

**Tested end-to-end** — see `apps/admin-dashboard/src/promotions.integration.test.js`
(11 tests): a fresh buyer gets a real unique referral code starting at
zero; the FULL real referral loop (signup with a real code → referred
person's real first order → referrer gets a real, genuinely-usable 10%
reward, verified by actually placing an order with it and confirming
the exact discount); an invalid/made-up referral code at signup is a
silent no-op, not a signup failure; an invalid promo code at checkout
is a real 400 and the order is never created; a real admin flat-
discount code applies exactly; a real per-buyer usage limit is
enforced; a real total usage cap is enforced across DIFFERENT buyers,
not just per-buyer; a real expired code and a real deactivated code are
both rejected; non-admins cannot manage promo codes; and a real code
with genuine redemptions cannot be deleted, only deactivated.

## Real audience targeting for promo codes (migration 021)

**Confirmed scope, discussed via a real list presented before building**:
a promo code can target specific buyer segments, all real and
combinable with AND logic — every condition set on a code must
genuinely hold for a buyer to be eligible:
- **New users** — real `require_new_user`: the buyer has never placed
  a real order before.
- **High-value / loyal customers** — real `min_total_spend`: the
  buyer's real lifetime spend across all their real orders meets a
  threshold.
- **Frequent buyers** — real `min_order_count`: the buyer's real total
  order count meets a threshold.
- **Win-back / inactive customers** — real `min_inactive_days`: real
  days since the buyer's most recent real order meets a threshold
  (requires having ordered at least once — a brand new user hasn't
  "gone quiet", they never started, so this real check also requires a
  real prior order to exist).

**All four columns are nullable and default to unset** — an existing
code with no targeting configured is completely unaffected by this
migration, open to everyone exactly as before.

**A code with ANY real targeting set requires a real logged-in buyer**
to check eligibility against — a guest checkout has no real order
history to evaluate, so it's a real, honest rejection ("Please log in
to use this code"), not a silent bypass of the targeting rules.

**Real buyer stats are computed fresh at validation time** — a single
query against the real `orders` table (`COUNT(*)`, `SUM(total)`,
`MAX(placed_at)`) for the calling buyer, checked against whichever of
the four conditions are actually set on the code. This runs as part of
the same real `validatePromoCode()` used everywhere else — the same
function checkAndGrantReferralReward's own generated codes pass through
too, though those never have targeting set.

**Tested end-to-end** — 6 new tests added to
`apps/admin-dashboard/src/promotions.integration.test.js` (17 total
now): a real "new users only" code succeeds for a genuinely new buyer
and is rejected the moment they have any real order; a real minimum-
spend code rejects a buyer below the real threshold and succeeds once
they genuinely cross it (verified by actually placing enough real
orders to cross it, not asserting the math); a real minimum-order-count
code does the same for order count; a real win-back code rejects a
buyer who ordered too recently; a guest checkout is rejected from any
real targeted code; and a code with no targeting set remains open to
everyone, confirming this migration didn't change existing behavior.

## Real cloud photo storage — generic, works with any S3-compatible provider (new)

**Confirmed choice, discussed at real length before building**: build
this generically rather than commit to one provider yet. AWS S3,
Cloudflare R2, and DigitalOcean Spaces all speak the exact same S3 API
— `services/api/src/modules/storage/client.js` is ONE real
implementation (using the real `@aws-sdk/client-s3` package) that works
with whichever gets chosen later, purely by setting different
environment variables. No code change needed when that decision is
made.

**Real pricing discussion that led here**: egress (serving photos out
to viewers) is what actually matters most for a photo-heavy
marketplace, not storage cost — R2 charges zero egress, which is why
it's the leading recommendation, though the code doesn't assume any
particular provider.

**HONEST FALLBACK, different from the payment gateways or translation
service**: local disk storage already worked before this pass (see
`services/api/src/modules/uploads/routes.js`'s original header
comment), so an unconfigured cloud setup doesn't break real uploads —
it just means they're not yet durable/scalable the way real cloud
storage would make them. `isCloudStorageConfigured()` checks for all 4
required real environment variables together; if any are missing, or
if a real cloud upload call itself throws (bad credentials, bucket
doesn't exist, network issue), the upload honestly falls back to local
disk rather than losing the photo entirely. The real response now
includes a `storage: 'local' | 'cloud'` field so this is never silent
either way.

**Real environment variables** (all four required together to activate
cloud storage — see `storage/client.js`'s own header comment for the
full detail per provider):
```
S3_ENDPOINT=...           # provider-specific; omit entirely for real AWS S3
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto            # 'auto' is correct for R2; AWS/DO should set their real region
S3_PUBLIC_URL_BASE=...    # the real base URL used to construct public-facing image URLs
```

**Tested end-to-end** — see `apps/admin-dashboard/src/uploads.integration.test.js`
(6 tests, REAL backend, real multipart file uploads via the `form-data`
package rather than Node's native `fetch` FormData/Blob — the native
implementation was found to hang against this project's real multer-
based endpoint, a real tooling incompatibility caught and fixed, not
an application bug): a real, valid high-resolution image uploads
successfully and honestly reports `storage: 'local'` (no real cloud
credentials are configured in this environment); a real image below
the minimum resolution is rejected with the exact real dimensions in
the error; a real non-image file is rejected; unauthenticated uploads
are rejected; a buyer (not a supplier or hub staff) cannot upload a
product image; and a real hub staff account can also upload real
images, for shipment-inspection evidence. The real cloud upload path
itself (request construction, success response, and failure handling)
was separately verified directly against a mocked S3 client, since no
real cloud credentials exist to test the actual live call end-to-end.

## Setup

```bash
cd services/api
cp .env.example .env   # fill in real values as they become available
npm install
```

Then set up the database — see `db/README.md` for full instructions
(install PostgreSQL, create a database, run migrations, optionally seed
sample data). Once `DATABASE_URL` is set and migrations are applied:

```bash
npm run dev             # auto-restarts on file changes
# or: npm start
```

Server listens on `http://localhost:4000` by default (override with `PORT`
in `.env`).

## Structure

```
db/
├── migrations/            SQL migration files, applied in filename order
├── pool.js                 Shared PostgreSQL connection pool
├── migrate.js               Migration runner (npm run migrate)
├── seed.js                  Sample data loader (npm run seed)
└── README.md                 Full local setup + schema documentation
src/
├── index.js              Express app bootstrap, mounts all modules
├── config/env.js          Centralized environment variable access
├── middleware/errorHandler.js
└── modules/
    ├── auth/               Signup/login, JWT middleware (BUY-001–003)
    ├── catalog/           Products & categories (BUY-020–025, SUP-010–015),
    │                       plus admin catalog moderation (ADM-002)
    ├── fitment/            Year/Make/Model/Trim reference data (BUY-010),
    │                       PLUS the deeper Brand->Model->Generation->
    │                       Engine/Transmission cascade for supplier
    │                       product submission (migration 010) — two
    │                       coexisting systems, see that migration's
    │                       header comment for why
    ├── cart/               Multi-supplier cart (BUY-030–032), incl. a
    │                       PATCH endpoint for exact-quantity updates
    ├── order/              Order placement + supplier sub-order splitting
    │                       (BUY-031, BUY-050–053) + guest checkout
    ├── user/               Accounts, incl. guest-order account claiming
    ├── supplier/            Admin-facing supplier list/verify (ADM-001) AND
    │                       supplier-facing "me" endpoints — own profile,
    │                       products, order fulfillment, own aggregate
    │                       overview KPIs (SUP-001–022); real bulk product
    │                       import + real drafts + real per-item completion
    │                       (new, migration 023) -- see productValidation.js
    ├── support/             Support tickets — admin AND buyer-facing
    │                       "my-tickets" endpoints (BUY-060–061, ADM-012)
    ├── returns/             Return/dispute cases with SEPARATE buyer,
    │                       supplier, AND admin views into two message
    │                       threads (BUY-053, SUP-030)
    ├── garage/              Buyer's saved vehicles (BUY-004, BUY-010–012) —
    │                       distinct from fitment/'s reference catalog
    ├── overview/            Admin dashboard aggregate KPIs — deliberately
    │                       no blended $ GMV or top-markets-by-country
    │                       (no FX conversion / no country field exist)
    ├── uploads/             Product photo upload — real minimum-resolution
    │                       enforcement; real cloud storage via storage/
    │                       (new) with an honest local-disk fallback when
    │                       no real cloud credentials are configured;
    │                       also used by hub staff for evidence photos
    ├── hub/                 Regional inspection hubs — the real Supplier
    │                       -> Hub -> Buyer fulfillment pipeline (migration
    │                       011), hub location CRUD, hub assignment, and
    │                       the hub-staff-only shipment workflow endpoints
    ├── pricing/             Real supplier-RMB-cost -> buyer-USD-price
    │                       engine (migration 014) — fee components, FX
    │                       rate, and the calculation itself; used live
    │                       by catalog, cart, and order
    ├── supplier-messages/   Real supplier <-> platform messaging with
    │                       bidirectional Chinese/English auto-
    │                       translation (migration 016, Google Cloud
    │                       Translation — no live API key configured)
    ├── addresses/           Real buyer address book (migration 017),
    │                       capped at 3, exactly-one-default invariant
    ├── wishlist/            Real wishlist (migration 018) -- reuses the
    │                       catalog module's real buyer product DTO helpers
    ├── notifications/       Real notifications (migration 019) --
    │                       triggered by 4 real, named events (order
    │                       shipped/delivered, return status, admin
    │                       ticket reply, admin supplier-message reply)
    ├── promotions/          The general promotions engine's shared core
    │                       (migration 020) -- referral tracking, promo
    │                       code validation/discount calculation, reused
    │                       by both the referrals and promo-codes modules
    ├── referrals/           Real per-buyer referral code + stats
    │                       (migration 020)
    ├── promo-codes/         Real admin-created campaign codes + real-
    │                       time checkout validation (migration 020)
    ├── storage/             Generic real S3-compatible cloud storage
    │                       client (new) -- works with AWS S3, Cloudflare
    │                       R2, or DigitalOcean Spaces via env vars alone
    ├── email/               Generic real SMTP email client + branded
    │                       templates (new) -- works with Resend,
    │                       SendGrid, Mailgun, or AWS SES via env vars alone
    ├── admin-users/         Real, owner-only admin account + per-page
    │                       permission management (new, migration 022)
    ├── payment/            Stripe, Amazon Payment Services, PayPal, and
    │                       Google Pay (routed through Stripe) — BUY-040–044
```

## Next steps to make this real

1. Wire a real SMTP provider (see the "Real password reset email
   delivery" section) so password reset actually delivers a styled
   email instead of falling back to logging the link to the server
   console, and add email verification on signup.
2. Get real test-mode credentials and run one live transaction against
   each payment gateway (Stripe, APS, PayPal) — none have been network-
   tested yet, see each provider file's header comment for details. This
   is the single biggest remaining unverified piece of the whole backend.
3. Add real tests under `test/` (the `npm test` script expects them there)
   — most real testing so far lives in the admin-dashboard and
   supplier-portal apps' `*.integration.test.js` files, run against this
   API from outside, not inside this package itself.
4. Add commission/payout records once the commission-rate business
   decision is made (Charter Section 1) — this is the one remaining
   "not yet covered" item in `db/README.md`'s schema section; returns/
   disputes and support tickets are both built now.
5. Move from the local dev Postgres instance to a managed hosted database
   for staging/production (RDS, Cloud SQL, Supabase, Neon, Railway, etc.).
6. Get the mobile app actually compiled on a real Flutter SDK — this
   sandbox's network allowlist blocks both the Dart SDK/engine binaries
   (`storage.googleapis.com`) and the package registry (`pub.dev`),
   confirmed directly via the egress proxy's own error messages, not an
   assumption. Every mobile change so far has only been syntax-balance-
   checked, never built.
