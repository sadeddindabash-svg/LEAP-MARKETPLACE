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
    │                       storage being the production-ready next step)
    ├── payment/            Stripe, Amazon Payment Services, PayPal, and
    │                       Google Pay (routed through Stripe) — BUY-040–044
    └── notification/       SMS/email/push stub (BUY-051, SUP-032)
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
