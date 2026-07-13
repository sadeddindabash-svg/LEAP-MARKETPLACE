# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication AND a real Orders page** — the first full
UI → API → database → UI slice of this app. Suppliers, Moderation,
Payouts, and Tickets pages are still mock data.

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

## Testing

```bash
npm test
```

Four test files, 18 tests total, all passing:
- `src/App.test.jsx` (7, mocked) — login/logout/session-restore auth flows
- `src/auth.integration.test.js` (4, REAL backend) — login/session round-trip
- `src/orders.integration.test.js` (4, REAL backend) — fetches the real
  order list and real order detail (including real supplier sub-orders and
  line items) as an authenticated admin; confirms unauthenticated/garbage
  token requests are rejected
- `src/OrdersFlow.test.jsx` (3, mocked, full component tree) — logs in,
  navigates to Orders, confirms real (not hardcoded) order data renders,
  opens an order and sees real supplier/line-item data, and confirms a 401
  on the orders request triggers automatic logout back to the login screen

The `*.integration.test.js` files auto-skip if `services/api` isn't running
locally, so they won't break a CI run without a database available — but
when they do run, they're the strongest evidence this actually works, since
nothing is mocked.

## Next steps to make this real

1. Wire the `TopBar`'s hardcoded user display to the real logged-in admin
   (see "Known gap" above).
2. Split `src/App.jsx` into separate files under `src/pages/` and
   `src/components/` — it currently works as one large file (that's how
   the prototype was authored) but should be broken up before more people
   work on it.
3. Replace remaining mock data (`SUPPLIERS`, `MODERATION_QUEUE`, `PAYOUTS`,
   `TICKETS` arrays) with real fetches, following the same pattern as
   Orders. Each needs a matching backend endpoint first (none exist yet).
4. Add the missing backend endpoints: suppliers, catalog moderation queue,
   payouts, support tickets.
5. Consider code-splitting (the build currently warns about a >500kB bundle)
   once real routing is introduced — e.g. React Router with lazy-loaded pages.
