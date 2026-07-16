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
    │                       overview KPIs (SUP-001–022)
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
    │                       enforcement, local-disk storage for now (see
    │                       that module's header comment on real object
    │                       storage being the production-ready next step);
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
    ├── payment/            Stripe, Amazon Payment Services, PayPal, and
    │                       Google Pay (routed through Stripe) — BUY-040–044
```

## Next steps to make this real

1. Wire a real email provider (see the notification module and Charter
   Section 4) so password reset actually delivers a link instead of
   logging it to the server console, and add email verification on signup.
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
