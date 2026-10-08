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

## Real supplier payout method (migration 034)

**Confirmed scope**: simple, universal fields only — bank name,
account number, account holder name — no country-specific fields
(IBAN, routing number, etc.) for now. One real row per supplier — a
PUT always replaces whatever was there before, rather than keeping a
history (a real payout already records its own amount and date
permanently; this was never going to double as a bank-details audit
log).

**A real, honest gap this closes**: `POST /payouts` now requires a
real payout method to exist first, checked before the real payout
transaction even opens — recording a payout with genuinely nowhere for
the money to go was a real, honest gap. `GET/PUT
/supplier/me/payout-method` for a supplier to view/set their own;
`GET /supplier/:id/payout-method` for an admin, needed when recording
a payout so they can actually see (or confirm the real absence of)
where the money is supposed to go.

**A significant, real blast radius**: 2 existing test files
(`payouts.integration.test.js`, `transactionalEmails.integration.test.js`)
recorded payouts without ever setting a payout method first — both
updated with a real `beforeAll` step ensuring the test supplier has one
before any payout-recording test runs.

**A real, honest gap was ALSO found in the supplier portal while
building this**: its existing Finance page already had a "Payout
account" card — but it was 100% fake, hardcoded placeholder text
("China Construction Bank •••• 8842," a made-up account holder name),
never connected to anything real. Replaced with a real, editable form.

**Tested end-to-end** — see `apps/admin-dashboard/src/payoutMethod.integration.test.js`
(5 tests, REAL backend): a supplier with no real payout method on file
gets a genuine `null`, not an error; setting one requires every real
field; a real, complete payout method saves and can be fetched back
correctly, and a real update replaces it; an admin can view a real
payout method but a non-admin cannot view another supplier's;
recording a payout is rejected when the supplier has no real payout
method on file, with a real, clear message.

**Supplier portal**: the Finance page's payout-method card now fetches
and saves real data — showing the real saved details with an Edit
action when one exists, or going straight to a real editable form when
none does yet. 3 new component tests. **A real mistake of my own was
found and fixed while building this**: the Chinese-language branch of
this new form was accidentally written in Arabic instead — caught by
directly reviewing the diff, not by any automated check, since a
component test asserting on the wrong-but-still-present text wouldn't
have caught a language mix-up on its own.

**Admin dashboard**: the Payouts page gained a "Payout method" column,
showing the real bank details or a clear "No payout method on file"
warning; the "Record payout" button now disables when a supplier has
none, matching the backend's own hard requirement so an admin sees the
problem immediately rather than getting a failed request. 2 new tests.
**A real test-writing mistake was found and fixed**: 3 pre-existing
tests broke the moment a real payout method's account holder name
happened to be the exact same text as the supplier's own name shown
elsewhere in the same table (`getByText`, singular, now correctly
matched two real elements) — fixed by asserting on the count instead of
a single element, the same real pattern already used elsewhere in this
project for exactly this kind of accidental text collision.

## Real verified-purchase badge on reviews (migration 035)

**A real, honest gap was found first**: the existing "require verified
purchase to review" toggle (migration 025) only ever used
`hasVerifiedPurchase()` as a real gate at submission time — whether
that specific review came from a real verified purchase was never
actually stored anywhere. With the toggle off, no review ever showed
whether its author had genuinely bought the product, even when they
had; even with the toggle on, the real, already-computed answer was
thrown away right after the gate check, not persisted for display.

**Real, deliberate design**: `is_verified_purchase` is computed and
stored ONCE, at the moment a review is submitted (a real snapshot of
that moment) — not re-computed live on every page view. A buyer's
later return or refund shouldn't retroactively change what their
review's badge said at the time, matching how `order_addresses`
(migration 030) and other snapshot-style data in this project already
work. Re-submitting an existing review (a real edit, sent back to
`'pending'`) re-checks and re-stores the status fresh, so a buyer who
reviews before delivery and edits afterward gets the real, updated
badge.

**Tested end-to-end** — see `apps/admin-dashboard/src/verifiedPurchaseReview.integration.test.js`
(3 tests, REAL backend, using the full real hub delivery workflow): a
review from a buyer with no real purchase is stored as `false`; a
review from a buyer with a genuinely delivered order is stored as
`true`, correctly shown in the moderate response and the real public
endpoint; a real, later edit of the same review re-checks and
re-stores the real status.

**Shown across all three buyer-facing surfaces**: the admin dashboard's
Reviews page, the mobile app's reviews section, and the web
storefront's product page all show a real "✓ Verified Purchase" badge
next to a review when it applies.

## Real audit log of admin actions (migration 036)

**Confirmed scope**: a genuinely useful, practical subset of sensitive,
state-changing admin actions — not literally every one of the 63 real
admin-only endpoints in this project (most are simple reads with
nothing real to audit). Logged: supplier verification decisions,
review moderation and flag dismissal, payout recording, promo code
creation, admin account creation/permission changes/removal, category
commission changes, return window changes, the "require verified
purchase" toggle, and FX rate/mode changes — the real actions with
real financial, trust, or access-control consequences.

**`services/api/src/modules/audit/helpers.js`** — a single, shared
`logAdminAction()` helper, called from each instrumented endpoint.
Real, best-effort, fire-and-forget — a genuine logging failure should
never break the real underlying admin action itself (a payout should
still be recorded even if, somehow, writing its own audit row fails).
`details` is a real JSONB blob rather than a fixed set of columns —
different real actions naturally carry different real context (a
payout has an amount, a permission change has a page list), and
forcing them into one rigid shape would either lose real detail or
need a wide table of mostly-null columns.

**`GET /admin/audit-log`** — real, owner-only (reuses the existing
`requireOwner` middleware, the same real restriction already used for
admin account management), optionally filtered by `?action=...`,
capped at a real, reasonable default of 200 entries.

**A real bug was found and fixed while testing this**: `promo_codes`
has no real `id` column at all — the code itself is the natural
primary key. The first attempt at logging a promo code's creation
tried to log `rows[0].id`, which was genuinely `undefined`, silently
becoming a real `null` target. Fixed to log the real `code` string
instead, confirmed by an actual test assertion on the target value, not
just that *some* row got logged.

**Tested end-to-end** — see `apps/admin-dashboard/src/auditLog.integration.test.js`
(5 tests, REAL backend): a real promo code creation is logged with the
real code as its target; a real category commission change is logged
with the real new value; a real review moderation action is logged
with the real product ID; only the real owner account can view the
audit log, not a regular admin; a non-admin (buyer) cannot view it at
all.

**Admin dashboard**: a new "Audit log" card on the Settings page,
visible only to the owner account, matching the same restriction
already used for the "Team & permissions" section right above it.

## Real stock decrementing, oversell prevention, and low-stock alerts (migration 037)

**A real, significant gap was found first**, raised directly by the
person before building the originally-requested low-stock alert
feature: `stock_quantity` was never actually decremented anywhere in
this whole project — a real order could be placed indefinitely without
ever reducing what a supplier's real available stock showed, and
nothing prevented a real order from genuinely overselling past it. A
low-stock alert is meaningless without real stock tracking underneath
it, so this migration fixes that first, then builds the originally-
requested alert on top of it.

**`POST /order`** now decrements stock atomically and self-checks
in the same real SQL statement:
```sql
UPDATE products SET stock_quantity = stock_quantity - $1
WHERE id = $2 AND stock_quantity >= $1
RETURNING stock_quantity, low_stock_threshold, name, supplier_id
```
This closes the real race-condition window a separate check-then-
update would leave open between two concurrent real orders for the
last few units — if the real row count comes back empty, there wasn't
enough stock, and the whole real order is rejected with a clear
message (`"Only N left in stock for X"`), not partially fulfilled.

**Low-stock alerts**: a real, supplier-configurable threshold per
product (`low_stock_threshold`, default 5) — a supplier selling a
slow-moving, expensive part may want a real alert at 2 units left; one
selling a fast-moving, cheap one may want it at 20. Notifies exactly
once, right when crossing the threshold (previously above it, now at
or below) — never re-notifies on every subsequent real order once
already low, which would just be noise. Set via the existing `PATCH
/supplier/me/products/:id` endpoint (now also accepting
`lowStockThreshold` alongside `price`/`stockQuantity`).

**A real bug was found and fixed while testing this**: the
`notifications` table's own CHECK constraint (migration 019) only ever
allowed a fixed, specific set of real notification types —
`'low_stock'` wasn't among them, so the real notification attempt
genuinely failed with a real constraint violation the first time this
was tested end-to-end, not just assumed to work. Fixed by widening the
real constraint to include it.

**A second, real regression was found and fixed** in an *existing*
test (`pricing.integration.test.js`): it created test products without
ever specifying stock, which — correctly, under the new real
enforcement — defaults to 0 and is genuinely unorderable. Fixed by
giving that test's products a real stock quantity to work with, rather
than loosening the new real enforcement to accommodate it.

**A separate, standalone real gap was also found and fixed**: the
supplier portal already imported `updateProduct()` from its own API
client, but never actually called it anywhere — there was genuinely no
way to edit an existing real product's price or stock at all after
creation, only at initial submission. Built a real "Edit" action and
modal on the products table (price, stock, and the new low-stock
threshold), which is also where the threshold above is actually set
from the supplier's side.

**Tested end-to-end** — see `apps/admin-dashboard/src/lowStockAlerts.integration.test.js`
(5 tests, REAL backend): placing a real order genuinely decrements
stock by the ordered quantity; a real order that would oversell past
available stock is rejected, and stock is left completely unchanged; a
real low-stock notification fires exactly once, right when crossing
the real threshold; a supplier can configure their own real threshold
per product; a negative threshold is rejected.

## Real price-drop alerts on wishlist items (migration 038)

**Confirmed design**: prices in this project are computed live (see
`services/api/src/modules/pricing/engine.js`), never stored — so
detecting a real "drop" needs a real, periodically re-checked snapshot
to compare against, not a live-vs-live comparison with nothing to
compare to. `products.last_known_buyer_price_usd` is that real
snapshot — deliberately nullable: `NULL` means this product has never
been checked yet, so the first real scheduled check for it only
RECORDS a real baseline rather than notifying anyone.

**`services/api/src/modules/priceDropAlerts/check.js`** — a real,
best-effort sweep across every real currently-wishlisted product
(there's no real reason to compute prices for products nobody has
expressed any real interest in). Runs automatically every real 6
hours (`startScheduledPriceDropCheck()`, same `setInterval` pattern as
the FX rate refresh, called once at real server startup), and can also
be triggered on demand via **`POST /admin/price-drop-alerts/check`**
(admin-only) — genuinely useful for an admin who doesn't want to wait
for the next scheduled tick, and for automated testing.

Notifies every real buyer with that product wishlisted exactly once
per genuine drop (a real, deliberate 0.5-cent epsilon absorbs
floating-point noise between two runs with identical underlying
inputs — only a real, meaningful drop counts). The real snapshot is
always updated after each check regardless of outcome — a real,
sliding comparison window against the most recently checked price, not
a fixed original price compared against forever.

**Tested end-to-end** — see `apps/admin-dashboard/src/priceDropAlerts.integration.test.js`
(5 tests, REAL backend): the first real check on a product only
records a real baseline, with no notification; a real price drop
notifies every real buyer with that product wishlisted, with the
correct before/after prices; a buyer who does NOT have the product
wishlisted is never notified of its price drop; a real price increase
(or no change) never fires a false drop notification; a non-admin
cannot trigger a manual check.

**A REAL, SIGNIFICANT FINDING while building and testing this**:
running the full test suite surfaced that `p1` and `p4` — the two
products nearly every real test file in this whole project reuses as
a shared fixture for placing real orders — had their real stock
genuinely depleted to 0 by the accumulated real test runs across this
whole project's history, now that migration 037 made stock genuinely
real. This caused a real, widespread wave of ~60 unrelated test
failures the moment stock became enforced, since none of those tests
had ever needed to think about running out. Fixed at both levels: the
real running database was replenished directly, and `db/seed.js` now
seeds both with a real, deliberately large stock quantity (100,000) —
not pretending they're some hidden unlimited special case in the
actual product logic, just large enough that ordinary real test usage
won't realistically exhaust it. See `db/seed.js`'s own comment for the
full real reasoning.

## Real saved searches with notifications (migration 039)

**Confirmed scope**: available in both the mobile app and the web
storefront — which meant building real login/signup for the
storefront too, since it had none before this (a real, separate,
confirmed decision, not scope creep — saved searches genuinely cannot
work for a visitor with no real account).

**A real, deliberate design choice**: `last_seen_product_ids`
compares the real, current full match SET against the real,
previously-seen set, rather than a timestamp comparison. A product can
start matching a saved search for reasons that have nothing to do
with when it was created (getting approved days after submission, a
translation completing, its category changing) — this catches every
one of those, not just "created after last check".

**`buildProductMatchQuery()`** (extracted from `GET /catalog/products`
into a shared, exported function) — both the real storefront/mobile
search endpoint and this real saved-search sweep run the exact same
real matching rules, rather than two versions that could quietly
drift apart over time.

Same real scheduling pattern as price-drop alerts: runs automatically
every real 6 hours, plus an on-demand **`POST /admin/saved-searches/check`**
(admin-only) for testing and for an admin who doesn't want to wait.

**A real bug was already found and fixed here** (from a prior pass):
whether a saved search's check was its genuine first-ever check must
be judged from `last_checked_at` being real-ly `NULL`, not from
`previousIds.size > 0` — a saved search can legitimately have zero
real matches on its first check, and the old, wrong condition would
have silently suppressed every future real notification for it
forever, since the previously-seen set would stay empty check after
check until a match finally showed up — at which point it would still
look exactly like "the first check" and get skipped again.

**Tested end-to-end** — see `apps/admin-dashboard/src/savedSearches.integration.test.js`
(5 tests, REAL backend): the first real check only records a real
baseline, with no notification, even with zero matches; a real,
genuinely new match after the baseline correctly notifies (the exact
scenario the bug above would have broken); a real, subsequent check
with no further new matches does not re-notify; a buyer can list and
delete their own real saved searches, and cannot delete another
buyer's (404, not 403 — the same "don't confirm it exists" pattern
used elsewhere); a non-admin cannot trigger a manual check.

**Web storefront**: new, real, minimal login/signup
(`components/AuthProvider.tsx`) — confirmed scope: just enough to
unblock saved searches, backed by the same real accounts every other
part of this project uses. Order history and saved-address checkout
remain a real, separate, confirmed next pass. A real "Save this
search" action on the search page, and a real `/saved-searches`
management page.

**Mobile app**: a real "Save this search" action in the search
screen's app bar (only shown once real results have loaded, and only
to a logged-in buyer), and a new Saved Searches screen reachable from
Account.

## Real weekly email digest for suppliers (migration 040)

**Confirmed scope**: weekly frequency, summarizing new orders, new
reviews, and new messages since the last real digest (or since the
supplier account was created, if none has been sent yet).
`last_digest_sent_at` lives on `suppliers` (not `users`), matching the
same real distinction already made elsewhere in this project — a
digest is about the supplier's own business activity, not the login
account itself.

**A real, deliberate design difference from price-drop/saved-search
alerts**: this digest sends even when there's genuinely nothing new to
report — a supplier with a quiet week should still hear from the
platform on a real, predictable cadence, not go silent and wonder if
something's broken.

**`services/api/src/modules/supplierDigest/send.js`** — real, once-a-
day check (`startScheduledSupplierDigest()`, called once at real
server startup) for suppliers genuinely due (never sent, or sent 7+
real days ago); only those get a real digest that tick, not every
supplier every time. Also triggerable on demand via **`POST
/admin/supplier-digest/check`** (admin-only), for testing and for an
admin who doesn't want to wait.

**Tested end-to-end**: `gatherDigestData()`'s real SQL was verified
directly (not just assumed correct) — a real, wide date range against
the heavily-used `s1` test fixture returned real, large counts
(matching its actual accumulated test history); a real, narrower
window returned a real, smaller number, confirming the date filter
genuinely narrows results; a real, deliberately future date returned
all real zeros, confirming the filter isn't silently ignoring the
date parameter. See `apps/admin-dashboard/src/supplierDigest.integration.test.js`
(3 tests, REAL backend) for the endpoint-level tests: triggering the
sweep sends due digests and updates `last_digest_sent_at` so an
immediate re-run finds nobody newly due; a non-admin cannot trigger a
manual check; a real new order placed for a supplier is correctly
reflected once their digest becomes due again (and a real, immediate
re-check confirms one new order alone doesn't force a week to pass).

## Real scheduled (future-start) promo codes (migration 041)

**A real, honest finding first**: auto-expiring promo codes already
existed and already worked correctly end-to-end before this pass —
`expires_at` was already checked in `validatePromoCode()`, already
settable from the admin dashboard's own creation form, already shown
in the list. Confirmed directly by creating a real, already-expired
code and validating it (correctly rejected: "This code has expired."),
not assumed to already work. The genuinely missing half of "scheduled/
auto-expiring" was the "scheduled" part: no way to create a real code
today that only becomes active at a real future date, for a planned
upcoming promotion.

**`promo_codes.starts_at`** — nullable, matching `expires_at`'s own
real pattern (`NULL` means active immediately, same as `NULL`
`expires_at` meaning "never expires"). Checked in
`validatePromoCode()` alongside the existing expiry check. A real,
sensible validation on both create and update: `startsAt` must be
before `expiresAt` if both are set, otherwise the code would be
genuinely impossible to ever actually use.

**Admin dashboard**: the promo code creation form now has both
"Starts" and "Expires" date fields (previously only "Expires"
existed), and the list shows a real, distinct "Scheduled" badge for
any code whose start date hasn't arrived yet.

**Tested end-to-end** — see `apps/admin-dashboard/src/scheduledPromoCodes.integration.test.js`
(4 tests, REAL backend): a real code scheduled for a real future start
date is rejected as not active yet; a real code whose scheduled start
date has already passed is genuinely usable; a real code with a
scheduled start after its own expiry is rejected as an impossible
range; a real, already-existing code can have a scheduled start added
via update, and takes effect immediately.

## Real supplier analytics (chosen from a list of 10 real options)

**Confirmed scope**: revenue over time, order volume over time,
top-selling products, order status breakdown, low-stock products at a
glance, and payout summary — shown in both the supplier portal (a
supplier's own data, forced to their own account) and the admin
dashboard (an admin picks any one specific real supplier to view, not
a platform-wide aggregate).

**A real, honest finding first**: while looking for a hook to build
the next planned admin-tooling item ("flagged shipments" workload
view), it turned out to already be fully built and working from an
earlier session — a complete `GET /hub/flagged` endpoint, a full admin
dashboard page, and a passing test file. Confirmed by actually running
that existing test file, not just reading the code — all 5 tests
passed. No new work was needed there.

**`services/api/src/modules/supplierAnalytics/queries.js`** — every
function takes a real `supplierId`, shared by both real callers.
Payout summary reuses the exact same real eligible-sub-orders CTE the
Payouts page's own "Amount owed" figure already uses (exported from
`services/api/src/modules/payouts/routes.js` for this reason), rather
than a second, potentially-drifting reimplementation. Low-stock
products reuse the exact same real threshold comparison the low-stock
alert itself checks (migration 037).

**`GET /supplier/me/overview`** (existing endpoint) now also returns a
real `analytics` object alongside everything it already returned —
none of the existing fields were removed or changed, to avoid
disrupting any real existing consumer. **`GET /supplier/:id/analytics`**
(new, admin-only) returns the same real shape for any supplier an
admin picks.

**Tested end-to-end** — see `apps/admin-dashboard/src/supplierAnalytics.integration.test.js`
(5 tests, REAL backend): a supplier sees their own real analytics, all
shaped correctly; an admin viewing a specific real supplier's
analytics matches that supplier's own view of their own data exactly;
a nonexistent supplier ID returns a real 404, not an empty object; a
supplier cannot view another supplier's analytics via the admin-only
endpoint; low-stock products genuinely reflect products at or below
their own real threshold, verified by cross-checking against the
real, full product list rather than trusting the count alone.

## Real hub workload/capacity dashboard (migration 042)

**Confirmed scope**: both a real, admin-configurable capacity per hub
AND real, current workload counts — hubs had no capacity concept at
all before this. `hubs.daily_capacity` is a real, deliberately simple
single number (max shipments a hub can process per day) rather than a
more elaborate staffing/scheduling model — a real, useful signal for
"is this hub overloaded" without pretending to model actual staffing
constraints this project has no other data for. Defaults to 50 on a
new hub, editable per-hub afterward via a new `PATCH /hub/locations/:id`.

**`GET /hub/workload`** (admin-only) — "in-hub workload" is
deliberately defined as every real stage BEFORE `shipped_to_buyer`
(`awaiting_receipt`, `received`, `opened`, `inspected`, `packed`) plus
`flagged`. Once a real shipment ships to the buyer, it has physically
left the hub's premises and is no longer really part of its active
workload, even though the real database row isn't deleted or moved.

**Tested end-to-end** — see `apps/admin-dashboard/src/hubWorkload.integration.test.js`
(5 tests, REAL backend): a real new hub is created with a sensible
default capacity, and workload starts at zero; a real, explicit
capacity can be set on creation and updated afterward; a negative or
zero capacity is rejected on both create and update; a non-admin
cannot view workload or update hub capacity; workload genuinely
excludes shipments already shipped to the buyer or delivered
(confirmed by cross-checking the total against the sum of its own
stage breakdown).

**Admin dashboard**: a new workload/capacity section at the top of the
existing Inspection Hubs page, with a progress bar per hub and an
inline "Edit capacity" control.

**Two real bugs were found and fixed while running the full
regression suite**: an existing mocked test for this same page didn't
know about the new `/hub/workload` endpoint call, receiving the wrong
data shape (an empty object where a real array was expected) and
failing when the component tried to map over it — fixed by adding a
real mock handler. A second, related issue: the hub's name and region
now genuinely appear twice on the page (once in the new workload
section, once in the existing list) — the same real "text now matches
twice" pattern already fixed once before elsewhere in this project —
fixed by asserting on "at least one match" instead of exactly one.

## Flagging a shipment now auto-opens a real, linked return case

**A real gap closed, previously flagged in `apps/hub-portal/README.md`'s
own "next steps" as not yet wired**: a hub staff member flagging a
quality issue during inspection previously only made the shipment
visible to admin via `GET /hub/flagged` — a real dispute case had to be
opened manually and separately, with no automatic link between the two.

**`POST /hub/me/shipments/:id/events`** with `step: 'flagged'` now
opens a real `return_cases` row in the SAME transaction as the flag
itself (atomic — either both happen, or neither does), resolving the
real buyer (or guest email) via the sub-order → order chain, with an
initial `admin`-authored message quoting the hub staff's own flag note.
The buyer sees this immediately via their own `GET /returns/my-cases` —
same real return-case system as any buyer-initiated request.

**No new migration or schema link needed**: `GET /hub/flagged` now also
returns `returnCaseId`, found by joining on `sub_order_id` rather than a
stored foreign key — a sub-order's `hub_shipment` is unique (migration
011), and a flag always creates exactly one case for it, so the most
recent matching case genuinely is the one this flag created. A flag
from before this feature existed correctly returns `returnCaseId: null`
— an honest gap for old data, not a false positive.

**Verified end-to-end against the real running backend**: placed a real
order, routed it through a real hub, flagged the shipment with a real
note and photo, confirmed `GET /hub/flagged` returned a real
`RC-`-prefixed case ID, confirmed fetching that case as admin showed the
correct order/sub-order/status and an admin-authored message quoting
the real flag note, and confirmed the same buyer's own
`GET /returns/my-cases` genuinely lists it too — not a
self-consistent mock, real shared data across three different views
(hub, admin, buyer).

## Real hub performance metrics — average time per stage (second item in the hub operations group)

**Confirmed design**: average time between real, consecutive stage
transitions, computed via a real SQL window function (`LAG`) comparing
each real event's timestamp to the one immediately before it, for the
SAME real shipment — no new schema needed, every real timestamp
already existed on `hub_shipment_events` (migration 011).

`flagged` events are deliberately excluded from this ordering — a flag
can happen at any point and doesn't represent a normal, linear
processing step, so including it would distort what "average time to
move from X to Y" actually means. A flagged shipment's other, real
linear events still count normally.

**`GET /hub/performance`** (admin-only) returns, for every real hub,
the average seconds (and real sample count) for each of the 4 real
linear transitions: received→opened, opened→inspected,
inspected→packed, packed→shipped-to-buyer. A hub with no real activity
yet returns `null` for each, not a fabricated zero.

**A real, honest verification finding**: this project's shared dev
database has accumulated so much real, rapid, scripted test activity
that most existing samples show essentially instant transitions
(milliseconds apart) — so the real aggregate average across hundreds
of them can genuinely round to 0 even when the underlying calculation
is completely correct. Confirmed this wasn't a bug by checking a
single real shipment's raw event timestamps directly (a real 3.03s and
4.02s gap, matching two deliberate real delays introduced specifically
to test this) — the math was right all along, just diluted by an
overwhelming volume of near-instant automated test data.

**Tested end-to-end** — see `apps/admin-dashboard/src/hubPerformance.integration.test.js`
(3 tests, REAL backend): average time between real stage transitions
is genuinely computed from real timestamps (verified by checking the
real sample count increased by exactly one after a real, deliberately
delayed transition, since the aggregate average itself is too diluted
by pre-existing samples to assert on directly); a hub with no real
shipment activity shows null stage times, not zero or a fabricated
number; a non-admin cannot view performance metrics.

**Admin dashboard**: a new table on the Inspection Hubs page, right
below the workload/capacity section, showing each hub's average time
per stage transition with its real sample count.

## Real cache headers on uploaded images

**A real gap found while scoping image-caching work in the mobile app**:
`app.use('/uploads', express.static(...))` had no cache headers at all —
every app loading a product/review/return/hub-evidence photo
(mobile, admin dashboard, supplier portal, hub portal, web storefront)
relied on a conditional GET (304) on every repeat view rather than
skipping the network round-trip entirely.

**Fixed with `maxAge: '365d', immutable: true`** — safe to cache this
aggressively because every uploaded filename is a fresh
`crypto.randomBytes(16)` hex string generated per upload (see
`modules/uploads/routes.js`), never reused: a given URL's content can
never change, only a brand-new URL is created for a new photo. This is
on top of, not instead of, the mobile app's own on-device
`CachedNetworkImage` cache (see `apps/mobile/README.md`'s "Real image
caching" section) — that one avoids the request reaching the network
at all; this one makes any request that does reach the network as
cheap as possible for every OTHER app that has no client-side cache of
its own.

**Verified against the real running backend**: confirmed a real
uploaded file now returns `Cache-Control: public, max-age=31536000,
immutable`, and confirmed a nonexistent file still correctly 404s
(unaffected). Full regression pass: supplier-portal (74/74),
admin-dashboard (11/11 spot-checked, hub + returns suites),
hub-portal (4/4) — all still passing.

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

## Brand/Model/Generation(Year) filter for search (added to GET /catalog/products)

**A real gap found while scoping this**: `GET /catalog/products` already
had a `vehicleId` filter — but it joins `product_fitment`, a table
**nothing in this codebase ever writes to** (confirmed by grep, not
assumed). Every real product's fitment claim lives only in
`product_fitment_entries`, the structured Brand→Model→Generation cascade
a supplier actually submits against (migration 010). So `vehicleId` has
never matched a single real product — and the buyer-facing My Garage
feature, which saves a vehicle from the OTHER (flat, unpopulated-for-
matching) `vehicles` table, has the same dead-end problem. That's a
separate, existing bug being tracked separately, not fixed in this pass.

**`GET /catalog/products?generationId=gen_bmw_1_series_f20`** (new) —
real filter via `EXISTS` against `product_fitment_entries` (not a
`JOIN`, same reasoning as the search clause above: one product can have
multiple fitment entries, and a `JOIN` would duplicate result rows).
Optionally combine with **`&year=2018`** to narrow to a specific year
within that generation's range — a generation spans a real year range
(e.g. F20 is 2015–2019), and a supplier's fitment entry records the
specific year(s) they actually confirmed, not just "somewhere in this
generation." Composes correctly with `category`, `part`, `search`, and
`sort`.

**Mobile**: `lib/features/search/vehicle_filter_sheet.dart` (new) — a
real Brand → Model → Generation → Year picker, reusing the same
`GET /fitment/brands` → `/brands/:id/models` → `/models/:id/generations`
endpoints the supplier portal already uses (deliberately not the flat
`GET /fitment/makes`/`/vehicles` pair My Garage uses, for the reason
above). The year step is skipped automatically for a single-year
generation, and offers "Any year in this generation" alongside specific
years otherwise. Selecting a vehicle now also works as a standalone
search with no text typed at all — "show me everything that fits my
F20" — which required loosening `search_screen.dart`'s prior behavior
of refusing to search at all on empty text.

**Verified end-to-end against the real running backend**: fetched real
seeded brands/models/generations, confirmed `generationId` alone
narrowed the full 29-product catalog down to the 27 real products
actually fitted to `gen_bmw_1_series_f20`, confirmed adding `year=2018`
narrowed further to 18, confirmed a year with no real matching fitment
entries correctly returns zero (not a false positive), and confirmed
`generationId` composes cleanly with `sort=newest` without error.

## My Garage rebuilt on the real, populated fitment system (migration 044)

**A real bug, found while scoping the search filter above and fixed
now**: `user_saved_vehicles` (migration 008) saved a buyer's vehicle
against the flat `vehicles` reference table — but nothing in this
codebase ever writes a row into `product_fitment`, the join table that
system would need to actually match real products. My Garage's own
"shop for my vehicle" promise never held. Also silently broken by the
same root cause: the mobile app's home-feed "My car" filter, which
called this same dead `vehicleId` path.

**New `user_saved_generations` table** (`buyer_id, generation_id, year`
composite primary key) against the real, populated Brand→Model→
Generation cascade — same system the search filter above uses.
`GET/POST/DELETE /garage/me*` rewritten accordingly; `POST` validates
the saved year genuinely falls within that generation's real range.
Old `user_saved_vehicles` left in place, untouched, rather than dropped
— this project's non-destructive migration philosophy, in case any
real historical data ever needs it.

**Mobile**: `add_vehicle_screen.dart` (built on the old flat system) is
deleted; "Add a vehicle" now reuses the search filter's own
`VehicleFilterSheet` directly. `home_screen.dart`'s "My car" filter now
passes `generationId`/`year` instead of the dead `vehicleId` — the
actual fix for the silent bug described above.

**Verified end-to-end against the real running backend**: saved a real
generation+year, confirmed it appears with correct real brand/model/
generation fields, confirmed that SAME generation+year genuinely
narrows the real catalog to real matching products (not zero, not
everything — the actual loop this bug broke), confirmed an
out-of-range year is rejected, confirmed removing one saved year
doesn't affect a different saved year for the same generation, and
confirmed cross-buyer isolation and idempotent save/delete still hold
under the new schema. `garage.integration.test.js`: 13/13 passing
(rewritten from the old vehicleId-based version).

## Real stock validation on the cart

**A real, confirmed gap, not a data-integrity risk**: the cart never
checked `stock_quantity` at all — a buyer could cart 500 units of
something with 3 in stock with zero feedback until checkout. Checked
order placement FIRST before assuming this needed fixing: it already
has a real, atomic `stock_quantity >= $1` guard
(`services/api/src/modules/order/routes.js`), so real overselling was
never actually possible — this is a genuine UX gap, not a correctness
one.

**`GET /cart/:cartId`** now includes each item's real `stockQuantity`.
**`POST`/`PATCH /cart/:cartId/items*`** now reject a request that would
exceed it, with a clear message naming the product and the real
remaining count.

**Honest, deliberate limitation**: stock isn't reserved per-cart
anywhere in this schema — this check reads the same live, shared
number two different buyers could each pass at the same time for the
last unit. Only one of them will actually get it at real order
placement, where the atomic guard lives. This is a real early-warning
for the common case, not a promise of a reservation.

**Mobile**: the cart's +/- stepper now disables "+" right at the real
limit and shows a low-stock hint. Also fixed a real, separate bug found
while building this — the stepper's `onPressed` calls were fire-and-
forget, never awaited or wrapped in a try/catch (the same class of bug
found and fixed in the photo-upload code earlier this session): a real
rejection from this new check would have thrown an exception nothing
ever caught, silently doing nothing with no visible feedback.

**Verified against the real running backend**: added exactly a real
product's stock quantity (succeeded), confirmed one more was rejected
with the real remaining count named, confirmed the same for `PATCH`
(the endpoint the actual quantity stepper calls), and ran the full
existing cart-persistence regression (unaffected, since normal-sized
cart operations stay well under real stock levels).

## Real supplier detail view for admin (new)

**`GET /supplier/:id`** (admin-only) — real profile + real product
listings for one specific supplier. Deliberately scoped to profile +
products; orders/payouts-by-supplier would be a real, separate, larger
addition aggregating across other modules' own tables.

**A real, serious Express routing bug caught and fixed before ever
testing this**: this route was first placed right after the supplier
list endpoint (`GET /`) — a bare `:id` wildcard there would have
silently intercepted every real `GET /supplier/me` request too (both
are single-segment paths under this mount point; Express matches by
registration order, not specificity), breaking every supplier's own
profile fetch. Moved to its correct position, registered after
`GET /me`, where no collision is possible.

**Verified against the real running backend**: confirmed
`GET /supplier/me` still works correctly for a real supplier (the
exact collision this bug would have caused), confirmed the new
endpoint returns a real profile + all 110 real products for a real
supplier, confirmed a non-admin supplier is rejected (403) attempting
to view a different supplier, confirmed a nonexistent id 404s. Full
regression: supplier-portal's own suite (which exercises `GET
/supplier/me` and every `/me/*` route constantly) — 77/77 passing.

## Real bulk price update for suppliers (new)

**`PATCH /supplier/me/products/bulk-price-update`**
`{ productIds, adjustmentType: 'percent'|'flat', adjustmentValue }` — a
real, single SQL `UPDATE`, not a fetch-then-recompute-in-JS loop: each
matched product's own existing price feeds the expression directly,
so a batch with different starting prices is adjusted correctly in
one query. Clamped at a real minimum (`0.01`).

**A real, bug-prone Express route-ordering detail, handled correctly**:
registered BEFORE the existing `PATCH /me/products/:id` — that `:id`
is a wildcard that would otherwise silently swallow the literal string
`bulk-price-update` as if it were a real product id.

**Verified against the real running backend**: applied a real +10%
increase to two products with different starting prices, confirmed
each new price is mathematically correct for its own starting price;
confirmed a flat decrease and the `0.01` minimum clamp on an extreme
negative adjustment; confirmed an invalid `adjustmentType` is
rejected; and confirmed ownership isolation — a supplier bulk-updating
a product genuinely owned by a different real supplier leaves it
completely untouched.

## Real audit log date-range filter (new)

**`GET /admin/audit-log`** now accepts `startDate`/`endDate`, composing
with the existing `action` filter. `endDate` is inclusive of the whole
real day (`created_at < endDate + 1 day`), not just midnight of that
day — an admin picking "today" as the end date means through the end
of today.

**Verified against the real running backend**: created a real promo
code, confirmed a date range covering today includes it, confirmed a
range from 2020 genuinely excludes it, and confirmed the action filter
composes correctly with the date range.

## Real admin global search (new)

**A real, confirmed gap**: the admin dashboard's `TopBar` search box was
100% decorative — a `<span>` with placeholder text, not even a real
`<input>`, confirmed directly by reading the component.

**`GET /admin/search?q=`** (admin-only) — one combined endpoint across
the exact three categories the placeholder text always claimed:
real orders (`id ILIKE`), real suppliers (`name ILIKE`), real support
tickets (`id ILIKE OR subject ILIKE`). Each capped at 5 results — a
type-ahead dropdown, not a search-results page. A query under 2
characters returns empty results rather than running a meaningless
broad scan.

**Verified against the real running backend**: matched a real supplier
by name, matched multiple real orders by ID prefix (correctly capped
at 5), confirmed a too-short query returns empty without erroring, and
confirmed an unauthenticated request is rejected (401).

## Stale scope comment corrected: notifications actually have 9 real trigger points, not 4

**A real, stale documentation gap, found by applying the same "check
the claim against reality" pattern that surfaced the audit log gaps
above.** `notifications/helpers.js` and `notifications/routes.js` both
still said "the 4 real trigger points" (accurate when migration 019
first shipped) — but 5 more real trigger points have been added since,
each with its own migration extending the real `notifications_type`
`CHECK` constraint (020 `referral_reward`, 037 `low_stock`, 038
`price_drop`, 039 `saved_search_match`, 045 `back_in_stock`), without
ever correcting the original "4" comment. No functional bug — the DB
constraint itself was correctly kept up to date every time; this was
purely misleading documentation for anyone reading the code today.

`notifications/helpers.js`'s header comment now lists the real,
current, complete set of all 9 trigger points, confirmed by checking
every actual `createNotification` call site directly, not assumed.

## Real audit coverage for catalog/fitment, product moderation, promo codes, and fee components (new)

**A real, significant gap, found in two passes of checking the audit
log's own stated scope against what it actually covers.** First pass:
product-listing moderation and all vehicle reference-data management
were completely unlogged, despite the audit log claiming "review
moderation" (a different, real system — buyer reviews) was covered.
Second pass: "promo codes" only covered creation, not activating/
deactivating or deleting one; "pricing/settings changes" was missing
fee-component management entirely (create/update/delete/reorder) —
arguably more consequential than the FX rate changes already logged,
since fee components directly determine the platform's real commission
on every sale.

16 new real action types total — see `apps/admin-dashboard/README.md`'s
own section on this for the full list. No migration needed —
`admin_audit_log.action` has no `CHECK` constraint.

**Verified against the real running backend**: created a real brand,
confirmed logged with its real name; created/deleted a real category,
confirmed both logged; approved/rejected a real pending product,
confirmed logged distinctly from review moderation; deactivated a real
promo code, confirmed logged distinctly from creation; created/
updated/deleted a real fee component, confirmed all three logged.

## Real, significant bug fixed: a real transactional email with no timeout could hang the entire API response (5 endpoints)

**Found via an actual person's own real report**: confirming delivery
in the hub portal left the button stuck "Confirming..." forever in
one tab, while the status genuinely updated correctly when checked
from a different tab/session — meaning the real backend work had
already succeeded, but the response itself never reached the client.
Confirmed directly via their own Chrome DevTools Network tab: the
request stayed "Pending" indefinitely, with no console error at all
(nothing ever threw — it just hung).

**Root cause**: `getTransporter()` (`email/client.js`) created its
SMTP transport with **no timeout configured at all** — a slow or
unreachable SMTP server could hang a real email send indefinitely. On
5 different endpoints across the codebase, this email send was
`await`ed **before** the response was sent, even though every one of
them was already correctly documented as "best-effort" and "should
never block the real [action] that already succeeded" — the actual
code just didn't match that stated intent. A hanging email meant a
hanging response, full stop, regardless of how well the action itself
had already succeeded and committed.

**This is very likely the actual root cause of an earlier, separate
report** of web-storefront/mobile checkout appearing slow or stuck,
at the time attributed to a generic "network issue" — `order/routes.js`
had the exact same bug, on the single most commonly hit endpoint in
the whole app.

**Fixed on all 5 real endpoints found** (a full, precise sweep of
every `sendTransactionalEmail` call site in the codebase, not just
the one reported): `hub/routes.js`'s confirm-delivery handler,
`order/routes.js`'s order-placement handler, `supplier/routes.js`'s
mark-as-shipped handler, `payouts/routes.js`'s record-payout handler,
and `webhooks/routes.js`'s carrier-delivery-confirmation handler. In
each request-handler case, the response now happens immediately after
the real database work commits, with every real best-effort follow-up
(notifications, referral checks, confirmation emails) genuinely
running as a fire-and-forget background task afterward — none of them
can ever delay or block the response again. The webhook case (which
processes multiple items in a loop, not a single request/response)
was fixed by making its own per-item email fire-and-forget instead,
so one slow email can't delay processing the rest of that same
webhook payload or its response back to the carrier's own system.

**Also added a real, genuine defense-in-depth fix**: the SMTP
transport itself now has real `connectionTimeout`/`greetingTimeout`/
`socketTimeout` values (10s each) — nothing in this codebase should
ever be able to hang forever waiting on an external network call with
no bound on it, regardless of whether every current and future call
site correctly treats it as fire-and-forget.

**Verified against the real running backend**: timed the order-
placement endpoint and the hub confirm-delivery endpoint directly —
both now respond in ~0.1–0.15 seconds. Full regression: web-storefront
(38/38), hub-portal (16/16), admin-dashboard's payout tests (13/13),
and supplier-portal (82/82), all passing.

## Real bug fixed: a genuinely saved change didn't appear until a full page refresh (browser caching)

**A real bug, reported by an actual person testing My Garage on a real
device**: adding a vehicle genuinely saved (confirmed correct against
the real running backend), but the newly-added vehicle didn't appear
in the app until a full page refresh — as if the save silently failed,
even though it hadn't.

**Root cause**: this whole API had no `Cache-Control` directive at all
on any response, combined with Express's own default `ETag` behavior
(enabled unless explicitly disabled). On a web target specifically, a
browser can serve a stale cached `GET` response for an identical URL
without a fresh network round-trip at all — especially right after a
`POST` to a different endpoint that changed the underlying data. This
is a real, general problem for the whole API (every endpoint returns
data that can change at any time), not something specific to the
garage endpoint alone.

**Fixed globally, not per-route**: `app.set('etag', false)` plus a
real `Cache-Control: no-store` header on every response, applied via
middleware near the very top of the request pipeline.

**Verified against the real running backend**: confirmed the response
headers no longer include an `ETag` and now genuinely include
`Cache-Control: no-store`. Full regression: web-storefront (38/38) and
a targeted admin-dashboard check (17/17), both passing, confirming
this global change didn't break anything relying on prior behavior.

## Real "default vehicle" for My Garage (new, migration 047)

**A real, confirmed gap**: a buyer with more than one saved vehicle had
no way to say which one should drive automatic fitment filtering — the
mobile home feed silently used whichever vehicle happened to be first
in an arbitrary list order. Confirmed by reading `garage/routes.js`
directly, not assumed: the currently-used table is
`user_saved_generations` (migration 044), not `user_saved_vehicles`
(migration 008, already confirmed dead).

A buyer's very first saved vehicle automatically becomes their real
default. New `PATCH /garage/me/:generationId/:year/default` sets a
specific vehicle as default, unsetting any other in a single real
transaction. Deleting the current default auto-promotes a real
remaining vehicle rather than leaving the buyer with none.

**Verified against the real running backend**: confirmed the first
saved vehicle auto-becomes default and a second one doesn't; confirmed
explicitly switching the default correctly unsets the previous one;
confirmed deleting the current default auto-promotes a remaining
vehicle; confirmed a buyer can't set another buyer's vehicle as their
own default. Real integration tests: 18/18 passing (5 new).

## Real bilingual name + photo, required for brands and categories (new, migration 046)

**An explicit, requested requirement**: `POST /fitment/brands` now
requires `name` (English) + `nameAr` + `photoUrl`. `POST /catalog/
categories` now requires `nameAr` (was optional before) + `photoUrl`
(new). DB columns (`vehicle_brands.name_ar`/`photo_url`,
`product_categories.photo_url`) are nullable — existing rows created
before this requirement existed aren't retroactively broken; the
requirement is enforced at the API layer on creation, not a DB
constraint.

`POST /uploads/product-image` now also allows the `admin` role (was
supplier/hub_staff/buyer only) — the actual upload logic (validate
dimensions/type, save, return a URL) is unchanged and identical
regardless of what the photo is evidence of.

**Verified against the real running backend**: confirmed brand/
category creation is rejected when missing the Arabic name or the
photo, and succeeds with all required fields present; confirmed an
admin can upload a real image via the shared endpoint; confirmed
suppliers can still upload their own product photos exactly as before
(adding a role is purely additive).

## Real promo code usage counts (new)

**A real, confirmed gap**: the real `promo_code_redemptions` table
(migration 020) already recorded every real redemption the whole
time — nothing surfaced it. `GET /promo-codes` now returns a real
`usedCount` per code via a `LEFT JOIN` against that table (only
counting a genuine redemption tied to a real placed order, not a mere
validation check).

**A real bug caught and fixed before it shipped**: `PATCH
/promo-codes/:code` would have silently returned `usedCount: 0` for a
code that's genuinely already been used many times, since that
query's own `UPDATE ... RETURNING` has no visibility into the
redemptions table — fixed with a real follow-up count query in the
same handler.

**Verified against the real running backend**: created a real code,
confirmed `usedCount: 0` right after creation, placed 2 real orders
with it, confirmed `usedCount: 2` afterward, and confirmed the
`PATCH` response also reflects the real, accurate count.

## Real back-in-stock alerts (new, migration 045)

**A real, confirmed gap**: nothing notified a buyer when a wishlisted,
out-of-stock product came back. Mirrors migration 038's price-drop
alert pattern (same real `wishlist_items` table, same
`createNotification` + email mechanism) — but deliberately NOT a
periodic sweep like that one needs: stock only ever changes at one
real, controllable point (a supplier's own
`PATCH /supplier/me/products/:id`), so this hooks in directly there
(see `services/api/src/modules/restockAlerts/notify.js`) instead of
polling on a timer.

**Confirmed scope**: only a genuine `0 -> positive` transition counts
— raising stock from 3 to 10 was never actually unavailable to a
buyer, so it must never fire for that case. Captures the real stock
level *before* the update so this can be detected correctly, and never
blocks or fails the real product update itself (best-effort, same as
every other notification trigger in this codebase).

**Verified against the real running backend**: set a real product to
0, wishlisted it as a real new buyer, confirmed zero notifications
beforehand, restocked it, confirmed exactly one real notification with
the correct type/title/body, and confirmed a further raise (already
positive to higher) does NOT create a duplicate.

## Real pagination on GET /catalog/products (new)

**A real, confirmed gap, already flagged in this endpoint's own code
comments**: no pagination at all — growing to 100+ real products this
session alone meant every existing caller (mobile, web-storefront,
admin dashboard) fetched the ENTIRE catalog on every single request.

**Deliberately opt-in and 100% backward compatible**: `page`/`limit`
are new, optional query params. When neither is provided, behavior is
byte-for-byte identical to before — a bare, unbounded array. Only a
caller that explicitly asks for a page gets one.

**Applied as a final slice, not SQL `LIMIT`/`OFFSET`** — deliberately,
since buyer-facing price isn't a raw column (it's computed via the
pricing engine) and the existing price filter/sort already happens in
application code after fetching every matching row. Paginating at the
SQL level would paginate BEFORE that filtering, producing genuinely
wrong pages. The real total count (after filtering, before slicing) is
exposed via an `X-Total-Count` response header rather than changing
the response body's shape, preserving that same backward
compatibility.

**A real bug caught and fixed before it ever shipped**: by default,
the `cors` package hides ALL custom response headers from browser
JavaScript, even though they're genuinely sent over the wire — a
well-known but easy-to-miss gotcha. `X-Total-Count` would have
silently been unreadable via `response.headers.get(...)` in a real
browser, while working perfectly fine in curl or a Node-based test
(neither enforces this browser-only restriction). Fixed by adding
`exposedHeaders: ['X-Total-Count']` to the CORS config.

**Verified against the real running backend**: confirmed unbounded
behavior is completely unchanged with no params (119 real products),
confirmed page 1 and page 2 return genuinely different real products,
confirmed the limit caps at a sane maximum (100) even if a much larger
one is requested, confirmed an invalid/negative page correctly
defaults to page 1, and confirmed the header is both present and
genuinely exposed to browser JS (not just sent over the wire).

## Guest support ticket tracking (real gap closed, same pattern as returns)

**The exact same real gap as returns, closed the exact same way**:
`POST /support/tickets` already supported filing a ticket as a guest
(`guestEmail`), but `GET`/`POST /support/my-tickets/:id*` were
`requireAuth` only — a guest who filed a ticket had no way to ever
check on it again. Mirrors `GET /order/:id` and `GET /returns/my-cases
/:id`'s own established `optionalAuth` + matching-`guestEmail` pattern
exactly.

**Verified against the real running backend**: filed a ticket as a
real guest, confirmed they can fetch it and reply with zero login,
confirmed a genuinely different (wrong) email is rejected rather than
leaking the ticket, and confirmed the existing logged-in buyer flow
(admin-dashboard's `TicketsFlow.test.jsx`) is completely unaffected.

## Guest return tracking (real gap closed)

**A real, confirmed gap**: `POST /returns` already supported filing a
return as a guest (`guestEmail`), but `GET`/`POST /returns/my-cases/:id*`
were `requireAuth` only — a guest who filed a return had no way to
ever check on it again, reply, or see its status. Mirrors `GET
/order/:id`'s own established pattern exactly: `optionalAuth`, with a
logged-in buyer seeing their own case as before, OR a guest supplying
the real `guestEmail` the case was actually filed under as a second
factor beyond just knowing the case ID.

**Deliberately NOT extended to `GET /returns/my-cases` (the list)** —
same reasoning as the order module: there's no natural "list all my
cases" for a guest without a real account, only a real single-case
lookup once they already have the ID (e.g. from their return
confirmation).

**Web storefront**: new `/returns` (real list for a logged-in buyer,
a real case-ID + email lookup form for a guest) and `/returns/[id]`
(real thread, works for both). The last remaining item from this app's
original gap list.

**Verified end-to-end against the real running backend**: filed a
return as a real guest, confirmed they can fetch it and reply with
zero login, confirmed a DIFFERENT (wrong) email is genuinely rejected
rather than leaking the case, and confirmed the existing logged-in
buyer flow is completely unaffected (same test suite, 8/8 still
passing). Web-storefront: 25/25 passing.

## Price range + sort by price for search (added to GET /catalog/products)

**A real architectural wrinkle, not just missing query params**: buyer-
facing price is NOT a raw column — a CNY-priced product's real buyer
price goes through the pricing engine's currency conversion + fee
calculation, computed in application code AFTER the SQL query runs (see
`attachBuyerPrice`). So `minPrice`/`maxPrice`/`sort=price_asc`/
`sort=price_desc` are deliberately applied in JS, on the already-built
DTOs, not as SQL `WHERE`/`ORDER BY` clauses — those would filter/sort on
the wrong number entirely for any CNY-priced product. This endpoint has
no pagination today, so doing this in JS is correct at the catalog's
current scale.

**`GET /catalog/products?minPrice=30&maxPrice=100&sort=price_asc`** —
composes correctly with every other filter on this endpoint
(`category`, `part`, `search`, `generationId`, `year`).

**Verified end-to-end against the real running backend**: confirmed
`sort=price_asc`/`price_desc` genuinely sort the real computed prices
(not the raw column) in the correct order, confirmed `minPrice`/
`maxPrice` narrow to only real products within range, and confirmed all
three compose correctly together with `generationId` in a single request.

## Return case evidence photos (new, migration 043)

**A real, optional addition**: a buyer filing a return could describe
damage/wrong-item in text, but had no way to show it — unlike a product
review, which already supports photos (migration 031). Mirrors that
same "at least one, enforced in application code" pattern's structure,
but genuinely optional here (0 or more) — there's no equivalent hard
business rule forcing a photo on every return the way there is for a
hub inspection step or a supplier's minimum product-photo count.

**`POST /returns`** now accepts an optional `photos: string[]` (URLs
from the same generic `/uploads/product-image` upload endpoint reviews
and hub photos already use). Photos attach to the CASE as a whole, not
to an individual message — filed once, at request time.

**Deliberate isolation, matching this module's own existing design**:
photos are exposed via `GET /returns/my-cases/:id` (buyer) and
`GET /returns/:id` (admin) — but **never** through
`GET /returns/supplier/me/:id`. A supplier seeing the buyer's own
evidence photos directly would be the identical structural leak the two
separate buyer/supplier message-thread tables (migration 007) exist to
prevent.

**Verified end-to-end against the real running backend**: uploaded a
real evidence photo, filed a return referencing it, confirmed it appears
in both the buyer's own case view and the admin's arbitration view,
confirmed a supplier fetching the SAME case via their own endpoint gets
no `photos` field at all (isolation genuinely enforced, not just
undocumented), and confirmed a return filed with no photos returns a
real empty array rather than an error or a missing field.

**A real, honest gap in the FIRST pass of this feature, found by an
actual user testing it live**: the admin dashboard's
`ReturnCaseDetailPage` (`apps/admin-dashboard/src/App.jsx`) was never
updated to render this new `photos` field — the API had it, but no UI
consumed it, so an admin saw a return with attached evidence and no way
to actually see the evidence. Fixed by adding a photo strip to the
existing "Case details" card (same `<img src={API_BASE_URL + url}>`
pattern already used for review/hub photos elsewhere in this file), and
added a real integration test (`returns.integration.test.js`) confirming
the data reaches the admin correctly — though note that test covers the
DATA half only; there's no automated check that the photos actually
render as pixels on screen, since this project's admin-dashboard test
harness is mocked-fetch component renders and real-backend data checks,
not a full browser/E2E tool.

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

## Arabic mode: basket names and translatable errors

Three things the mobile app needed from the backend to be fully usable in Arabic. None of them changes what an English client sees.

- **Basket item names.** Every `/cart/...` endpoint accepts `?lang=ar` and returns each item's approved Arabic name (falling back to the
  default name when a product has none) — the same rule as the catalog's `resolveLanguage`. Previously the basket always returned the English
  name. The mobile app sends the language on every basket call and re-fetches the basket when the language is switched.
- **Stable error codes.** Errors the app should show in its own words carry a machine-readable `code` next to the English `error` text
  (the text is unchanged). Currently:
  - `review_requires_purchase` (`POST /reviews`, 403) — a buyer who hasn't received the product.
  - `insufficient_stock` (`POST` / `PATCH /cart/:id/items`, and `POST /order`, 400) — also carries `available` (units left) and
    `productName` (Arabic when `?lang=ar` is sent and the product has an Arabic name). Replaces matching on the English sentence.
- **`?lang=ar` on `POST /order`** exists only so the stock error above can name the product in Arabic.

**Convention for the next error:** add a `code` (and any numbers it needs) to the backend response, add a string under that same key in the
mobile `app_strings.dart`, and show it with `apiErrorText(context, e)`. An error with no code, or no translation, falls back to the backend's
English message — it is never blank.

**Tested:** `apps/admin-dashboard/src/cartLanguage.integration.test.js` (7, real backend) and the extended
`reviews.integration.test.js`. The stock tests were verified to fail against the previous cart and order routes.

## Supplier finance (`GET /supplier/me/finance`)

Backs the supplier portal's Finance page (which used to show typed-in numbers). Scoped to the logged-in supplier — there is no id in the
URL, so a supplier can never read another's figures; admins and anonymous callers get 403 / 401. Code: `src/modules/supplierFinance/queries.js`.

Returns `{ currencyCode, returnWindowDays, readyToPay, inReturnWindow, totalPaid, lastPayout, commission, payouts }`:

| Field | Meaning |
|---|---|
| `readyToPay` `{amount, orderCount}` | Delivered, return window passed, no return case, not yet paid. Same set and same formula as `/payouts/owed` (and `payoutSummary.amountOwed` in the supplier overview). |
| `inReturnWindow` `{amount, orderCount}` | Delivered and otherwise clean, but still inside the window — becomes payable by itself. |
| `totalPaid` | Lifetime sum of every payout. A separate query, **not** a sum of the capped history, so it stays right past 100 payouts. |
| `payouts[]` | Newest 100 recorded payouts: `amount`, `notes`, `paidAt`, `orderCount`, `sales`, `commission`. |
| `commission` | `minPercent` / `maxPercent` plus the per-category rates for categories this supplier has listings in. |

**Formula (identical to the admin side):** net of an order line = `unit_price × quantity × (1 − category commission % / 100)`.
**Why `commission = sales − amount` is exact:** `POST /payouts` computes a payout's amount on the server from the eligible orders and links them
in `payout_sub_orders`; it is never typed in. So for each payout, sales (what the buyers paid for those orders) minus the payout amount is
exactly the commission taken, even if a category's rate has changed since.

**Currency is USD.** Unit prices are the buyer-facing USD prices and payouts are recorded in USD (`payouts.currency_code` defaults to USD; no
route sets another). Nothing is converted to RMB — that would be an invented number. NOTE this contradicts the supplier-portal README's stated
constraint "settlement currency is RMB"; see that README for the open decision.

**Tested:** `apps/admin-dashboard/src/supplierFinance.integration.test.js` (6, real backend). Because other test files record payouts for the
same supplier at the same time, the tests look a payout up by its own id and check invariants (every payout reconciles; ready-to-pay matches
the admin figure, retried to tolerate a concurrent payout) instead of exact running totals. Verified to fail when the ready / in-window
buckets are swapped.

## Flagged shipments: the two verdicts, and fault cases (migrations 090–091)

**The gap this closes:** a hub staff member flagging a shipment already opened a return case automatically, but the hub *shipment* then stayed
`flagged` forever, whatever the admin decided. A false alarm blocked the order for good (it could never be delivered, so the supplier was never
paid), the Flagged Shipments queue never shrank, and the hub's workload kept counting handled shipments.

An admin now gives every flag one of two **verdicts**:

### 1. No fault (the hub's data was wrong) — `PATCH /hub/flagged/:id/resolve { "resolution": "continue_processing" }`
The shipment goes back to the last real step it completed, so the hub carries on. The linked return case is closed as `rejected` and the buyer
is told (English and Arabic) that no problem was found. Admin only; needs access to the Flagged page. This endpoint accepts **only**
`continue_processing`: a real fault is a fault case. It is refused (400) for a shipment that already has a fault case, and for a flag that is
already resolved. A return case an admin already finalised by hand is left alone (`returnCase.updated: false`).

### 2. Real fault — a **fault case** (`POST /fault-cases`, migration 091)
```
awaiting_supplier --(supplier answers)--> awaiting_admin
awaiting_supplier / awaiting_admin --(admin confirms refund)--> refund_pending
refund_pending --(admin marks refunded)--+
(hub returns or discards the unit) ------+--> completed        (needs BOTH, in either order)
```

| Endpoint | Who | What it does |
|---|---|---|
| `POST /fault-cases` `{ shipmentId, items:[productId], costBearer, notes? }` | admin (Flagged page) | Opens the case for the **ticked items** (whole lines), records who bears the cost (`supplier` or `leap`), moves the buyer's return case to `in_progress`, tells the buyer, and asks the supplier whether they can replace. |
| `POST /fault-cases/:id/confirm-refund` `{ amount? }` | admin | Records a refund. Default amount = **what the buyer actually paid for those items**: their share of `orders.total` (their list value, minus their share of any promo/loyalty discount). The admin may enter less, never more than the order total. Return case → `approved`, buyer told. Allowed before the supplier answers (an override). |
| `POST /fault-cases/:id/mark-refunded` `{ reference }` | admin | The refund was made **manually** in Stripe/PayPal; records the provider's reference (required, so it can be traced). Buyer told. |
| `GET /fault-cases/supplier/me` | supplier | Their own cases, unanswered first. Shows the question, their answer and how it ended, plus **`evidence`** — WHY it was flagged: the hub inspector's `note`, the `damageType` and the `photos` (URLs) from the flag. **Never** the refund amount, who bears the cost, or the platform's private notes. |
| `POST /fault-cases/supplier/me/:id/answer` `{ canReplace, eta?, note? }` | supplier (own cases) | A "yes" needs a date (not in the past). Final: it can't be changed. Another supplier's case is a 404. |
| `POST /hub/me/shipments/:id/events` with `step: "returned_to_supplier"` (tracking number + photo) or `"discarded_at_hub"` (photo) | hub staff | The unit physically leaves the hub. Only for a flagged shipment that has a fault case, once. |

**Rules and why:**
- **A refund is only recorded.** No refund API is integrated (Stripe and PayPal are wired for taking payment only), so the admin refunds manually
  and marks it issued. Nothing is deducted from a supplier's payout: `cost_bearer` is recorded and shown, no more.
- **Completion needs both** the refund issued **and** the unit back from the hub. Completing closes the flag (it leaves the admin queue and the hub
  workload; `resolution = 'fault_refund'`) and the buyer's return case (`completed`).
- **Each step is one database transaction**; notices to buyers and suppliers go out only after the commit, best-effort, and can never undo or
  block a decision. A guest buyer has no account to notify and is skipped.
- **A return case an admin already finalised by hand is left alone** — no status change, no message, no second notification.
- **The hub sees what to send back, never the money:** `faultCase` on `GET /hub/me/shipments/:id` has the items and whether the return is still
  needed — no refund, no cost bearer, no notes. Hub staff also see the outcome of a no-fault verdict, but not the admin's internal note. They get a neutral `platformStage` (`reviewing` / `finalising` / `closed`) so they always know whether anything is left for THEM (only the unit: `needsReturn`) — the stage never mentions money.
- **The two new hub statuses leave the hub's workload** (the unit physically left) and are excluded from the stage-timing metric. The buyer **cannot
  cancel** a part once its unit has been returned/discarded (the refund is handled as a fault case; cancelling too would double-handle it).
- **What the buyer sees:** an order with a return case always displays as `returns` (a return case takes priority over every other status), so
  that is what a flagged order shows. **Buyers are never shown "dispute" at all:** `computeDisplayStatus` still returns `dispute` for an OLD flag from
  before return cases were opened automatically (and for the two new hub statuses), but for a buyer or guest `buyerSafeDisplayStatus` turns it into
  `to_ship` ("still being prepared") in both `GET /order/:id` and `GET /order`. Admin keeps the real value, so its Dispute filter still works.
- Buyer messages and notifications are stored as **one string**, so they carry English first, then Arabic, on separate lines. A stopgap until
  they are keyed and translated per language.
- Audit log: `flagged_shipment_resolved`, `fault_case_created`, `fault_case_refund_confirmed`, `fault_case_refund_issued` (the refund reference is
  recorded).
- `GET /hub/flagged` returns each unresolved flag with its `items`, `damageType`, `hubStatus` and `faultCase`. Hub staff can also tag a flag with an
  optional kind of problem (`damageType`).

**Also tested:** `apps/admin-dashboard/src/buyerStatus.integration.test.js` (2, real backend) — a flagged order shows the buyer `returns`, an OLD flag with no return case shows `to_ship` (never `dispute`), and admin still sees `dispute` and can filter by it. Verified to fail when buyers get `dispute` again.

**Not built yet:** the Flutter hub app's fault screens, supplier reminders, automatic payout deductions, and real Stripe/PayPal refunds. (Replacement orders: see "Replacement orders (migration 095)" below.)

**Tested:** `apps/admin-dashboard/src/faultCases.integration.test.js` (18), `trackingNumbers.integration.test.js` (5) and `flaggedResolution.integration.test.js` (7), real backend. Each test
builds its own hub and hub-staff login (using the Hub staff feature) so workload checks are exact. Verified to fail when completion stops needing
both conditions, when supplier isolation is removed, when the buyer-cancel block is removed, or when the hub workload keeps counting returned units.

## What a supplier may do to an order (forward only, locked at the hub)

Enforced by the **server** (`modules/supplier/orderRules.js`, used by both the order list and `PATCH /supplier/me/orders/:subOrderId`), not just by the portal's buttons:
- **Forward only:** pending → preparing → shipped. An order that is preparing cannot go back to pending; a shipped one cannot go back to preparing or pending (`409`, code `status_cannot_go_back`). Skipping ahead (pending → shipped) is allowed; saying the same status again changes nothing.
- **Locked once the hub has RECEIVED the parcel** (its hub shipment is anything past "awaiting receipt"): the supplier can change **nothing**, neither status nor tracking number (`409`, code `order_locked_at_hub`).
- **Locked when the buyer cancelled the part** (`409`, code `order_cancelled`): a supplier click can no longer bring it back.
- **Until the hub receives the parcel** the supplier can still correct the tracking number (re-sending "shipped" with a new number does **not** notify the buyer a second time).
- **If the hub then flags it and the platform decides, the order itself stays locked.** The supplier's way back is the **fault case** (`POST /fault-cases/supplier/me/:id/answer`: can you replace it, ETA, note), and a replacement is a **new order** that starts again at pending. Re-opening the old order would rewrite its history.
- The supplier can no longer set the status `dispute` (nothing ever reacted to it; disputes come from the hub). An old row in that state may still move forward.
- `GET /supplier/me/orders` now carries `locked`, `lockReason` (`at_hub` / `cancelled` / null), `allowedStatuses` and `canEditTracking` for each order, and the `PATCH` reply carries the same, so the portal shows exactly what the server will accept. The row is locked (`FOR UPDATE`) while checking, so a click cannot slip in between the hub receiving the parcel and the check.
- Tested: `supplierOrderRules.test.js` (4, pure), `supplierOrderRules.integration.test.js` (5, real backend: forward only, tracking fix without a second notification, locked at the hub, the fault case exception, cancelled part / no dispute / another supplier) and the portal's `OrderLockFlow.test.jsx` (5). Verified to fail when the server stops enforcing and when the portal stops disabling.

## One order, several statuses: what each screen shows (and the "stuck dispute" fix)

An order has several statuses on purpose, because they describe different things:
- **Supplier portal "Shipped"**: the supplier's own leg (supplier to hub). It stays "shipped" for ever; it does not change when the hub flags or closes anything.
- **Hub portal**: the hub parcel's own state: received, inspected, packed, shipped to buyer, delivered, flagged, **Closed** (a flag the platform has closed).
- **Admin Orders "Hub status" chip and the "Disputes" tab**: the hub parcel's state, now `closed` for a closed flag. **Before, a flag closed by hand kept the raw status "flagged", so the order stayed in the Disputes tab for ever and showed a red "Flagged" chip while the hub already said "Closed".** The Disputes tab now lists only OPEN flags; a closed one stays under "All".
- **Admin Orders "Status" chip and the order page header**: now the COMPUTED status (`displayStatus`: to ship / shipped / delivered / dispute / returns). It used to read the stored status, which is only ever "to_ship" or "cancelled", so it said "To ship" for orders that were long delivered.
- **`displayStatus` rule:** an order is a **dispute** only while a flag is OPEN and there is no return case; a closed flag counts as **returns** (it ended through the fault path). Any return case still makes it **returns**. Buyers never see "dispute" (it shows as "to ship").
- The admin's order page also receives the parcel's `resolution` and `resolvedAt` (admin only; buyers never get them) so it can show "Closed".
- Tested: `closedFlagOrderStatus.integration.test.js` (3, real backend, including an old-style flag with no return case) and three new screen tests in `OrdersFlow.test.jsx`. Verified to fail with the old rules.

## Tracking timeline in the buyer's language

`GET /order/:id/tracking?lang=ar` returns the hub's own steps ("Received at hub", "Opened for inspection", "Inspection complete", "Repacked for shipping", "Shipped to you", "Delivered (confirmed by hub / carrier)") in **Arabic**; any other value, or none, gives the English text exactly as before. Each hub step now also has **`kind`** (`received`, `opened`, `inspected`, `packed`, `shipped_to_buyer`, `delivered`), the same in every language, so the app chooses icons from it instead of reading English words. The courier's own scan events keep the courier's text (they have no `kind`). **Fixed on the way:** internal steps (a flag, returning or discarding a faulty unit) used to appear in a buyer's tracking as the raw step name (for example "flagged"); only the buyer-facing steps are shown now. Tested in `trackingLanguage.integration.test.js` (3), verified to fail with the old behaviour.

## The Overview page: honest numbers

- **Orders per day** (admin Overview and the supplier dashboard) now returns **every one of the last 7 days** (today and the 6 before), with **0** for a day without orders. Before, only days that had orders came back, so two busy days showed as a straight line between two points (it looked like a steady climb) and the quiet days were missing.
- **The "vs last week" trend** on the KPI cards is shown **only when a real change is supplied**. Nothing supplied one, so every card used to show a red down-arrow and "vs last week" with no number, as if every figure had dropped. The cards now show just the number. (Real week-over-week changes can be added later, per card.)
- The supplier portal's language file had an unused, invented "+9.4% vs last week" text; it was never displayed and has been removed.
- **The numbers themselves are real counts of what is in the database**, which includes whatever the automated tests left there (see "Test leftovers"). Total orders, the busy day on the chart, open disputes and open tickets all fall once the test data is cleaned.

## A fault covers the WHOLE parcel (decision, replaces the earlier "partly faulty parcels" gap)

**What was wrong.** A fault case could cover just SOME items of a hub parcel, but the hub handles the parcel as one. Tested with a real two-item order (one faulty item, supplier at fault, refund, unit returned): the buyer paid $69.31 and was refunded $39.99; the other item ($29.32) was **never shipped** (the hub shipment ends at "returned to supplier" and cannot be advanced), **never refunded** and **never paid to the supplier**.

**The decision (option B): a fault always covers the whole parcel.** The whole parcel goes back to the supplier and **every** item in it is refunded or replaced together, so nobody is left out of pocket and the existing payout and payment-release rules (which already work on the whole sub-order) stay correct.
- `POST /fault-cases`: `items` is now **optional**. Leave it out and the case covers every item of the shipment. If you do send it, it must list **every** item; a partial list is refused with `400` ("A fault covers the whole parcel: all N items in it are returned and refunded or replaced together. Leave \"items\" out, or list every item."). An unknown product, an empty list, or a value that is not a list are also refused. A one-item parcel is unchanged.
- The suggested refund is therefore what the buyer actually paid for the whole parcel; a replacement order contains every item.
- **Admin screen:** the "Real fault..." dialog no longer has item tick-boxes. It says "THE WHOLE PARCEL IS COVERED", lists every item with its value, and sends every item. (The amber "only some items are ticked" warning that was added meanwhile is gone with the tick-boxes.)
- **Tested:** `faultCases.integration.test.js` (5 new tests, with a real two-item parcel) and `FlaggedShipmentsFlow.test.jsx`. Verified to fail when a partial list is accepted again, and when only one item is covered.
- **If the business later wants buyers to keep the good items** (ship them on and pay the supplier for them), that is a larger change to the hub's steps, the payout rules and the payment-release amounts; the decision was to keep it simple for now.

## Test leftovers in the app's database, and how to remove them (migration 101)

**What happened.** The automated test suites run against a REAL backend and a REAL database, and they leave what they create behind: test categories, parts, products and vehicle brands (all named with a 13-digit timestamp, or "Test" / "E2E" / 测试). When the suites are run against the database the **phone app uses**, the app shows them: dozens of test products, 20 extra categories, a part list with hundreds of entries, and test vehicle brands in the garage's "add a vehicle" list. (In one case it was partly a bug in a test helper: it re-created the seed part "Front Brake Disc" on every run, because the server accepted duplicate part names. About 26 copies had piled up.)

**The cause is fixed.**
- The server now **refuses a duplicate part name** within a category (capitals and extra spaces ignored): `409` on create and on rename, enforced by a unique index (`category_parts_name_unique`). Migration 101 first **merges the existing duplicates** (it keeps one row per name, preferring the one with a photo, then the oldest). Products refer to a part by its *name*, so merging is safe. Part ids also have a random tail now (two parts created in the same millisecond used to collide).
- The test helper `ensureSeedParts` now **looks before it creates** (tested: with the part present it sends no creation request at all, however many fresh copies of the helper run).

**To remove the leftovers already in a database:** `node scripts/remove-test-data.js` (run from `services/api`; it uses the backend's own settings).
- **By default it is a DRY RUN**: it prints what it would do and changes nothing. Add **`--apply`** to do it.
- **Test orders:** an order is a test order only if its buyer or guest address is `@example.com` / `.org` / `.net`. It is **deleted together with everything that hangs off it**: sub-orders, line items, addresses, hub shipments and their events and photos, fault cases, return cases and their messages, tickets, payments and so on. Those are found through the database's own foreign keys (`scripts/deleteWithDependents.js`), so nothing is left pointing at a deleted order; if the database would still refuse any deletion the whole run is cancelled and nothing changes. **Payouts:** one that pays only test orders is deleted; one that **also pays a real order** stays, and so do the test orders in it (deleting them would make its total wrong): the output counts them as "held back". **Orders of real-looking addresses are never candidates.** `--keep-orders` skips this part. **This cannot be undone** (the backup file only lists the ids), so take a database backup first if you want one: the dry run prints the `pg_dump` line to use. Tested on a copy of a database with ~3,000 test orders, a real-looking order carrying a shipment, fault case and return case, and a payout mixing real and test: 2,977 orders (27,501 rows in 19 tables) deleted in 3 seconds; the real order kept every one of its rows, the mixed payout still paid both, nothing pointed at a deleted order, and every admin page still answered.
- **Test accounts:** every non-admin account with an `@example.com` / `.org` / `.net` address (buyers, **hub staff**, supplier logins: the tests give them known passwords) is **deleted together with what it created that is not an order**: support tickets, reviews, wishlists, saved vehicles, notifications, hub events... An account that **still owns an order** (one held back above) is kept. Real-looking accounts are never touched and are listed in the output (`accounts kept: ...`). **A safety stop cancels the whole run** if deleting accounts would ever reach an order, shipment, payout or product.
- **Test guest tickets:** support tickets opened with a test address and no account are deleted with their messages.
- **Test products are now DELETED, not just hidden** (the earlier "hide" step still runs first). A test product is **kept (hidden)** if a remaining order contains it or a remaining (real) account reviewed or wishlisted it. Deleting them takes their vehicle links, reviews and wishlist entries with them. Product ratings are not computed from reviews (the seed products carry fixed values), so deleting test reviews leaves no stale totals.
- **Test hubs** can now be removed too: once their test staff and shipments are gone nothing holds them.
- **Not covered:** nothing is known to be left. A second run of the tool finds nothing to do. (There are no separate test suppliers: the tests use the real supplier `s1`.)
- **Tested on a copy** of a database holding ~3,000 test orders, ~5,400 test accounts and ~120 test products, with traps (a real buyer with a ticket and a wishlisted test product, a real-looking order containing a test product, a test account owning a held-back order, a payout mixing real and test): 2,986 orders, 5,434 accounts, 110 products, 98 guest tickets, 724 hubs and 147 admins removed in 11 seconds; every trap survived; and the Overview then showed 2 orders, 0 open tickets, 0 disputes; the supplier's product list fell from ~119 to 9; the buyer catalog showed 2 products and 6 categories.
- **Test admin accounts (security):** the tests create admin accounts with **known passwords** (`test_password_123`, `limited_pass_123`): addresses like `perm-test-<number>@leap.dev` or `...@example.com`. The tool **deletes** each one; if something still refers to it (it created a fault case, a payout, a cart...) it **locks** it instead (the password is replaced by a random one nobody knows), so the known password stops working either way. **The owner, and any admin whose address does not clearly look like a test account, are never touched**; the admins it keeps are listed in its output so you can check them. Tested on a copy: 147 removed, 1 locked, the owner and a real colleague still log in, the locked one is refused with the very password that works for the others, a deleted one is refused. (If you ever need one of the locked ones back, reset its password through "forgot password".)
- It **closes the open flagged shipments that belong to test accounts** (an order whose buyer or guest address is `@example.com` / `.org` / `.net`): the shipment is marked resolved (`fault_closed_manually`), its open fault case is marked completed, and the buyer's open return case is completed, **with no notification sent to anyone and nothing deleted**. They leave the admin's **Flagged** page and the hub's **Flagged** filter (the hub still lists them under **All**, as Closed). A flag on a **real-looking address is left exactly as it is** and listed in the output. What it changed is recorded in the backup file (`closedFlags`: shipment, fault case and return case ids with their previous statuses).
- It **hides** test products from buyers (status `inactive`; nothing is deleted, so orders that include them stay intact). It **deletes** test categories, test parts, test vehicle brands (with their models, generations and engines) and test hubs, but **keeps anything in use**: a part or a brand that a **real** product uses, a brand a buyer saved in their garage, a brand used by a quote request, a hub with shipments or staff. Those are listed in its output.
- It recognises test data by the markers above (`scripts/testDataRules.js`, tested with real and test names): a 10+ digit number, the words test / e2e / 测试, or the test helper's "compatible replacement part" padding. **The seed products (p1, p2...), the seed categories, hubs and parts, and anything a person typed by hand (such as a product with a gibberish name) are never touched.**
- **Before it changes anything it saves a backup file** (`services/api/backups/test-data-removed-<time>.json`) with the removed rows and the ids of the hidden products. To un-hide a product: `UPDATE products SET status = 'active' WHERE id = '...'`.
- It does **not** touch accounts, orders, or the hundreds of test hubs that have shipments or staff attached (the buyer app never shows hubs; the admin's Hubs page does). Test buyer accounts and orders stay too.

**Tested on a copy of a polluted database** (790 open test flags closed, the one flag on a real-looking address left open, and the admin's own Flagged page then listed only that one; the tests' own leftovers plus traps: a hand-typed product, a test brand that a product fits, a test brand a buyer saved, a real product using a test-looking part): categories 27 to 6, parts 277 to 36, vehicle brands 34 to 8 (the 6 real ones plus the 2 protected by real use), 79 test products hidden, the hand-typed product still active, orders and accounts untouched, and a second run finds nothing left. **Automated:** `testDataRules.test.js` (4: test and real names), `removeTestData.dryrun.test.js` (2: the dry run changes nothing and is repeatable), `partDuplicates.integration.test.js` (6).

**To keep the app's database clean in future, do not run the test suites against it: use `scripts\run-tests.cmd`** (see `scripts/README.md`). It wipes and rebuilds a separate `..._test` database, runs a hidden backend on it, runs the suites, and puts your normal backend back. Underneath: `db/prepare-test-db.js` (creates / wipes / migrates / seeds the test database; `db/testDatabase.js` holds the rule that only a name ending in `_test` may be wiped).

## Email: addresses without regard to capitals, Arabic emails, and a reset page that works (migration 100)

**1. Email addresses ignore capital letters.** Until now `Name@gmail.com` and `name@gmail.com` were two different accounts: a phone keyboard that capitalises the first letter could lock someone out of login or password reset without any message. Now every address is **stored in lowercase** and **looked up case-insensitively** (`normalizeEmail` / `sameEmail` in `modules/auth/emailAddress.js`) at signup, login, forgot password, change email, admin and hub staff creation, and for guest orders (reaching an order with `?guestEmail=`, cancelling, linking a guest's orders when they sign up). Migration 100 lowercases the existing addresses and adds a unique index on `lower(email)`, so "same address, different capitals" is impossible for good. **If two existing accounts differ only by capitals the migration stops with a clear message** (it never guesses which to keep): merge or rename one, then run it again. **`node scripts/duplicate-emails.js`** (run from `services/api`; needs no password, it uses the backend's own database settings) lists every such pair and suggests which account to keep (the one with the most orders, then the newest); **`node scripts/duplicate-emails.js --rename <id>`** renames the one you give up to `name+old@domain` (nothing is deleted, all its data stays, and it only accepts accounts that really are in a duplicate pair). Tested on a copy with such pairs: it reproduced the migration's error, the rename fixed it, the migration then applied, and the kept account kept its orders.

**2. The password reset email works for a real buyer.** The **button** opens `GET /reset-password?token=…`, a small page the backend serves (English and Arabic together, no login, never cached, the address is not passed on to other sites, and it accepts only a well-formed 64-character code, anything else is a polite 404). The page sends the new password to the same `POST /auth/reset-password` the buyer app's "I have a reset code" screen uses. The email also shows the **code itself** in a box, so the buyer can type it in the app instead. A code works once and expires (as before).

**3. Buyer emails come in the buyer's language.** Welcome, password reset, order confirmation, shipped and delivered are written in **Arabic** (right to left) for an account whose app language is Arabic (`users.language`, the same language in-app notifications and push use), **English** for an English account, and **English then Arabic in the same email** for anyone we cannot know (a guest checkout). Subjects follow the same rule (`email/language.js`). The English text is exactly what it was. **Not translated yet:** price drop, back in stock, saved search, and every supplier-facing email (the supplier portal is Chinese/English). **The Arabic wording should be read by a native speaker before launch.**

**3b. The reset reply never waits for the email.** `POST /auth/forgot-password` answers at once and sends the email afterwards. Before, it waited for the mail server: a slow or unreachable one kept the buyer waiting (the buyer app shows **"No internet connection"** when a reply takes more than 30 seconds, or none arrives), and how long the reply took told a stranger whether an address was registered (an unknown address was answered instantly). If the email cannot be sent, the reset link is printed in the backend window as before. Checked with a mail server that never answers: both a real and an unknown address are answered in about 0.02 seconds; the old code took 10 seconds for a real one.

**4. Settings and checks.**
- **`PUBLIC_API_URL`** (in `services/api/.env`) is now the base of the reset button's link as well as the courier QR. It must be reachable from the **person's phone**: your public API domain in production; to test the button from a phone on your Wi-Fi use your PC's address, e.g. `PUBLIC_API_URL=http://192.168.0.210:4000`. The default `http://localhost:4000` only works on the PC itself.
- **`GET /health`** now includes `email: { configured: true|false }` (no secrets), and the backend prints one line at startup: `Email: sending through <host>:<port>` or `Email: NOT configured, emails are printed in this window…`.
- **`node scripts/send-test-email.js you@example.com [en|ar|both]`** sends one real test email through the backend's own code, to check a new provider (or Mailpit) in one step.
- **`.env.example`** now documents the six `SMTP_*` settings the code reads (it listed an `EMAIL_PROVIDER_API_KEY` that nothing used).

**Tested:** `emailCase.integration.test.js` (6) and `resetPage.integration.test.js` (3) against the real backend; `emailLanguages.test.js` (11, pure); and `emailDelivery.integration.test.js` (3), which proves the emails that REALLY ARRIVE are right (it runs only when the backend has email configured and Mailpit is listening, otherwise it skips itself). Verified to fail when forgot-password is case-sensitive again, when nothing is lowercased, when any text can go into the reset page, when everyone gets English, and when the code is left out of the email.

## Closing a fault case by hand (migration 098)

For a case that gets **stuck** (the hub never confirms the unit's return, a replacement was cancelled by agreement, a case was opened twice): `POST /fault-cases/:id/close` (admin, body `{ note }`). The **written reason is required** (5 to 500 characters) and is kept with who closed it (`closed_manually_by` / `closed_manually_note`, shown to admin as `closedManually`). Effects: the case becomes `completed`, the hub flag gets `resolution = 'fault_closed_manually'` and leaves the queue, and the buyer's return case closes with the usual "this case is now closed" message (both languages). Audit-logged as `fault_case_closed_manually`.

**What the hub sees.** A manually closed flag keeps its `flagged` status in the hub's data (the unit may never have been recorded as returned) but is marked **resolved** (`resolution = 'fault_closed_manually'`). The hub's shipment list now carries `resolution` and `resolvedAt`, and the hub's view of the case says `needsReturn: false` and `platformStage: 'closed'` once a case is closed, so the hub is **no longer told to send the unit back** (before this, a manually closed case still showed the "send the unit back" panel). The hub portal shows such a shipment as **Closed / 已关闭** (grey, not the red Flagged badge), with the message "The platform has closed this case: nothing more is needed from the hub for this shipment", and it is no longer listed under the "Flagged" filter. The hub's workload counts already excluded resolved flags.

**It is never a way round money:** while the case's outcome is a refund that has not been recorded as **issued**, closing is refused (the buyer is expecting that money): record it as refunded first. A case that is already closed cannot be closed again (the original reason is not overwritten). It can close a case with a replacement on its way, or one the supplier has not answered yet.

**Tested:** `apps/admin-dashboard/src/closeCaseManually.integration.test.js` (5, real backend). Verified to fail when the reason is not required, when a closed case can be closed again, when the refund guard is removed, when the flag stays in the queue, and when the buyer's case is not closed.

## Choosing your own password (migration 099)

A person who was given a **temporary** password (a new hub staff account, or one an admin reset) must choose their own.
- `users.must_change_password` is set when an admin creates or resets a hub staff account; `POST /auth/login`, `POST /auth/login/2fa` and `GET /auth/me` report it as `user.mustChangePassword`.
- `PATCH /auth/me/password { currentPassword, newPassword }` (any logged-in person): the current password must be right (401 otherwise), the new one at least 8 characters (200 at most) and different from the current one; it clears the flag. The temporary password stops working at once.
- The **hub web portal** shows a "set your own password" screen (Chinese / English) before anything else when the flag is set, including when a saved session is reopened (the flag comes from the server).

**HONEST LIMIT:** this is enforced by the portal's screen, **not on the server and not in the hub mobile app**. Blocking the server would lock out staff who only use the mobile app, which does not know about the flag yet; adding it there needs the hub app to be rebuilt.

**Tested:** `passwordChange.integration.test.js` (5, real backend) and the hub portal's `PasswordChangeFlow.test.jsx` (7). A real bug found by the tests on the way: the login queries selected named columns, so the flag was never reported until the new column was added to both.

## Replacement orders: receipt and the hub's list

- **Receipt (`GET /order/:id/receipt`):** for a free replacement (migration 095) the buyer's receipt no longer lists the original unit prices next to a total of $0.00: it is titled "Replacement order receipt (no charge)" (Arabic too) and shows $0.00 prices. An **admin** still sees the real figures. The original order's receipt is unchanged. (`order/receiptHelpers.js`.) Checked by reading the generated PDFs as the buyer, as an admin and for the original order.
- **Hub list (`GET /hub/me/shipments`):** each shipment now has `replacementFor` (the order the buyer paid for, or `null`); the hub portal tags a replacement in the queue ("补发" / "Replacement"). The detail page already had the banner.

**Tested:** `replacementPolish.integration.test.js` (2) and the pure `receiptHelpers.test.js` (3).

## Paying the supplier when LEAP bears the cost of a fault (migration 097)

**The rule (decided with the owner):** Leap pays the supplier only **the order, the replacement, and local shipping charges**. Any other cost caused by a supplier's own fault is the supplier's.

| Who bears the cost | What the supplier is paid |
|---|---|
| **Supplier** (their fault) | **Once**, for the unit the buyer finally receives (through the replacement, migration 095). The faulty original is never paid, and nothing else is: they bear every other cost of the fault. The platform does not "charge" those costs, it simply pays nothing extra. |
| **Leap** (the fault happened in our care) | **The original order** (net of commission) **+ the replacement** (paid when delivered, as above) **+ local shipping charges**. |

**Why an adjustment is needed:** a shipment with a fault case also has a return case, and the payout rules never pay an order with a return case. That is right for a supplier fault, but when Leap bears the cost Leap owes the supplier for that original order too. So an admin releases it explicitly.

- `POST /fault-cases/:id/release-supplier-payment` (admin; body `{ localShippingAmount?, note? }`). Allowed only when `cost_bearer = 'leap'` **and** the refund or replacement has been confirmed (it works for either outcome: if the buyer was refunded, the supplier still shipped good goods). Refused for a supplier-fault case (400), before an outcome is chosen (400), for a bad shipping amount (negative / not a number / absurdly large: 400), a second time (409), and for an order already paid out (409). Audit-logged as `fault_case_supplier_payment_released`; the supplier gets a notification.
- It writes up to two rows in **`payout_adjustments`**: `original_order` (the order's value net of commission, computed by the same arithmetic as the payout rules, with its gross value kept too) and `local_shipping` (the amount the admin typed, in USD: **nothing in the system stores a supplier's local shipping cost, so it is entered by hand**; optional).
- Adjustments are owed **immediately** (no return window), and are picked up by the supplier's **next payout**: `GET /payouts/owed` (and `adjustmentCount`), `POST /payouts` (they are marked paid and the payout amount includes them), and the supplier's own Finance page (`readyToPay.amount` and a `readyToPay.adjustments` list) all agree. In the supplier's payout history `sales` counts an adjustment at its gross value, so "sales minus the payout" is still exactly the commission and local shipping is never mistaken for commission.
- The admin's fault case shows `supplierPayment`: `{ released, originalOrder, localShipping, releasedAt, paidOut }` (only when Leap bears the cost; before release, `originalOrder` is a preview of what would be released).

**Not automated:** the replacement's own local shipping, if the supplier charges one, is covered by typing it as "local shipping" at release. Costs the platform never tracked (return shipping, hub handling) are not charged to a supplier at fault: that would be a separate feature.

**Tested:** `apps/admin-dashboard/src/supplierPaymentRelease.integration.test.js` (5, real backend, checks the money): only an admin; a supplier-fault case releases nothing; nothing before an outcome; bad amounts refused; the exact amounts on the admin payout page and the supplier's Finance page; no double release; the whole rule for both cost bearers side by side (Leap: order + replacement + shipping; supplier: the replacement only); the payout takes the adjustments with it and nothing is owed twice; no negative commission in the history; a refund also counts. Verified to fail when a supplier-fault case can release, when the gross is paid instead of the net, when a payout does not mark adjustments paid, when the history ignores them, and when the Finance page ignores them.

## Courier delivery link: photos AND delivery confirmation (migration 096)

**What it does:** the address label the hub prints now carries a **QR code** ("FOR THE COURIER"). When the courier delivers, they scan it, take a photo and send it. That **stores the photos as proof of delivery** and **marks the shipment delivered**:
the same as the hub confirming it by hand or the carrier's tracking saying so (status, delivery time, the buyer's notification in both languages, the email, and the replacement-case hook, so a delivered replacement completes its fault case).

**The page** (`GET /p/:token`, no login, no app) is one small page in **English and Arabic together**: a photo picker (`capture="environment"` opens the camera), the courier's name and a note (both optional), and one button.
It holds nothing about the order: the order number, buyer and address never go into the page.

| Endpoint | What it does |
|---|---|
| `GET /proof/:token` | `{ state, orderId?, photoCount?, maxPhotos }`: `unknown` · `expired` · `not_shipped_yet` · `ready` · `delivered` |
| `POST /proof/:token` | multipart: `photos` (1–8 JPEG/PNG/WebP, 10 MB each, at least 400 px on the short side, checked as real images), `courierName?`, `note?` |
| `GET /order/:id` | each shipment gains `deliveryProof: { source: 'courier_link', verified: false, photos: [...] }` or `null`. **Admin** also gets each photo's `courierName` and `note`; the **buyer** gets only the photos and when. The courier's IP address and device are recorded and shown to nobody. |

**Because the QR is on the parcel, anyone handling it (including the buyer) can see it, so the link is guarded:**
- a long random token (32 random bytes), one per shipment, created when the label is printed or the hub ships the parcel; **reprinting a label keeps the same link** (a label already on a parcel must keep working);
- it does **nothing until the hub has SHIPPED the parcel** (`not_shipped_yet` / 409), so scanning it early cannot mark anything delivered;
- it **expires after 60 days**;
- **only the first upload changes the delivery status**; later ones only add photos (at most **8 in total** per parcel), never a second notification or a moved delivery time;
- a parcel the hub or carrier already delivered still accepts photos, but its delivery record is untouched;
- rate limits: **20 attempts per link per 10 minutes**, and **300 hits on non-existent links per address per 10 minutes** (guessing); both answer 429 with `Retry-After`;
- the admin sees the photos labelled **"sent through the courier's link, not verified"**: this is evidence, not a guarantee.

**Setting:** `PUBLIC_API_URL` (in `services/api/.env`) is the address the QR contains. It must be reachable from the **courier's phone**, so in production it is your public API domain. For a test on your own Wi-Fi use your PC's address, e.g. `http://192.168.0.210:4000`
(default: `http://localhost:<port>`, which only works on the PC itself). Change it and re-print the label: an existing link keeps its token but the QR is drawn from the current setting.

**HONEST LIMITS:** the QR is only as secure as its token and guards; a determined person with a label can still send photos after the hub has shipped (that is the trade-off of "the courier's photo confirms delivery"); the label QR could not be scanned in the sandbox (the PDF
is produced and the link behind it is tested); the buyer app's photos have been read and bracket-checked but not compiled; photos are stored with the other uploads (cloud if configured, otherwise the local `uploads` folder).

**Tested:** `apps/admin-dashboard/src/courierProof.integration.test.js` (10, real backend, including a courier delivering a REPLACEMENT) and `courierProofRateLimit.test.js` (4). Verified to fail when the link works before shipping, when the photo cap is removed, when the buyer is shown who sent the photos,
when the replacement hook is skipped, and when a reprint changes the link.

## Crash protection and the "database not up to date" warning

**The problem this fixes:** after an update, the new backend code can run against a database that has not had the new migration. The first route to touch a missing column then threw inside an `async` handler, and **Express 4 does not catch
errors thrown in `async` handlers**: under Node 15+ the unhandled rejection **ended the whole backend process**, so every portal (admin, hub, supplier, the apps) suddenly looked "not loading". It was reproduced with migration 095 missing:
`POST /fault-cases` killed the server.

**What changed**
- **`src/config/asyncErrors.js`** (installed first thing in `src/index.js`, before any route): a rejected promise from an async route handler now reaches the error handler and returns a **500**; the server stays up and keeps serving every
  other request. (Express 5 does this natively; this is the same small patch the `express-async-errors` package makes, without the dependency.) It applies to every route in the backend, not just the fault-case ones.
- **`src/config/pendingMigrations.js`**: when the backend **starts**, it compares `db/migrations/*.sql` with the database's `schema_migrations` and, if any are missing, prints a boxed warning in the backend window naming them and saying
  exactly what to run (`node db/migrate.js`, then restart). `GET /health` also reports it: `{ status: 'ok', …, pendingMigrations: [] }` (the names of any missing files, or `null` if it could not be checked). `status` stays `ok`, so existing checks keep working.
- It is a warning, not a refusal to start: a half-updated system is better diagnosed running than not running, and the 500s above are now safe.

**Seeing the difference:** with the migration missing, `GET /hub/flagged` and `POST /fault-cases` return a clean `500 Internal server error` (and the Flagged page shows an error), `/health` lists the missing file, and everything else keeps working.

**Tested:** `apps/admin-dashboard/src/startupSafety.test.js` (12): an async rejection (including one after an `await`) is a 500 and the next request is still served; synchronous errors, normal handlers, middleware order and 404s are unchanged; installing it twice is harmless;
`index.js` installs it before the first route; the pending list is exactly the migrations the database lacks, in order (ignoring non-`.sql` files; a database with no migrations table has everything pending); the warning names each file and the fix; `/health` reports
an empty list on an up-to-date database. Verified to fail when the guard is disabled, when the list is inverted, and when it is not installed.

## Replacement orders (migration 095)

**What it does:** when the hub flags a faulty unit, an admin confirms it is a real fault, and the supplier says they CAN replace it, an admin can now confirm a **replacement** (the "Send a replacement…" button, which used
to be disabled). It creates a **new, free order** for the buyer that flows through the normal pipeline: the supplier ships it to the inspection hub, the hub receives / inspects / ships it, it is delivered.

**The order**
- Numbered from the order the buyer **paid for**: `LP-200934-R1`, then `-R2` if the replacement is itself faulty (the number is unique per root, enforced by a unique index; `orders.replacement_of` always points at the root).
- `total = 0`: the buyer pays nothing, sees **no prices** on it (`unitPrice` is 0 for buyers and guests; admin and the supplier's own data keep the real figure), and **cannot cancel it** (whole order or part).
- Same buyer, same delivery address **including its English version** (migration 094), same inspection hub, and the faulty items at their **original unit prices** (see "Money").
- The buyer is told in both languages ("We are sending you a replacement at no charge…"), the supplier is asked to ship it, the buyer's return case moves to `approved`. `GET /order/:id` gains `isReplacement` and `replacementOf`;
  `GET /hub/me/shipments/:id` gains `replacementFor` so hub staff know what it is.

| Endpoint | Who | What it does |
|---|---|---|
| `POST /fault-cases/:id/confirm-replacement` | admin (Flagged page) | Needs the supplier to have answered **yes** (not unanswered, not "no"); refused once a refund or another replacement is confirmed. Audit-logged as `fault_case_replacement_confirmed` with the new order id. |

**Lifecycle:** `awaiting_supplier` / `awaiting_admin` → `replacement_pending` → `completed`. The case completes only when **both** (a) the replacement is **delivered** (by the hub's manual confirmation or the carrier's webhook;
`onShipmentDelivered`, best-effort, can never block the delivery itself) **and** (b) the hub has returned or discarded the **faulty unit**, in either order. Completing closes the flag (`resolution = 'fault_replacement'`) and the buyer's
return case. The admin panel shows the replacement order and where it is: waiting for the supplier / at the hub / shipped / delivered.

**Money (decided with the owner: "if the fault is the supplier's they bear all fees")**
- The faulty original always has a return case, so the payout rules (delivered + return window + **no return case**) can **never** pay it. The replacement carries the original prices and becomes payable once delivered and past the
  return window. Net effect for a supplier-fault case: the supplier is paid **once**, for the unit the buyer finally received, and bears the faulty unit and every shipping cost. Nothing in the payout code had to change.
- **When LEAP bears the cost** the supplier is also paid for the original shipment, through an explicit admin release: see "Paying the supplier when LEAP bears the cost of a fault (migration 097)" below.
- A refund on a case whose faulty unit came in a replacement is measured against what the buyer **paid** (the root order), never against the replacement's zero total.
- Stock is **not** decremented for a replacement (the supplier ships from their own stock).

**HONEST LIMITS:** the buyer-facing receipt PDF of a replacement still lists the (hidden-elsewhere) unit prices with a $0 total; the mobile apps show the replacement as an ordinary order numbered "-R1" with $0 (not checked on a device); the
hub's shipment LIST does not tag replacements (only the detail page does).

**Tested:** `apps/admin-dashboard/src/replacementOrders.integration.test.js` (9, real backend, drives the whole journey). Verified to fail when the supplier's "yes" is not required, when completion does not wait for the faulty unit,
when the buyer is shown prices, when the replacement is priced at zero (so the supplier would never be paid), and when the delivery hook is removed.

## English delivery address for the inspection hub (migration 094)

**The gap:** a buyer may type their delivery address in Arabic, but the people at the inspection hub cannot read it, and a generated PDF label does not join or order Arabic letters reliably.
The hub needs an English address to ship to. (The hub web portal and the admin order page also never showed the delivery address at all; both do now.)

**How it works**
- `order_addresses` still holds the address **exactly as the buyer typed it** (the legal record, never changed by any of this). Beside it are English columns (`recipient_name_en`, `country_en`, `city_en`,
  `street_address_en`, `state_en`) and `english_source`: `same` (already English, nothing translated) · `auto` (produced automatically from Arabic) · `buyer` (the buyer confirmed or corrected it) · `admin` (an admin
  corrected it) · `NULL` (an order from before the migration: filled in the first time it is read, so nothing is rewritten by the migration). Phone, postal code and national address are digits / codes and are not translated.
- **`addressEnglish/transliterate.js`** (pure, no database) does the Arabic → English: a **dictionary** of countries, cities, address words (street, district, building, mosque, hospital…), well-known districts and
  ~100 common first and family names, so those come out as the English world writes them ("الرياض" → "Riyadh"); everything else is **romanised by rule**. Arabic is normally written without short vowels, so the rule-based
  part is **approximate** ("بستان" → "Basatan", where the usual spelling is "Bustan") — which is why `auto` addresses carry a warning everywhere they are shown and are meant to be confirmed. Digits and punctuation are converted
  exactly. English text passes through untouched. Arabic puts the kind of place first ("شارع الملك فهد"), English after ("King Fahad Street"), so type words are moved within an Arabic clause. Never leaves an Arabic letter in
  its output.
- **When it is computed:** on every order placed (typed or saved address), and again when a guest adds or **replaces** their address after the fact (then any earlier correction no longer describes the new original, so it is recomputed).
  A correction by a person is otherwise never overwritten.

| Endpoint | Who | What it does |
|---|---|---|
| `GET /order/:id` | buyer / guest / admin | now includes `addressEnglish` `{ recipientName, country, city, streetAddress, state, source, confirmed, updatedAt }` beside the original `address` |
| `GET /hub/me/shipments/:id` | hub staff | `deliveryAddress` is now the **English** address, plus `englishSource` (so the hub can see an automatic one) |
| `GET /hub/me/shipments/:id/address-label` | hub staff | the printed label is produced from the English address |
| `PUT /order/:id/address-english` | admin with the Orders page | corrects the English version (`recipientName`, `country`, `city`, `streetAddress` required; `state` optional); every field must be written in English letters (Arabic → 400); audit-logged as `order_address_english_updated` **without** copying the address |
| `PUT /order/:id/address-english/confirm` | the buyer (or a guest with the order's email) | send nothing to confirm the automatic version as it is, or the English fields to correct it; either way it becomes `buyer` |

**Hub apps:** `hub-mobile` reads the same `deliveryAddress` fields, so it shows English with no app change (not verified on a device). **Not built:** the buyer app asking the buyer to confirm (the endpoint is ready; the Flutter screen is not).

**HONEST LIMITATIONS:** the transliteration is a good guess, not a certainty — the buyer's confirmation and the admin's correction are the safeguard; the dictionaries cover the Gulf and the main Arab cities and
common names, not every place; the wording of the English side was written by the developer and not reviewed by a native speaker.

**Tested:** `apps/admin-dashboard/src/addressTransliteration.test.js` (14, pure), `addressEnglish.integration.test.js` (10, real backend). Verified to fail when the hub is shown the Arabic original, when Arabic is accepted as
"English", and when a replaced address keeps a stale correction.

## Notifications in the buyer's language (migration 093)

**The gap:** every notification was stored as ONE English string, so a buyer using the app in Arabic still got English notifications, and the app never told the
server which language it was in.

**How it works now**
- A notification stores an English text (`title`, `body`, unchanged) and an optional Arabic text (`title_ar`, `body_ar`). `createNotification()` accepts `titleAr` / `bodyAr`.
- `GET /notifications/me?lang=ar` returns the Arabic text. No `lang`, or anything other than exactly `ar` (including `AR`, `fr`, empty), is English. A notification with no
  Arabic text — an older one, or one meant for a supplier — falls back to English **field by field**, so a missing Arabic body never shows blank (`notifications/i18n.js`,
  `localize()`). `PATCH /notifications/me/:id/read` answers in the same language.
- **Every buyer notification lives in `notifications/messages.js`** as an English + Arabic pair, and call sites spread the result into `createNotification()`:
  order shipped / delivered / on its way to the inspection hub / delayed, return updated (with the app's own Arabic status words), the fault-case messages, account
  anniversary, price drop, back in stock, saved search, referral reward, and support replies. Because each builder returns both languages, a new notification cannot forget
  its Arabic, and the whole set is unit-tested without triggering each event. Arabic number forms are handled (عام / عامين / 3–10 أعوام / 11+ عامًا, and the same for "new results").
  Text a person typed (a support reply's body, a saved search's label) is passed through unchanged, because it cannot be translated.
- **Fault-case messages:** the buyer's return-case THREAD still shows English and Arabic together (it is a conversation, not a notification), but the NOTIFICATION now carries each
  language in its own field instead of one mixed string.
- **Not translated:** notifications sent to SUPPLIERS (low stock, a cancelled order, messages from Leap, verification, "can you replace?") stay English-only — the supplier portal is
  Chinese / English — and so do emails. Both are separate follow-ups.

**Push:** a push is sent at the moment an event happens, with no app request to ask which language to use. So the server remembers the language the app last reported
(`users.language`, set when the app loads notifications or the unread count with `?lang=`; only a clear `ar` or `en` is stored) and `sendPushToUser` picks that language, falling
back to English when there is no Arabic text or no known language. Tested with a fake Firebase, because a real one is not configured here.

**Bug fixed on the way:** `POST` / `DELETE /notifications/register-device` read the user's id as `req.user.id`, but the login token stores it as `sub`, so the id was always empty:
**every device registration failed (500)**, and removing a device on logout silently deleted nothing, so a logged-out phone would have kept receiving the previous user's pushes.
Both now use `req.user.sub`. (The same mistake exists in `supplier-messages/routes.js`, where it only leaves a message's sender blank; not changed here.)

**Existing notifications (the migration's backfill):** notifications that already exist are English-only. Where an old one followed a fixed pattern (shipped, delivered, on its way to
the hub, delayed, return updates, anniversary, referral reward, support reply, back in stock, price drop), the migration works out its Arabic text, and it splits the old
"English⏎Arabic" fault-case messages into their own fields. Anything matching no known pattern stays English. The backfill is the part of the migration file after the
`===== BACKFILL` line; it only touches rows that still have no Arabic text, so it is safe to run again.

**HONEST LIMITATIONS:** the Arabic wording was written by the developer and has not been reviewed by a native speaker; the mobile change was read and bracket-checked, not compiled (see
`apps/mobile/README.md`); the language is remembered per USER, not per device (two phones with different languages will share the last one reported, for push only).

**Tested:** `apps/admin-dashboard/src/notificationMessages.test.js` (14, pure), `notificationLanguage.integration.test.js` (7, real backend), `pushLanguage.integration.test.js` (5, real
database + fake Firebase), `notificationBackfill.integration.test.js` (4, real database); `faultCases.integration.test.js` was updated for the one-language-per-notification behaviour.
Verified to fail when the language choice is ignored, when the app's language is not remembered, when push ignores it, and when an Arabic text is replaced by English.

## Supplier return addresses (migration 092)

**The gap:** a confirmed real fault (migration 091) tells the hub to send the faulty unit back to the supplier, but `suppliers` held only a name,
a country and a contact email, so hub staff had no address to ship to and no phone number for the courier.

`supplier_return_addresses` — one row per supplier (`contact_name`, `phone`, `address`), same shape as `supplier_payout_methods`: saving **replaces**
it, no history. Stored **as entered**, in whatever language the supplier's courier needs (a Chinese supplier will normally write it in Chinese).

| Endpoint | Who | What it does |
|---|---|---|
| `GET` / `PUT /supplier/me/return-address` | the supplier | Read / save their own. `GET` returns `null` until one is entered. |
| `GET` / `PUT /supplier/:id/return-address` | admin with access to the Suppliers page | Read / correct any supplier's. Unknown supplier → 404. The change is audit-logged (`supplier_return_address_updated`) **without** copying the address into the log. |

Validation (same for both): contact name 2–100 characters, phone 5–30 characters of digits, spaces and `+ - ( ) .` only (it is read to a courier), address
10–300 characters; values are trimmed. A supplier can only ever touch their own row.

**Where it shows up:**
- **Hub** — `faultCase.returnAddress` on `GET /hub/me/shipments/:id` (or `null`), shown in the hub portal's return panel with a **printable return label**
  (the browser prints it — no PDF library, so Chinese and Arabic always draw correctly). Hub staff still see nothing about money.
- **Admin** — `GET /hub/flagged` gives every flag `supplierReturnAddressOnFile`, so the "Real fault…" dialog can **warn before** a case is opened; the case panel
  repeats the reminder while the unit is still waiting to go back. Admin can add or correct the address on the supplier's page.
- **Supplier** — the "can you replace?" notification **also asks for a return address**, but only if they have none. Their case card now shows the
  **return tracking number** the hub entered (`returnTrackingNumber`), and only when the unit was actually sent back (not when it was discarded).
- **Never the buyer** — the address is not in any order data a buyer or guest receives (tested).

**Tested:** `apps/admin-dashboard/src/returnAddress.integration.test.js` (10, real backend) — verified to fail when suppliers could write each other's address,
when the hub stops receiving the address, and when the "no return address" nudge is sent unconditionally.

## Tracking numbers: which one the buyer sees

An order has **two** tracking numbers for two different legs, and they were being mixed up:

| Number | Leg | Entered by | Who sees it |
|---|---|---|---|
| `supplier_sub_orders.tracking_number` | supplier → inspection hub (usually domestic) | the supplier, when they mark the order shipped | admin (labelled "Supplier → hub") and the supplier |
| the `shipped_to_buyer` hub event's `tracking_number` | inspection hub → buyer | hub staff, when they ship the parcel onward | the buyer, and admin (labelled "Hub → buyer") |

- **`GET /order/:id`** — for a **buyer or guest**, `supplierSubOrders[].trackingNumber` is now the **hub's** number (null until the hub ships), and the
  supplier's number is never in the response. For an **admin**, `trackingNumber` is still the supplier's and the new `hubTrackingNumber` is the hub's.
- **The "your order has shipped" notification and email now fire when the HUB ships to the buyer**, carrying the hub's number. Before, they fired when
  the *supplier* shipped to the hub — too early, and with the supplier's domestic number. The supplier's step now notifies "on its way to our
  inspection hub" with no tracking number, and sends no email.
- **Internal hub events are hidden from buyers:** `returned_to_supplier` / `discarded_at_hub` (a faulty unit going back — its return tracking number and
  notes) are omitted from a buyer's order data; admin still sees them.
- The live-tracking feature (`/order/:id/tracking`) already used the hub's number.
- The mobile app reads the same `trackingNumber` field, so it should show the hub's number without an app change (not testable here).

**Tested:** `apps/admin-dashboard/src/trackingNumbers.integration.test.js` (5, real backend) — verified to fail when the buyer gets the supplier's
number, when the return step is visible to buyers, and when the hub's shipping step stops sending the notification. The "shipped" email is best-effort
and goes to the backend log when email isn't configured; it is not asserted by a test.

## Hub staff accounts (migration 089)

**The gap this closes:** until now nothing could create a hub staff login. Public sign-up only makes buyers, the admin "Team" feature
only makes admins, and the only hub login was the dev seed's `hub@leap.dev`. The admin dashboard's Hubs page now has a "Hub staff"
section backed by `/hub-staff` (`src/modules/hub-staff/routes.js`).

**Who can use it:** any admin with access to the **Hubs** page (`requirePageAccess('hubs')`) — the same people who already create hubs
and assign shipments to them. Hub staff, suppliers, buyers and admins without that permission get 403. Hub staff can mark shipments
received and shipped, which feeds payouts, so every action is written to the audit log (`hub_staff_created`, `_updated`, `_disabled`,
`_enabled`, `_password_reset`). The temporary password is never in the audit details.

| Endpoint | What it does |
|---|---|
| `GET /hub-staff` | List all hub staff: name, email, hub, active/disabled, last activity (their most recent shipment action). Never returns a password or hash. |
| `POST /hub-staff` `{ email, name, hubId }` | Create. Returns `{ staff, temporaryPassword }`. Duplicate email (any letter case) → 409. |
| `PATCH /hub-staff/:id` `{ name?, hubId? }` | Rename, or move to another hub. |
| `POST /hub-staff/:id/disable` / `/enable` | Soft, reversible, idempotent. |
| `POST /hub-staff/:id/reset-password` | New random temporary password, returned once. The old one stops working. |

Every query is restricted to `role = 'hub_staff'`, so these routes cannot touch an admin, supplier or buyer account (a non-hub-staff id is a 404).

**Design decisions (and why):**
- **Disable, never delete.** Every `hub_shipment_events.performed_by` references the user who did the work.
- **Disabling is immediate.** Logins last 7 days and `requireAuth` used to trust the token alone. For `hub_staff` only, `requireAuth` now does a
  live database check each request (the same principle `requirePageAccess` already uses for admin permissions). A disabled or removed account
  gets **401** `account_disabled`, which the hub portal and hub app already treat as "log out". Buyers, suppliers and admins are unchanged.
  Login itself answers a disabled account with **403** `account_disabled` — but only *after* the password checks out, so a wrong password
  never reveals that an account exists or is disabled.
- **Moving a person to another hub is immediate too.** The hub is read from the database on each request rather than from the token, so an
  existing session follows the move on its next action instead of staying on the old hub's shipments for up to 7 days.
- **The server generates the temporary password** (14 characters from an unambiguous alphabet — no 0/O or 1/l/I). It is returned once, stored
  only as a bcrypt hash, and never returned by `GET`. Email isn't configured in every environment, so an emailed reset link can't be the only way in.

**Known limits:** a password reset does **not** end a login the person already has open (up to 7 days); disabling does. There is no forced
password change on first login, and I have not checked whether the hub portal or hub app has a change-password screen. One account belongs
to one hub. `optionalAuth` does not run the live check: it is used only by buyer/guest-facing routes (orders, cart, returns, support, bug
reports — none of them hub routes), so a disabled person's old token is still accepted there until it expires. I have not audited what that
allows on those routes.

**Tested:** `apps/admin-dashboard/src/hubStaff.integration.test.js` (9, real backend) and `HubStaffFlow.test.jsx` (8, mocked fetch, real
component tree). The immediate-cutoff and hub-move tests were verified to FAIL when the live check is removed from `requireAuth`.

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
