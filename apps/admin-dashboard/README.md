# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication and six real pages** (Overview, Orders,
Suppliers, Moderation, Support Tickets, Returns — Returns is entirely new,
not in the original prototype at all) — full UI → API → database → UI
slices. Payouts is still mock data (blocked on undecided commission rates
— see Charter Section 1 — rather than a technical gap).

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

## Overview page

The dashboard's landing page — first one wired to real data, along with
Orders, in this round of updates.

- `GET /overview` (admin-only) aggregates real counts across the whole
  platform: total orders, active/pending suppliers, open disputes, open
  tickets, a 7-day order-count trend, units sold by category, and top
  suppliers by order volume.
- **Deliberately does NOT show a blended dollar GMV figure** — the
  original mock showed a fake "$171,450 GMV (7 days)" number. Orders span
  26+ currencies across the 40 confirmed launch markets, and this system
  has no FX/exchange-rate conversion anywhere. Summing raw order totals
  across currencies would produce a real-looking number that's actually
  meaningless (a USD total plus a SAR total is not a dollar amount). Used
  order **counts** instead everywhere a dollar figure would need FX
  conversion that doesn't exist yet.
- **Deliberately does NOT show "top markets by country"** either — the
  `orders` table has no country field (only `currency_code`, which isn't
  a reliable proxy for country). Replaced with "top suppliers by order
  volume," which is real and directly trackable from existing data.
- **Dropped entirely**: the mock's "$19.8k in payouts scheduled" row —
  there is no payouts feature in this codebase (blocked on the
  commission-rate decision, same as the Payouts page itself). Showing a
  fake payout figure here would be worse than omitting it.
- Verified with a test that specifically checks the response never
  includes a `gmv` or `topMarkets` field at all — proving the "no fake
  aggregate numbers" decision is enforced by the backend, not just a
  frontend choice not to display fields that exist.

## Orders page (ADM-010)

The first page wired to real data end-to-end:

- `GET /order` fetches every order in the system (admin-scoped server-side
  — see the auth work) and replaces the old hardcoded `ORDERS` mock array,
  which has been deleted, not just unused.
- Clicking a row fetches full detail via `GET /order/:id`, showing real
  supplier sub-orders, tracking numbers, and line items — not the
  fake "Fulfilling" badge and invented timeline dates the mock version had.
- **`GET /order/:id` used to be a real security hole** (fully open —
  order IDs are sequential and guessable) — this was flagged early on
  and fixed in a later pass without breaking this admin flow: an admin
  token still gets full access, verified by a dedicated test
  (`src/orderSecurity.integration.test.js`) that specifically confirms
  this page's exact API calls still work after the fix, not just that
  the fix exists in isolation.
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

## Support Tickets page (ADM-012, BUY-060/061)

Fourth page wired end-to-end, and the first with a real new schema (not
just new endpoints on an existing table): `support_tickets` and
`support_ticket_messages` (migration 005).

- `POST /support/tickets` — buyer (authenticated) or **guest** (no auth
  required, matching the guest-checkout pattern) can raise a ticket.
- `GET /support/tickets` (admin-only) — every ticket, newest-updated first.
- `GET /support/tickets/:id` (admin-only) — full message thread.
- `POST /support/tickets/:id/messages` (admin-only) — reply; **automatically
  transitions the ticket from `open` to `in_progress`** the first time an
  admin replies, confirmed by a test that checks the status changed as a
  side effect of replying, not just that the message was added.
- `PATCH /support/tickets/:id` — explicit status change (open/in_progress/resolved).
- **No buyer↔supplier messaging path exists here, by explicit business
  requirement** (SRS Section 2.5) — every message is buyer/guest ↔ platform
  staff only.
- **Gap closed in a later pass**: buyer-side viewing/continuing of their
  own ticket is now real too — `GET /support/my-tickets`,
  `GET /support/my-tickets/:id`, `POST /support/my-tickets/:id/messages`
  (login required; guest-created tickets aren't viewable without an
  account, same limitation as guest order history). Wired into the mobile
  app's support screen — see `apps/mobile/README.md`. Confirmed a second
  buyer can never see the first buyer's ticket, in the list or by direct
  ID (404, not filtered) — see `src/buyerGaps.integration.test.js`.

**A real bug I caught before it shipped**: the ticket-ID sequence
(`ticket_id_seq`) originally started at the same number as the hardcoded
seed ticket IDs (`T-5500`), so the very first ticket created after seeding
would fail with a duplicate-key error. Fixed by starting the sequence past
the seeded range — see the comment in `db/migrations/005_support_tickets.sql`.

## Returns & Disputes page (new — not in the original prototype at all)

This page didn't exist in the reference prototype — it was added from
scratch, backend and frontend together, because SRS BUY-053/SUP-030
describe a real return/dispute-handling requirement that had no
implementation anywhere in the project until now.

- **Two structurally separate message threads per case** — buyer↔admin
  and supplier↔admin — not one shared thread. This is the single most
  important design decision in this feature: the "no direct
  buyer↔supplier contact" business rule (the same one enforced in the
  support-tickets and order modules) is enforced by the *data model
  itself* here, not just by what the UI happens to display. There is no
  query in `services/api/src/modules/returns/routes.js` that can return
  one party's messages to the other, even by accident — see that file's
  header comment and `db/migrations/007_return_cases.sql`.
- `GET /returns` (admin-only, full list), `GET /returns/:id` (admin-only,
  both threads), `POST /returns/:id/buyer-messages` and
  `POST /returns/:id/supplier-messages` (admin replies into one thread or
  the other — never both from a single action), `PATCH /returns/:id`
  (status: awaiting/in_progress/approved/rejected/completed).
- `ReturnCaseDetailPage` shows both threads side by side for the admin
  (who is the only party allowed to see both) with a visible note
  explaining the thread separation to whoever's looking at the screen.
- **A real bug caught the same way as the ticket-ID one**: the
  `return_case_id_seq` sequence and the seed script's hardcoded `RC-3400`
  case ID had the identical collision risk — fixed proactively in the
  same migration this time, having learned the pattern from the tickets
  bug (see the comment in `db/migrations/007_return_cases.sql`).
- Also exposed `subOrderId` in the order module's create/detail responses
  (`services/api/src/modules/order/routes.js`) — needed so a return
  request can reference which specific supplier's portion of an order
  it's about; this field didn't exist in the API before this feature
  needed it.
- **Added in a later pass**: buyer-side viewing too —
  `GET /returns/my-cases`, `GET /returns/my-cases/:id`,
  `POST /returns/my-cases/:id/messages` (login required). Symmetric with
  the supplier-facing isolation: a buyer's own view shows only their
  buyer↔admin thread, never the supplier↔admin thread — confirmed by a
  test that checks the supplier thread's message text is absent from
  `JSON.stringify()` of what the buyer can fetch. Wired into the mobile
  app — see `apps/mobile/README.md`.

## Testing

```bash
npm test
```

Sixteen test files, 84 tests total, all passing:
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
- `src/tickets.integration.test.js` (10, REAL backend, self-contained —
  each test creates its own ticket via the real API rather than depending
  on seeded data) — guest ticket creation with no auth, validation
  rejections, admin-only access enforcement, and the auto-transition from
  `open` to `in_progress` on first admin reply
- `src/TicketsFlow.test.jsx` (3, mocked, full component tree) — renders
  real tickets, opens one and sends a real reply that appears in the
  thread, and a 401 during reply triggers automatic logout
- `src/returns.integration.test.js` (7, REAL backend, self-contained) —
  a non-admin is rejected, a created case appears in the admin list, full
  case detail includes the real initial buyer message, and — the two that
  matter most — confirms replying to the buyer only ever adds to the
  buyer thread (never the supplier thread) and vice versa, checked by
  inspecting both thread lengths after each action, not just that the
  intended message landed somewhere.
- `src/buyerGaps.integration.test.js` (5, REAL backend) — closes the
  "buyer can't view their own ticket/return case" gap flagged in earlier
  passes: a buyer creates and views their own ticket, a second buyer
  can't see the first buyer's ticket (in the list or by direct ID — 404,
  not filtered), a buyer's follow-up and an admin's reply both show up
  correctly in the buyer's own view, and — the one that matters most — a
  buyer viewing their own return case never sees the supplier thread,
  confirmed the same way as the admin-side test: checking the actual
  string is absent from the response, not just that the UI wouldn't
  display it.
- `src/orderSecurity.integration.test.js` (7, REAL backend) — proves the
  `GET /order/:id` security fix (see "Orders page" above): an anonymous
  request to a real order returns 404 with no `guestEmail` param and with
  the wrong one, succeeds with the correct one, a second buyer can never
  see the first buyer's order, the owning buyer can always see their own,
  and — the one that matters most for not breaking anything real — an
  admin can still see any order, confirmed against the same endpoint the
  admin dashboard's Orders page actually calls.
- `src/overview.integration.test.js` (5, REAL backend) — confirms
  unauthenticated and non-admin access are both rejected, checks the
  response shape matches what the real UI reads, and — the one that
  proves the "no fake GMV" design decision is real, not just a frontend
  choice — asserts the response has NO `gmv` or `topMarkets` field at
  all. Also confirms placing one real order increases `totalOrders` by
  exactly one, and that `topSuppliers` is genuinely sorted by real order
  count.
- `src/OverviewFlow.test.jsx` (3, mocked, full component tree) — renders
  real counts and confirms the old hardcoded mock numbers (`$171,450`,
  `2,384`) are completely gone, renders real supplier names in place of
  the old fake country list, and confirms a 401 triggers automatic logout.
- `src/garage.integration.test.js` (9, REAL backend) — tests the
  buyer-facing "My Garage" feature (mobile app UI, backend endpoints
  live here alongside the other buyer-facing tests): a new buyer starts
  empty, saving a real reference vehicle works, saving a nonexistent one
  404s, saving the same vehicle twice is idempotent, removal is confirmed
  by independent re-fetch, a second buyer never sees the first buyer's
  saved vehicles, and — testing the no-op-not-error design deliberately —
  one buyer deleting a vehicle from a DIFFERENT buyer's garage succeeds
  with 200 but has zero actual effect.

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

`moderation.integration.test.js` connects directly to Postgres (via
`DATABASE_URL` from the environment — matching whatever the actual
backend server under test is using, with a `leap_marketplace_dev`
fallback for plain local dev) to reset a known product's status
before/after each test. This only works if `db/seed.js` has been run at
least once (it needs product `p9` to exist).

**A real bug this used to have, found by the standard clean-merge
verification process** (not by inspection): this connection string was
originally hardcoded to `leap_marketplace_dev`, which broke silently
whenever the backend under test was pointed at a differently-named
database — the reset query would succeed, just against the wrong
database, leaving the real target's data stale and causing two
assertions to fail in a way that looked unrelated to the actual cause.
Fixed to read `DATABASE_URL` from the environment; if you add a test file
that opens its own direct DB connection, make sure it does the same
rather than hardcoding a database name.

`passwordReset.integration.test.js` follows this same pattern correctly
from the start (it needs a direct DB read to fetch a reset token, since
there's no email inbox a test can check — see that file's comment). But
reading `DATABASE_URL` from the environment only helps if it's actually
**set** in the shell you run `npm test` from — it is NOT automatically
inherited from the backend server's own `.env` file, since that's a
separate process. If you're testing against a non-default database name,
export it before running tests, e.g.:
```bash
DATABASE_URL="postgresql://leap_dev:leap_dev_password@localhost:5432/your_db_name" npm test
```
Forgetting this looks identical to the original hardcoding bug (tests
fail against a differently-named database) even though the code itself
is correct — worth knowing so you don't chase a phantom bug.

## Next steps to make this real

1. Wire the `TopBar`'s hardcoded user display to the real logged-in admin
   (see "Known gap" above).
2. Split `src/App.jsx` into separate files under `src/pages/` and
   `src/components/` — it currently works as one large file (that's how
   the prototype was authored) but should be broken up before more people
   work on it.
3. Replace the remaining mock `PAYOUTS` data with a real fetch — blocked
   on the commission-rate decision (Charter Section 1), not a technical gap.
4. Add the missing backend endpoints for payouts once commission rates
   are decided.
5. Consider code-splitting (the build currently warns about a >500kB bundle)
   once real routing is introduced — e.g. React Router with lazy-loaded pages.
