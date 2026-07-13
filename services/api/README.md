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
    ├── fitment/            Year/Make/Model/Trim reference data (BUY-010)
    ├── cart/               Multi-supplier cart (BUY-030–032), incl. a
    │                       PATCH endpoint for exact-quantity updates
    ├── order/              Order placement + supplier sub-order splitting
    │                       (BUY-031, BUY-050–053) + guest checkout
    ├── user/               Accounts, incl. guest-order account claiming
    ├── supplier/            Admin-facing supplier list/verify (ADM-001) AND
    │                       supplier-facing "me" endpoints — own profile,
    │                       products, order fulfillment (SUP-001–022)
    ├── support/             Support tickets — admin AND buyer-facing
    │                       "my-tickets" endpoints (BUY-060–061, ADM-012)
    ├── returns/             Return/dispute cases with SEPARATE buyer,
    │                       supplier, AND admin views into two message
    │                       threads (BUY-053, SUP-030)
    ├── payment/            Stripe, Amazon Payment Services, PayPal, and
    │                       Google Pay (routed through Stripe) — BUY-040–044
    └── notification/       SMS/email/push stub (BUY-051, SUP-032)
```

## Next steps to make this real

1. Add password reset and email verification (no email provider is wired
   up yet — see the notification module and Charter Section 4).
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
