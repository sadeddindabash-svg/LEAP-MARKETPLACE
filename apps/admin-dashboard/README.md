# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication and eleven real pages** (Overview, Orders,
Suppliers, Moderation, Support Tickets, Returns, Vehicle Data, Hubs,
Pricing, Flagged Shipments, Categories — all but the first three are
entirely new, not in the original prototype at all) —
full UI → API → database → UI slices. Payouts is still mock data
(blocked on undecided commission rates — see Charter Section 1 — rather
than a technical gap).

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
  fitment data" and "New supplier" (the supplier account is less than 30
  days old). The old mock version's "Translation pending review" flag was
  dropped — it was redundant (being in this queue at all already means
  that) and adding it back as a fake flag would have added nothing real.
  **Fixed a real bug while building the structured product submission
  feature**: this flag was checking the OLD `product_fitment` table,
  which real supplier submissions never populate (they use the new
  `product_fitment_entries` cascade table, migration 010) — every new
  submission was showing "Missing fitment data" regardless of whether it
  actually had fitment info. Fixed to check the right table.
- **Translation review workflow** (new): the queue now shows the
  supplier's real Chinese original (`nameZh`, `descriptionZh`) and real
  uploaded photos, not just a name and category. Clicking "Review &
  Approve" opens an inline panel (pre-filled with the Chinese text as a
  starting point) with FOUR real fields — English name/description and
  Arabic name/description (the Arabic inputs use `dir="rtl"` for correct
  right-to-left typing) — requiring BOTH a real English name AND a real
  Arabic name before "Confirm Approval" does anything.
  `PATCH /catalog/products/:id/moderate` now REJECTS an approve action
  missing either one, reporting whichever is actually missing, matching
  the confirmed business requirement (the 40-country launch list
  includes the entire GCC plus Jordan) that neither translation is
  optional. Rejecting still doesn't need a translation, since the
  listing never goes live either way. See
  `services/api/README.md`'s "Arabic translation" section for the full
  design reasoning, including why the customer-facing language switcher
  is a deliberately separate, later phase.
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

## Vehicle Data page (new — not in the original prototype at all)

A real, necessary gap closed while building the structured supplier
product submission feature (see `services/api/README.md`): that
feature's cascading Brand→Model→Generation→Engine/Transmission picker
would otherwise be permanently stuck with whatever 3 brands and 4 models
were hardcoded into `db/seed.js` — no supplier could ever submit a
product for a vehicle not on that short list, and no admin had any way
to add one.

- Drill-down navigation (Brands → Models → Generations → Engines &
  Transmissions side by side) with a clickable breadcrumb to go back up,
  rather than one giant flat page — matches how deep the real cascade
  actually is.
- Every add/remove is real: `POST`/`DELETE` against the same
  `/fitment/...` endpoints the supplier portal's Add Product form reads
  from. Adding a brand here is immediately visible there — verified,
  not assumed.
- **Deletion protection is the important part, not the button itself**:
  removing a generation, engine, or transmission that a REAL product
  actually references is refused with a clear message ("remove those
  products first"), not silently allowed (which would orphan real
  product data) and not a raw database error leaking through. Deleting a
  brand or model DOES cascade to its own unreferenced children — only
  real product references block a delete, not organizational nesting.
- Verified with a fully self-contained test: creates its own real
  brand/model/generation, attaches a genuine product to it via the real
  supplier submission endpoint, then confirms deleting that generation is
  refused — not by relying on another test file's leftover state, which
  would only work by coincidence depending on test run order.

## Hubs page (new — not in the original prototype at all)

Real, admin-only management of regional inspection hub locations — the
physical facilities that now sit between every supplier and every buyer
(see `services/api/README.md`'s "Inspection hubs" section for the full
business rule and backend design). Simpler than Vehicle Data (no
drill-down levels — hubs don't have sub-levels), but the same
real-data-with-real-protection pattern: `POST`/`DELETE /hub/locations`,
and deleting a hub that real staff accounts or shipments still
reference is refused with a clear message, not silently allowed or a
raw database error.

## Hub assignment on the Order detail page (new)

Each supplier sub-order on the Order detail page (see "Orders page"
above) now shows a real `HubAssignmentPanel`:

- **If no hub is assigned yet**: a real picker, populated from
  `GET /hub/locations`. This isn't cosmetic — a supplier genuinely
  cannot mark their leg 'shipped' until an admin assigns one here (see
  the backend section for why).
- **If a hub is assigned**: the real hub name, the real current status
  of that leg's journey (`awaiting_receipt` through `shipped_to_buyer`,
  or `flagged`), and an expandable "View evidence" section showing the
  complete real audit trail — every step, its notes, its photos, who
  performed it, when. This is the same data the hub portal itself shows
  its own staff; an admin doesn't need to ask what happened, it's
  already here.

**A real bug found and fixed while building this** (not by inspection —
by testing the actual interactive assign action, not just how the page
looks with pre-assigned data already in place): without a stable `key`
tied to the assignment state, `HubAssignmentPanel` didn't reliably
re-render to reflect a hub that was JUST assigned via the picker — it
could keep showing the "no hub assigned" picker even after a successful
assignment, until something else forced a fuller re-render. Fixed by
keying the component on `so.hubId || "unassigned"` so React cleanly
remounts it exactly when the fundamental mode (unassigned vs. assigned)
changes. Confirmed by testing the FULL interactive flow — select a hub,
click Assign, and verify the assigned view actually appears — not just
testing the two render states in isolation, which would have missed
this entirely.

## Pricing page (new — not in the original prototype at all)

Real, admin-only management of the equation that computes every
buyer-facing USD price from a supplier's RMB cost — see
`services/api/README.md`'s "Real pricing engine" section for the full
backend design.

- **Exchange rate**: shows the current real rate with a badge
  distinguishing `Manual` from `Live` (no live provider is connected in
  this environment — same category of external dependency as the
  payment gateways), and a real inline field to update it.
- **Fee components**: every fee (Leap Platform Fee, Bank Fee, Shipping
  Fee, Local Transport Fee, Overhead Fee, Customs Duty, VAT, Payment
  Gateway Fee, FX Margin, Insurance — 10 real seeded defaults, all
  editable) shown in application order, with an inline-editable value,
  an Active/Inactive toggle (disable a fee without losing its
  configuration), delete, and a real "Add fee" form supporting all three
  real fee types (percentage, flat RMB, or shipping-volumetric RMB/kg).
- **Preview calculator**: enter a hypothetical RMB cost and
  weight/dimensions and see the REAL full step-by-step breakdown
  (calling the real `POST /pricing/preview` endpoint) — lets an admin
  understand or sanity-check the equation without needing to create a
  real product first.
- **Confirmed design, worth restating here**: changing a fee is
  reflected immediately in every listing's LIVE browsing price — but not
  in any order that's already been placed, which locks in whatever price
  was computed at that exact moment. See the backend section for why
  that split is correct, not an oversight.

## Flagged Shipments page (new — the real answer to "where do I find a flagged issue")

Before this existed, a hub-flagged quality issue (see the Inspection
Hubs section above) was only discoverable by already knowing which
order to open — no queue, no notification, nothing surfacing it. This
page is the real fix:

- **A real sidebar badge**: the "Flagged Shipments" nav item shows a
  live count fetched from `GET /hub/flagged` (admin-only), refetched on
  every navigation so it reflects any change without needing a manual
  refresh. No badge at all when the count is zero, rather than a
  cluttered "0".
- **The queue itself**: every flagged shipment across every order (not
  scoped to one hub), showing the order ID, supplier, hub, when it was
  flagged, the real flag note, and the real evidence photo(s) — the
  same photos a customer's actual damaged/wrong part shows, not a
  placeholder. A "View order" button jumps straight into that order's
  real detail page (reusing the same `openOrder` navigation the Orders
  page itself uses), so an admin doesn't have to search for it manually.
- A real empty state ("Nothing flagged right now") rather than a blank
  page when there's genuinely nothing to review.

## Categories page (new — a supplier now picks from a real list instead of typing free text)

Real, admin-managed major categories and the specific parts that belong
to each one — see `services/api/README.md`'s "Category + parts
reference lists" section for the full backend design.

- **Two-level drill-down**, same structural idea as Vehicle Data (just
  two levels instead of four): the main view lists every real category;
  clicking one drills into its real parts list.
- **Real referential protection on delete**, at BOTH levels: a category
  with real products or real parts still attached refuses deletion with
  a clear message (a real bug — this used to be an uncaught database
  error, not a clear one — was found and fixed while building this, see
  the backend section); a part a real product references refuses
  deletion too.
- A real empty state on a category's parts page ("suppliers can't
  submit anything under this category until you add at least one")
  rather than a blank list that doesn't explain why nothing's there.
- Bilingual Arabic name fields (`dir="rtl"`) at both levels, same
  pattern as everywhere else Arabic input is collected in this
  dashboard.

## Testing

```bash
npm test
```

Twenty-eight test files, 167 tests total, all passing:
- `src/App.test.jsx` (7, mocked) — auth flows
- `src/auth.integration.test.js` (4, REAL backend) — login/session
- `src/orders.integration.test.js` (4, REAL backend) — order list/detail
- `src/OrdersFlow.test.jsx` (5, mocked, full component tree) — orders UI
  flow, plus real hub-assignment coverage: renders the assigned-hub view
  correctly when a hub is already assigned from the start, and — the one
  that caught the real bug described above — the full interactive flow
  of picking a hub and clicking Assign, confirming both the real API call
  contract and that the UI actually reflects it afterward. **A second
  real, intermittent bug was found and fixed here** while adding the
  Pricing feature: this file's SHARED mock router (used by most of its
  tests) never had a `/hub/locations` handler, so whenever order detail
  rendered a sub-order with no hub assigned yet (which the shared mock
  order data always has), `HubAssignmentPanel` fetched hub locations,
  got back `{}` from the generic catch-all instead of `[]`, and
  `hubs.map(...)` threw — but only asynchronously, after this test's own
  initial assertions had already run, so it surfaced as an intermittent
  failure depending on exact timing rather than a consistent one. Fixed
  by adding the missing handler; confirmed with repeated runs afterward.
- `src/suppliers.integration.test.js` (5, REAL backend) — supplier list
  with real listing counts, a full reject→verify round-trip confirmed by
  independently re-fetching afterward, invalid-status rejection, and
  confirms a buyer account is rejected by the backend itself (not just
  hidden in the UI)
- `src/SuppliersFlow.test.jsx` (3, mocked, full component tree) — logs in,
  navigates to Suppliers, approves a pending one and confirms the row
  updates, and confirms a 401 during the approve action triggers automatic
  logout
- `src/moderation.integration.test.js` (7, REAL backend, with direct DB
  access for test setup/teardown only) — confirms real, correctly-computed
  flags on a known product, a full approve/reject round-trip confirmed by
  independently re-fetching the queue afterward, and confirms approving
  with only English, only Arabic, or neither are all correctly rejected
  (both are mandatory, not optional)
- `src/ModerationFlow.test.jsx` (6, mocked, full component tree) — renders
  the real Chinese original and photos with real computed flags (and
  confirms the old fake "Translation pending review" flag is gone),
  clicking "Review & Approve" opens the translation panel with both
  English and Arabic fields pre-filled with the Chinese text, confirms
  approval is blocked client-side with only the English name entered
  (Arabic is required too, not optional), approving with both removes
  the item from view, rejecting needs no translation and removes the item
  immediately, and a
  401 during approval triggers automatic logout.
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
- `src/fitmentAdmin.integration.test.js` (7, REAL backend) — rejects
  unauthenticated and non-admin creation, a duplicate brand name gets a
  clear 409 rather than a raw DB error, a full real
  Brand→Model→Generation→Engine/Transmission chain is built and
  immediately visible via the same GET endpoints the supplier portal
  reads from, a bad year range 400s, a successful delete is confirmed by
  independent re-fetch, deleting a brand cascades to its own
  unreferenced children — and the one that matters most: builds its own
  real generation, attaches a real product to it via the actual supplier
  submission endpoint, then confirms deleting that generation is
  refused with a 409, proving the "don't orphan real product data"
  protection works against genuine data, not a fixture that merely
  claims to be a product.
- `src/VehicleDataFlow.test.jsx` (3, mocked, full component tree) —
  renders real brands and drills all the way down through
  Model→Generation→Engines/Transmissions, the breadcrumb navigates back
  up correctly, and adding a new brand calls the real create endpoint
  and shows it in the list immediately.
- `src/hub.integration.test.js` (13, REAL backend) — a supplier
  genuinely cannot ship a sub-order before an admin assigns a hub; once
  assigned and shipped, a real `hub_shipment` auto-creates and is
  visible ONLY to that hub (a shipment routed elsewhere is confirmed
  invisible, both in the queue list and to a different hub's staff
  entirely); step order is enforced (skipping ahead 400s), zero photos
  400s, the full real `received → opened → inspected → packed →
  shipped_to_buyer` sequence works end-to-end with a required tracking
  number on the final step and a complete audit trail confirmed visible
  from BOTH the hub's own view and the admin's order detail; the
  `flagged` branch works from any in-progress state and can't be
  triggered twice; hub-location creation/deletion (with the same real
  referential protection as Vehicle Data) all work correctly; and
  (added later) `GET /hub/flagged` genuinely surfaces a real flag with
  its real note and photos, non-admins are rejected, and a shipment that
  was never flagged correctly does NOT appear in the queue.
- `src/HubsFlow.test.jsx` (3, mocked, full component tree) — renders
  real seeded hubs, adding a new one calls the real create endpoint and
  shows up immediately, and submission is blocked without a name and
  region.
- `src/buyerCatalog.integration.test.js` (8, REAL backend) — the
  buyer-facing product detail and list NEVER include the supplier name
  (checked two ways: a specific key AND a raw-text scan for the word
  "supplier" at all), the Chinese original never appears in a buyer
  response (scanned for CJK characters directly, not just checking a
  key is absent), English/Arabic both resolve correctly and a legacy
  product without Arabic falls back to English, real photos and every
  real structured field (part, OEM number, brand, model, year, weight,
  dimensions) come through correctly, and mandatory shipping
  dimensions/weight are enforced with a non-positive value rejected.
- `src/pricing.integration.test.js` (9, REAL backend) — a non-RMB
  submission is rejected, unauthenticated/non-admin access to fee/rate
  management is rejected, the preview endpoint's result is
  independently re-derived from the real fee components this test
  doesn't control and confirmed to match exactly (proving the math is
  genuinely correct, not just "returns some number"), a negative cost
  and a shipping fee applied without real dimensions are both rejected,
  a fee component's full create/update/delete lifecycle works and an
  invalid type is rejected, and — the two most important tests in this
  whole feature — a real RMB-priced product's buyer-facing price
  changes LIVE the instant a fee changes, and a PLACED order's price is
  confirmed completely unaffected by a fee change made afterward (even
  a deliberately drastic one) while the SAME product's live browsing
  price is confirmed to have genuinely changed — proving the "live
  until locked at order placement" design actually works, not just that
  each half works in isolation. **A real bug in this test itself was
  found and fixed**: the "legacy product passes through unaffected" test
  originally hardcoded p1's expected price as a literal number — this
  broke the moment it ran against a database that had been reused across
  many earlier sessions (this project's own dev database genuinely has
  been), where p1's real seeded value differs from a freshly-seeded one.
  Fixed by reading p1's REAL stored price directly from the database
  (via a real `pg` connection, same pattern as `moderation.integration.test.js`)
  and asserting the API returns THAT exact value unchanged — testing the
  actual invariant that matters, not a number that happens to be true in
  one environment's history.
- `src/PricingFlow.test.jsx` (5, mocked, full component tree) — renders
  the real seeded fee component and current FX rate, adding a new fee
  calls the real create endpoint and shows up immediately, updating the
  FX rate calls the real update endpoint, and the preview calculator
  shows a real computed breakdown (and a clear error with no cost
  entered).
- `src/FlaggedShipmentsFlow.test.jsx` (5, mocked, full component tree) —
  the sidebar shows a real count badge when something is flagged and
  shows no badge at all when nothing is (not a stray "0"), the queue
  page renders a real flagged entry with its real note and supplier
  name, a real empty state shows when nothing is flagged, and clicking
  "View order" genuinely navigates into that order's real detail page.
- `src/categoryParts.integration.test.js` (8, REAL backend) — real
  seeded categories/parts are publicly readable with no auth required;
  a category outside the real list is rejected; a part that isn't real
  for the selected category is rejected (free text no longer works); a
  REAL part from a DIFFERENT category is rejected (cross-category
  mismatch isn't accepted just because the name happens to be valid
  somewhere); a real category+part combination is accepted; admin-only
  create/delete works and is rejected for non-admins; and — the test
  that caught a real bug — a category with real products OR real parts
  still attached cannot be deleted (this used to be a raw, uncaught
  database error for the "parts still attached" case specifically, not
  a clear 409, until this test caught it), and a real part a real
  product references cannot be deleted either.
- `src/CategoriesFlow.test.jsx` (5, mocked, full component tree) —
  renders the real seeded category, adding a new one calls the real
  create endpoint and shows up immediately, clicking a category drills
  into its real parts list, adding a new part inside a category works,
  and a real empty state shows for a category with no parts yet.
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

**A second, unrelated class of real bug found the same way** (running
the standard clean-merge verification, not by inspection): building the
structured product submission feature meant editing `ModerationFlow.test.jsx`,
and running it alongside the full suite crashed with a completely
unrelated-looking error inside `OverviewPage`. The cause: Overview is the
admin dashboard's default landing page after login, so ANY mocked
component test that logs in (even ones that immediately navigate
elsewhere, like Moderation) renders it first — and any such test file
written before Overview existed has no mock for `GET /overview`, so the
page crashes trying to read fields off an empty response. Checking for
this pattern found the SAME latent bug in three more pre-existing files
(`OrdersFlow.test.jsx`, `SuppliersFlow.test.jsx`, `TicketsFlow.test.jsx`)
that had simply never been unlucky enough to hit it before. All four
fixed with the same one-line addition to their mock fetch routers. If you
add a new mocked component test that logs in, give it a valid
`/overview` mock too, even if the test itself is about something else
entirely.

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
