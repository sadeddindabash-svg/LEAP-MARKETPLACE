# Leap Core API

Backend services shared by the buyer app, admin dashboard, and supplier
portal. See `/docs/SRS.docx` Section 6 (Architecture) and Section 7 (Data
Requirements).

## Status

This is a **starter skeleton** with working in-memory implementations —
enough to develop the frontend apps against locally. It has been run and
tested end-to-end (see below); it is **not** production-ready:

- Data is stored in memory and resets on every restart — no real database yet.
- No authentication/authorization is enforced yet.
- Payment module returns fake payment intents — no real gateway is wired up.
- No automated tests yet (there's an npm test script, but no test files).

## Verified working

Every endpoint below was actually run and exercised during scaffolding:

```
GET  /health
GET  /catalog/products
GET  /catalog/products?category=brake&vehicleId=v1
GET  /fitment/vehicles
GET  /fitment/makes
POST /cart/:cartId/items
GET  /cart/:cartId
POST /order              — including guest checkout (guestEmail, no userId)
                            and correct splitting into per-supplier sub-orders
GET  /order/:id
POST /payment/methods
POST /payment/intent
POST /user/guest-claim
POST /notification/send
```

## Payment gateways

- **Stripe**: real integration (`stripe.paymentIntents.create`). Handles
  Stripe's documented zero-decimal currencies correctly (Chile/CLP,
  Paraguay/PYG). Not yet live-tested — see `src/modules/payment/routes.js`
  header comment.
- **Amazon Payment Services (APS)**: real request-signing integration
  (the business's existing gateway). See
  `src/modules/payment/providers/amazonPaymentServices.js` for the full
  "verify before production" checklist — the signing algorithm is
  implemented and unit-tested, but the live endpoint URL and field names
  are not yet confirmed against Amazon's current docs, and no live call has
  been made (no network access to Amazon's API from the environment this
  was built in).
- **PayPal / Google Pay**: still placeholders, no real SDK wired up.

Example — placing a guest order with items from two different suppliers
correctly splits into two supplier sub-orders while returning one order ID:

```bash
curl -X POST http://localhost:4000/order \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":2},{"productId":"p4","quantity":1}],"guestEmail":"buyer@example.com"}'
```

## Setup

```bash
cd services/api
cp .env.example .env   # fill in real values as they become available
npm install
npm run dev             # auto-restarts on file changes
# or: npm start
```

Server listens on `http://localhost:4000` by default (override with `PORT`
in `.env`).

## Structure

```
src/
├── index.js              Express app bootstrap, mounts all modules
├── config/env.js          Centralized environment variable access
├── middleware/errorHandler.js
└── modules/
    ├── catalog/           Products & categories (BUY-020–025, SUP-010–015)
    ├── fitment/            Year/Make/Model/Trim reference data (BUY-010)
    ├── cart/               Multi-supplier cart (BUY-030–032)
    ├── order/              Order placement + supplier sub-order splitting
    │                       (BUY-031, BUY-050–053) + guest checkout
    ├── user/               Accounts, incl. guest-order account claiming
    ├── payment/            Gateway-agnostic payment abstraction (BUY-040–044)
    └── notification/       SMS/email/push stub (BUY-051, SUP-032)
```

## Next steps to make this real

1. Replace in-memory `Map`/array storage in each module with a real
   database (PostgreSQL is a reasonable default given the relational data
   in SRS Section 7.1 — orders, sub-orders, products, fitment mappings).
2. Add authentication (JWT is scaffolded via `env.jwtSecret` but not yet
   enforced on any route).
3. Wire the payment module to real Stripe/PayPal/Google Pay SDKs once
   merchant accounts are provisioned (see Charter Section 4).
4. Add real tests under `test/` (the `npm test` script expects them there).
5. Replace the `PRODUCT_SUPPLIER` lookup stub in `modules/order/routes.js`
   with a real join against the catalog module/database.
