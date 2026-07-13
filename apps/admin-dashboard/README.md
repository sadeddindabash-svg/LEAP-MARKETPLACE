# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication and three real pages** (Orders, Suppliers,
Moderation) — full UI → API → database → UI slices. Payouts and Tickets
pages are still mock data.

## Authentication (ADM-030)

- `src/LoginPage.jsx` — real login form calling `POST /auth/login`.
- `src/App.jsx` exports `LeapAdminApp`, an auth gate: checks for a saved
  token on load (verifying it against `GET /auth/me`, not just trusting
  localStorage), shows `LoginPage` if not authenticated **or if the
  logged-in account isn't an admin** (buyer accounts are correctly
  rejected here, even with valid credentials), otherwise renders the real
  dashboard (`AdminDashboardShell`).
- Token stored in `localStorage` (see `src/auth.js`) — fine for a web SPA,
  unlike the mobile app which uses secure device storage instead.
- Sidebar footer now shows the real logged-in admin's name/email and a
  working logout button (previously hardcoded "3 teammates online").

**Known gap**: the `TopBar` component (shown at the top of every page)
still has a hardcoded "Omar M. / Ops Admin" placeholder — it wasn't wired
to the real logged-in user because that would require threading the user
down through every page component or introducing React Context, which felt
like scope creep for this pass. Worth fixing before this ships anywhere
real; see the comment above `TopBar` in `App.jsx`.

### Getting a real admin login to test with

The backend seeds a dev admin account — run `node db/seed.js` in
`services/api` (see that folder's `db/README.md`), then log in here with:
```
admin@leap.dev / admin_dev_password_123
```
**Change this password before any shared or production use** — it's
printed in plaintext in the seed script, which is fine for a disposable
local dev database and not fine for anything else.

## Setup

```bash
cd apps/admin-dashboard
npm install
cp .env.example .env.local   # points at your local backend
npm run dev       # http://localhost:5173
```

## Orders page (ADM-010)

The first page wired to real data end-to-end:

- `GET /order` fetches every order in the system (admin-scoped server-side
  — see the auth work) and replaces the old hardcoded `ORDERS` mock array,
  which has been deleted, not just unused.
- Clicking a row fetches full detail via `GET /order/:id`, showing real
  supplier sub-orders, tracking numbers, and line items — not the
  fake "Fulfilling" badge and invented timeline dates the mock version had.
- Handles loading and error states, and **automatically logs the admin out
  if a request comes back 401** (expired/invalid session) rather than
  showing a broken or empty page.
- Status badges (`ORDER_STATUS_META`) were expanded to cover every status
  value the real backend actually uses (`to_pay`, `to_ship`, `returns` were
  missing before and would have crashed on an unmapped status) — plus a
  `getOrderStatusMeta()` fallback so an unexpected future status renders
  gracefully instead of throwing.
- **Columns changed from the mock version**: "Country", "Supplier(s)", and
  "Payment" columns were removed from the list view because that data
  isn't tracked/joined yet on the backend (payment_transactions exists in
  the schema but isn't linked to orders in an endpoint yet) — shown as
  real fields that exist (buyer, total, placed date, status) rather than
  keeping fake-looking columns with no real data behind them.

## Suppliers page (ADM-001)

Second page wired end-to-end, same recipe as Orders:

- `GET /supplier` (admin-only) lists every supplier with a real, live-joined
  listing count (`COUNT` against `products`, not a stored/stale number).
- Approve/Reject buttons call `PATCH /supplier/:id/verify` and re-fetch the
  list afterward — real persistence, confirmed by a test that independently
  re-fetches after the change rather than just trusting the PATCH response.
- **Columns changed from the mock version**: dropped "Rating" and
  "Fulfillment SLA" — those would require aggregating real review/delivery
  history that doesn't exist yet (no reviews table, no delivery-outcome
  tracking). Showing fabricated numbers there would have been worse than
  not showing them at all. Contact email is real (new `contact_email`
  column, migration 004) but only populated for suppliers seeded/updated
  after that migration — existing dev-database rows may show "—" until
  updated.
- Role enforcement is real too: a buyer account correctly gets a 403 from
  both endpoints, not just a UI that assumes only admins would click there.

## Moderation page (ADM-002)

Third page wired end-to-end. Kept in `services/api/src/modules/catalog/routes.js`
rather than a new module, since it operates entirely on the `products`
table that module already owns.

- `GET /catalog/moderation-queue` (admin-only) lists products with
  `status = 'translating'` (awaiting review before going live to buyers).
- **Flags are computed live from real data, not fabricated**: "Missing
  fitment data" (zero rows in `product_fitment` for that product) and
  "New supplier" (the supplier account is less than 30 days old). The old
  mock version's "Translation pending review" flag was dropped — it was
  redundant (being in this queue at all already means that) and adding it
  back as a fake flag would have added nothing real.
- `PATCH /catalog/products/:id/moderate` sets the product to `active`
  (approve) or `inactive` (reject) — confirmed to actually move the
  product in/out of both the moderation queue and the normal buyer-facing
  catalog, not just update a status label.
- Dropped the "Preview" button from the mock version — it never did
  anything even in the mock UI (no real modal/preview existed behind it),
  so removing it is honest rather than a regression.

## Testing

```bash
npm test
```

Eight test files, 35 tests total, all passing:
- `src/App.test.jsx` (7, mocked) — auth flows
- `src/auth.integration.test.js` (4, REAL backend) — login/session
- `src/orders.integration.test.js` (4, REAL backend) — order list/detail
- `src/OrdersFlow.test.jsx` (3, mocked, full component tree) — orders UI flow
- `src/suppliers.integration.test.js` (5, REAL backend) — supplier list
  with real listing counts, a full reject→verify round-trip confirmed by
  independently re-fetching afterward, invalid-status rejection, and
  confirms a buyer account is rejected by the backend itself (not just
  hidden in the UI)
- `src/SuppliersFlow.test.jsx` (3, mocked, full component tree) — logs in,
  navigates to Suppliers, approves a pending one and confirms the row
  updates, and confirms a 401 during the approve action triggers automatic
  logout
- `src/moderation.integration.test.js` (6, REAL backend, with direct DB
  access for test setup/teardown only) — confirms real, correctly-computed
  flags on a known product, and a full approve/reject round-trip
  confirmed by independently re-fetching the queue afterward
- `src/ModerationFlow.test.jsx` (3, mocked, full component tree) — renders
  real computed flags (and confirms the old fake "Translation pending
  review" flag is gone), approving removes the item from view, and a 401
  during the action triggers automatic logout

The `*.integration.test.js` files use a real (persistent, not per-test-run)
local dev database, so the supplier round-trip test is written to be
self-contained regardless of what a previous run left the data in — worth
knowing if you add more integration tests against mutable data.

**Pre-requisite for a truly fresh database**: `orders.integration.test.js`
assumes at least one order already exists (it asserts the order list is
non-empty). Running `db/seed.js` alone does NOT create any orders — place
one first, e.g.:
```bash
curl -X POST http://localhost:4000/order -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":1}],"guestEmail":"test@example.com"}'
```

`moderation.integration.test.js` connects directly to the same Postgres
database (`postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev`,
hardcoded — update it if your local setup differs) to reset a known
product's status before/after each test. This only works if `db/seed.js`
has been run at least once (it needs product `p9` to exist).

## Next steps to make this real

1. Wire the `TopBar`'s hardcoded user display to the real logged-in admin
   (see "Known gap" above).
2. Split `src/App.jsx` into separate files under `src/pages/` and
   `src/components/` — it currently works as one large file (that's how
   the prototype was authored) but should be broken up before more people
   work on it.
3. Replace remaining mock data (`PAYOUTS`, `TICKETS` arrays) with real
   fetches, following the same pattern as Orders, Suppliers, and
   Moderation. Each needs a matching backend endpoint first (none exist yet).
4. Add the missing backend endpoints: payouts, support tickets.
5. Consider code-splitting (the build currently warns about a >500kB bundle)
   once real routing is introduced — e.g. React Router with lazy-loaded pages.
