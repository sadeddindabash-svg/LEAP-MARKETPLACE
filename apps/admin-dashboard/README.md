# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication and fifteen real pages** (Overview, Orders,
Suppliers, Moderation, Support Tickets, Returns, Vehicle Data, Hubs,
Pricing, Flagged Shipments, Categories, Supplier Messages, Promo Codes,
Payouts, Reviews — all but the first three are entirely new, not in the
original prototype at all) —
full UI → API → database → UI slices, including Payouts, once blocked
on undecided commission rates and now real (see its own section below).

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
  Overview deliberately still doesn't show a payout figure here, even
  though Payouts is now a real, separate page (see its own section
  below) — a single dollar figure on this summary page would need to
  pick one arbitrary moment to summarize a number that's genuinely
  live and per-supplier; the real Payouts page itself is the honest
  place to see that.
- Verified with a test that specifically checks the response never
  includes a `gmv` or `topMarkets` field at all — proving the "no fake
  aggregate numbers" decision is enforced by the backend, not just a
  frontend choice not to display fields that exist.

## Real Excel (.xlsx) export (new)

**Confirmed scope**: a real `.xlsx` file specifically, not CSV, added
to three places — the Audit log card, the Orders page, and the Payouts
page (both "Amount owed" and "Payout history"). Client-side generation
directly from whatever real data the page already has loaded (via
`src/exportToExcel.js`) — no new backend endpoint needed, since this
is just a different real representation of data the admin can already
see on screen.

**A real, deliberate library choice**: `xlsx` (SheetJS), the more
commonly reached-for package, has two real, unpatched high-severity
vulnerabilities (prototype pollution, ReDoS) with no fix available —
confirmed via `npm audit`, not assumed. Used `exceljs` instead, a
well-maintained alternative better suited for this write-only use
case (a moderate, narrower vulnerability remains in one of its own
transitive dependencies, `uuid`, but only affects a code path this
project's usage never exercises).

**A real, pre-existing gap was found and fixed while building this**:
the Orders page already had an "Export" button — but it had no
`onClick` handler at all, doing nothing when clicked. Wired up
properly rather than left as another fake control.

**Tested properly** — see `src/exportToExcel.test.js` (3 tests): rather
than just confirming the code runs without throwing, these tests
build a real workbook, write it to a real buffer, then read that
buffer back with an independent ExcelJS instance to confirm the
actual bytes are a genuinely valid, correctly structured `.xlsx` file
— real headers, real row data, real column widths, all verified
end-to-end, including the zero-rows edge case.

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
- **Real bulk actions (new)**: a checkbox per listing plus "select all,"
  with a bulk action bar once anything's selected. **Bulk reject** is
  simple — select many, one click, done, matching the single-item
  reject flow's own "no translation needed" behavior. **Bulk approve**
  deliberately does NOT skip the real translation-review gate above —
  clicking "Review & approve selected" opens a real batch table with
  every selected listing's own English/Arabic name fields (still
  pre-filled with the Chinese original as a starting reference), and
  one "Approve all" button submits the whole reviewed batch together.
  Real, best-effort processing — a result banner reports exactly how
  many succeeded vs. failed, and a failure in one item never costs the
  others their real approvals. See `services/api/README.md`'s "Real
  bulk moderation" section for the full backend design.

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

- **Exchange rate (new: real automatic/manual toggle, migration 028)**:
  shows the current real rate with a badge distinguishing `Manual` from
  `Live`. A real toggle switches between the two — Automatic refreshes
  once a real day from a genuinely free, no-API-key live rate provider
  (Frankfurter.app, backed by real European Central Bank data); Manual
  shows the real inline field to set it by hand, and is the confirmed
  real default (applying this feature causes zero behavior change until
  an admin explicitly switches it on). While in Automatic mode, the
  manual field is hidden and the manual update endpoint itself is
  rejected — switching back to Manual first is required, so a manual
  entry can never be silently overwritten by the next real automatic
  refresh. See `services/api/README.md`'s "Real live FX rate" section
  for the full real design, including the honest limitation that this
  sandbox's own network restrictions meant the actual live Frankfurter
  call could only be confirmed to fail gracefully here, not verified
  end-to-end with a real successful response.
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
- **Real reordering (new)**: real up/down arrows next to each fee's
  application order — since fees apply sequentially against a running
  total, this genuinely changes the calculated price, not just display
  order (see `services/api/README.md`'s "Real, atomic fee component
  reordering" section). Disabled correctly for the first/last real
  component; a real, atomic backend swap either succeeds completely or
  not at all.

## Real admin team permissions — one owner, per-page access control (new)

**Confirmed via 2 real scenarios validated before building**: one real
"owner" admin manages permissions for every other real admin account;
page-level access control for now. See `services/api/README.md`'s
"Real admin team permissions" section for the full real backend design.

- **Replaces a completely fabricated card** — the old "Roles & access"
  card in Settings was hardcoded fake role names ("Super Admin",
  "Catalog Moderator"...) with fake user counts ("2 users", "4
  users"...) that had never been real. This is the actual thing.
- **A real "Team & permissions" section in Settings**, visible ONLY to
  the real owner — a non-owner sees a clear message instead, even if
  they have general Settings access (Team & Permissions is
  unconditionally owner-only, enforced by the real backend's
  `requireOwner`, not just a hidden UI button).
- **Create a real admin with a real, specific set of pages** they can
  access, using a checkbox grid built directly from the same real NAV
  array the sidebar itself uses — always in sync, never a separate
  list that can drift out of date.
- **The sidebar itself only shows pages the real logged-in admin
  actually has access to** — a scoped admin's nav genuinely only shows
  their allowed pages, and they land on the first one they can actually
  see, not a hardcoded Overview they'd immediately be rejected from.
- Real, honest safeguards matching this dashboard's established
  pattern elsewhere (Categories, Vehicle Data, promo codes with real
  redemptions): the owner account can't be deleted or edited; an admin
  can't delete their own account.

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

## Supplier Messages page (new — real bidirectional Chinese/English messaging)

Real messaging with suppliers, auto-translated both ways — see
`services/api/README.md`'s "Real supplier messaging" section for the
full backend design, including the real discussion behind choosing
Google Cloud Translation over Baidu Translate and the honest state of
that integration without live API credentials.

- **A real inbox**: every supplier that has sent or received at least
  one message, most recently active first, with a genuine
  most-recent-message preview — not a static list.
- **Real translation, with a toggle to the real original**: a
  supplier's Chinese message shows the real English translation by
  default; a button toggles to the real Chinese original, since
  auto-translation isn't perfect and admin should be able to check it,
  not just trust it blindly. A message where translation is genuinely
  unavailable (no live API credentials configured in this environment)
  says so plainly instead of showing nothing or something wrong.
- **Deliberately separate from the buyer Support Tickets page** — that
  system exists specifically to enforce buyers never contacting
  suppliers directly; this is a different relationship entirely.

## Promo Codes page (new — a general promotions engine, expanded from an original ask for just "referral rewards")

Real admin-created event/campaign codes, alongside real referral-
generated reward codes — one system, not two. See
`services/api/README.md`'s "Real promotions engine" section for the
full backend design, including the real discussion behind expanding
scope beyond referral rewards alone.

- **Create a real code of any of the 3 real types** (percentage off,
  flat amount off, free shipping), with real, enforced limits — max
  total uses, max uses per buyer, an optional real expiry date, and
  (new, migration 041) an optional real future start date, for
  scheduling a code ahead of a planned promotion. A code shown with a
  blue "Scheduled" badge hasn't reached its start date yet.
- **Deactivate/reactivate** without losing a code's configuration, same
  pattern as the Categories page's part-active toggle.
- **A real code with genuine redemptions cannot be deleted** — 409,
  same "protect real referenced data" pattern used throughout this
  dashboard (Categories, Vehicle Data) — only deactivated.
- Each code shows its real source (`Admin` or `Referral`) so it's
  immediately clear which codes came from a real customer earning a
  reward vs. a real campaign you configured yourself.
- **Real audience targeting (migration 021), confirmed via a real list
  presented before building**: 4 combinable segments — new users only,
  a minimum lifetime spend, a minimum real order count, and win-back
  (inactive for a minimum number of days). All optional and
  combinable — set none for a code open to everyone, or combine
  several for something like "loyal customers who haven't ordered in
  60+ days." Each code's real targeting summary shows directly in the
  list, e.g. "$100+ lifetime spend · 3+ real orders."

## Payouts page (new — genuinely built, no longer blocked)

**Previously blocked on a real business decision, now confirmed and
built**: no automatic payout schedule — real timing varies per
supplier based on individual agreements, not one platform-wide
schedule. Instead, a real "Amount owed" table (one row per supplier
with a real balance, calculated from their real delivered orders past
the real return window with no return filed) and a manual **Record
payout** button that captures the exact real, live amount at that
moment — never a stale or estimated number.

- **Replaces the entirely fake KPIs and table** that were here before —
  "$28,140" commission revenue, "$940.30 held for review," a fake
  "Next scheduled payout run: Jul 15, 2026" subtitle, and a hardcoded
  five-supplier table that never reflected anything real.
- **Payout history** shows every real payout ever recorded, including
  which real supplier, how much, how many real orders it covered, and
  any notes — a genuine audit trail, not a snapshot that resets.
- See `services/api/README.md`'s "Real return window + real payouts"
  section for the full real backend design, including why a return
  window (not a clawback system) was the confirmed way to avoid paying
  a supplier for an order that gets returned afterward.

## Settings page — real Commission rules + real Return window (new)

The Settings page's "Commission rules" card was previously **entirely
fake, hardcoded display-only percentages** — now each category's real
commission rate is inline-editable (click the percentage, type a new
real number, save), and is what the Payouts page's real calculation
actually uses.

A new **Return window** section lets the owner/admin pick a real number
of days (3–7, the confirmed real range) — this is both the real
deadline for a buyer to file a return at all, and the real threshold
for when an order becomes eligible for payout.

A new **Audit log** card (migration 036) — visible only to the owner
account, same restriction already used for the "Team & permissions"
section above it — shows a real, chronological record of sensitive
admin actions: supplier verification decisions, review moderation and
flag dismissal, payout recording, promo code creation, admin account
changes, category commission changes, return window changes, and FX
rate/mode changes.

## Reviews page (new)

Every real submitted review needs real admin moderation before it's
visible anywhere or counts toward a product's average rating — the
same real quality gate every product listing already goes through.
Approve or reject each pending review directly, with its real star
rating and comment shown alongside which real product and buyer it's
for. **Real photo thumbnails (up to 3, migration 031)** now show
alongside a review when a buyer attached any, rendered the same way
existing photo thumbnails elsewhere in this app already are. **A real
"✓ Verified Purchase" badge (migration 035)** now shows next to a
review's buyer name/date when that buyer's purchase was genuinely
verified at the moment they submitted it — a real, honest gap closed:
this was previously only ever checked as a submission-time gate, never
actually stored for display.

A real **"Require verified purchase to review"** toggle sits at the
top — confirmed design: whether a review needs a genuine delivered
order behind it is an admin decision, not fixed either way. Turning
this on immediately means only buyers who actually received a given
product can submit a review for it.

**Real Pending/Flagged tab toggle (migration 033)**: a real buyer can
report an inappropriate review with a required reason; the Flagged tab
shows every real flagged review with its flag count and every real
reason given, most recently flagged first. An admin can **Dismiss**
the flags (the review stays exactly as it was) or **Hide review**
outright, reusing the same real Reject action already used on the
Pending tab — no separate "hide" action needed, since a rejected
review is already correctly hidden from public view. **A real bug was
found and fixed while building this**: switching tabs could briefly
crash the page, since the real reviews array still held the previous
tab's data for one render before the new fetch resolved, and a pending
review has no real `flagReasons` field the flagged tab's render logic
expected. Fixed two ways — clearing the list immediately on every tab
switch, and making the render itself defensive so a mismatched shape
can never crash the page.

## Testing

```bash
npm test
```

Sixty-three test files, 396 tests total, all passing:
- `src/App.test.jsx` (7, mocked) — auth flows
- `src/auth.integration.test.js` (4, REAL backend) — login/session
- `src/passwordReset.integration.test.js` (5, REAL backend) — a real
  forgot-password request returns the identical response for a real
  vs. a fake email (no enumeration leak); an invalid email format and
  a too-short new password are both rejected; a completely invalid/
  nonexistent reset token is rejected; and — the most important test
  here — a real reset genuinely changes the password: the old password
  stops working, the new one works, and the same token cannot be reused
  a second time.
- `src/email.test.js` (11, unit tests) — real generic SMTP email
  delivery: `isEmailConfigured()` correctly reports false with no
  real env vars, false with only a genuinely partial configuration, and
  true once all 5 real required vars are set; the real branded password-
  reset template includes the real reset URL in both HTML and plain-
  text, personalizes the greeting with a real recipient name (falling
  back gracefully without one), and shows the real configured expiry
  time rather than a hardcoded number. See `services/api/README.md`'s
  "Real password reset email delivery" section for the honest,
  documented reason `sendEmail()`'s actual SMTP transport behavior isn't
  covered by this automated suite (a real cross-package module
  boundary, same as the storage and translation modules) and how that
  logic was verified instead. **Plus 5 new tests (new)** directly
  against the 4 new transactional email templates: order confirmation
  shows the real order id, every real item, and the real total; shipping
  notification shows the real tracking number when provided and omits
  it gracefully when not; delivery notification shows the real order id;
  payout confirmation shows the real amount with correct real
  singular/plural wording; all 4 personalize the greeting with a real
  name and fall back gracefully without one.
- `src/exportToExcel.test.js` (3, unit tests, new) — a real, valid
  workbook is produced with the real headers and real row data,
  verified by actually reading it back with an independent ExcelJS
  instance (not just confirming no error was thrown while building
  it); a real export with zero rows still produces a valid workbook
  with just the real header row; real column widths are actually
  applied, with a sensible real default when not specified.
- `src/transactionalEmails.integration.test.js` (5, REAL backend) —
  placing a real order succeeds regardless of email delivery; a real
  guest order (no account) is also handled correctly; marking a
  sub-order shipped succeeds regardless of email delivery; manually
  confirming delivery (as the hub, migration 027) succeeds regardless
  of email delivery; recording a real payout succeeds regardless of
  email delivery to the supplier. See `services/api/README.md`'s
  "Real transactional emails beyond password reset" section for the
  full real trigger-point design — every one deliberately fires AFTER
  its real underlying action already committed, as a genuine
  best-effort follow-up that can never block or roll back the real
  thing that triggered it.
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
- `src/bulkModeration.integration.test.js` (7, REAL backend) — a real
  batch of valid approvals and rejections all succeed together; **real
  best-effort processing** confirmed both in the response AND
  independently re-verified at the real data level (the valid item is
  genuinely approved and out of the queue, the invalid one is genuinely
  untouched and still pending); a nonexistent product within a batch is
  a real per-item failure without affecting the others; an empty items
  array and a batch over the real 100-item cap are both rejected; an
  invalid action or missing productId is a real per-item failure, not a
  request-level error; and non-admins are rejected.
- `src/BulkModerationFlow.test.jsx` (6, mocked, full component tree) —
  selecting items shows the real bulk action bar with the real count;
  "select all" selects every real item; bulk reject calls the real bulk
  endpoint and removes all selected items from the queue; bulk approve
  opens a real batch review table requiring English AND Arabic per
  item and submits the whole reviewed batch together; bulk approve is
  blocked client-side if any selected item is still missing a required
  translation; cancelling the batch review returns to the normal queue
  view with selection cleared. **A real bug was found and fixed while
  writing these**: the "Clear"/"Cancel" buttons' shared `clearSelection`
  helper was ALSO wiping the just-set success/failure result message
  immediately after a bulk action completed (since the success handler
  calls `clearSelection()` right after setting that message) — the
  banner would flash and vanish before a person could ever read it.
  Fixed by having `clearSelection` leave the result message alone, and
  having the Clear/Cancel buttons explicitly dismiss it themselves when
  a person manually backs out, which is the only case that should
  actually clear it.
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
- `src/orderLifecycle.integration.test.js` (7, REAL backend, migration
  029) — a buyer can cancel their own real order while it's still
  pending; cancelling an already-cancelled order is rejected; once a
  real sub-order has shipped, cancellation is rejected with a clear
  message; a real guest order can be cancelled with the correct guest
  email and is rejected with the wrong one; a different buyer cannot
  cancel someone else's order; signing up with the same email a real
  guest order used links that order to the new account and reports the
  real count; a fresh signup with no prior guest orders reports zero.
- `src/orderAddresses.integration.test.js` (7, REAL backend, migration
  030) — a logged-in buyer cannot place an order without a real address
  or `addressId`; a real inline address requires every field and saves
  with `source: 'manual'`; a real saved address is correctly copied via
  `addressId` with `source: 'saved_address'`; an `addressId` belonging
  to a different buyer is rejected, not silently used; a real guest
  order can be placed with no address at all (a real, honest pending
  state, not an error); a real guest can confirm their address
  afterward via `PATCH`, correctly tagged `source: 'geolocation'`; the
  wrong guest email is rejected when confirming, and a real address can
  be updated after being set once.
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
- `src/pricing.integration.test.js` (14, REAL backend) — a non-RMB
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
  one environment's history. Plus 5 new real fee-component-reordering
  tests (new): moving a fee up swaps its real sort_order with the real
  previous component and moving back down restores it exactly;
  reordering a real percentage fee relative to a real flat fee
  genuinely changes the real calculated price, verified by computing a
  real preview before and after rather than assuming the math; the real
  first component cannot move up and the real last cannot move down; an
  invalid direction and a nonexistent component are both rejected; and
  non-admins cannot reorder fee components. **A second real regression
  was found and fixed here (migration 037)**: the "placed order locks
  in the price" test's product-creation helper never specified a real
  stock quantity, which — correctly, under real stock enforcement
  added elsewhere — now defaults to 0 and is genuinely unorderable.
  Fixed by giving it a real stock quantity, rather than loosening the
  new real enforcement to accommodate an old test.
- `src/PricingFlow.test.jsx` (9, mocked, full component tree) — renders
  the real seeded fee component and current FX rate, adding a new fee
  calls the real create endpoint and shows up immediately, updating the
  FX rate calls the real update endpoint, and the preview calculator
  shows a real computed breakdown (and a clear error with no cost
  entered). Plus 2 real reordering UI tests: clicking the
  real move-down arrow calls the real move endpoint and the fee order
  genuinely updates; the real move-up arrow is disabled for the first
  fee component. **A real bug in this test itself was found and
  fixed**: the mock's GET handler initially returned fee components in
  their original array order rather than sorted by the real
  `sortOrder`, unlike the real backend's actual `ORDER BY sort_order
  ASC` — meaning a swap changed the real underlying values but the mock
  kept returning the stale display order, making a genuinely correct
  reorder look like a failing test. Fixed by sorting the mock's
  response the same way the real backend does. **Plus 2 new tests
  (migration 028)**: defaults to Manual mode, showing the real editable
  rate input; toggling to Automatic calls the real endpoint and hides
  the manual rate input.
- `src/fxRateMode.integration.test.js` (4, REAL backend, new) —
  defaults to manual mode, and the manual rate endpoint works normally
  in that mode; switching to automatic mode rejects the manual rate
  endpoint with a real, clear message; an invalid mode value is
  rejected and non-admins are blocked from both endpoints; restores
  manual mode afterward so other tests and manual use are unaffected.
  See `services/api/README.md`'s "Real live FX rate" section for the
  full real design, including the honest limitation that this
  sandbox's own network restrictions meant the actual live Frankfurter
  API call could only be confirmed to fail gracefully here (a real
  403 from the egress proxy), not verified end-to-end with a real
  successful response.
- `src/adminPermissions.integration.test.js` (12, REAL backend) — the
  real seeded admin is confirmed a real owner with full access;
  **Scenario 1** — a real support-only admin can access Tickets and
  Returns but is rejected from Pricing, Promo Codes, and Moderation;
  **Scenario 2** — a real finance-only admin can access Pricing but is
  rejected from Moderation and Supplier Messages; a real owner has full
  access across every real page group in one pass; a real buyer is
  completely unaffected by page-access logic on the real shared
  `GET /order` endpoint; a permission change takes effect on the SAME
  token's very next request, not after a new login; an unknown page id
  is rejected; a non-owner admin cannot manage any other admin's
  account; the real owner account cannot be deleted or edited; a real
  scoped admin can be deleted and genuinely stops being able to log in
  afterward; duplicate email is rejected; and the real admin list shows
  accurate real permissions for every account.
- `src/TeamPermissionsFlow.test.jsx` (6, mocked, full component tree) —
  an owner sees every real nav page including Settings; a real scoped
  admin only sees their real allowed pages in the nav and lands on one
  of them, not a blank Overview they can't access; the owner sees the
  real Team & Permissions management UI listing every real admin;
  creating a new scoped admin with specific pages calls the real create
  endpoint; a non-owner sees a real restricted message instead of the
  management UI, even with Settings access; deleting a scoped admin
  calls the real delete endpoint and removes them from the list. **A
  real regression was found and fixed while building this**: filtering
  the nav by real permissions broke 13 EXISTING mocked component tests
  whose mocked login responses predated `isOwner`/`allowedPages` —
  correct, secure "don't show anything for an unrecognized permission
  shape" behavior, not a bug, but it meant those 13 older test files'
  mocks needed updating to the real, current response shape rather than
  loosening the real security logic to accommodate stale mocks. **A
  second real regression surfaced later**, when the real Payouts +
  Settings work added new components to the Settings page that fetch
  real categories and the real return window on mount — this file's own
  mock router didn't handle either new endpoint, throwing
  `categories.map is not a function` and failing 3 of these tests. Fixed
  by adding both real endpoints to this file's mock, the same kind of
  fix already needed once before for a very similar reason.
- `src/payouts.integration.test.js` (7, REAL backend) — the real return
  window is admin-configurable within 3–7 days, rejecting anything
  outside that range; a real return CAN be filed within the window and
  CANNOT be filed once it's passed; an order only becomes
  payout-eligible once delivered, the window has passed, AND no return
  was ever filed — verified with real, exact commission math, not just
  an approximate check; recording a real payout covers exactly the
  real eligible amount, clears it from what's owed, and cannot be
  double-paid; non-admins are rejected from every real endpoint;
  recording a payout for a supplier with nothing real owed is rejected;
  and the real commission percent is admin-editable per category within
  a real 0–100 range. **A real bug was found and fixed while writing
  this**: one scenario initially backdated a sub-order's delivery
  BEFORE filing its return, which meant the return itself got rejected
  by the very window check being tested — silently leaving that
  sub-order eligible for payout when it should have been excluded, and
  inflating a later assertion's expected total. Fixed by filing the
  real return first (genuinely within the window), then backdating
  delivery afterward to simulate time having passed since. **Updated
  for migration 027**: this file's own delivery-confirmation test
  helpers now walk the full real hub workflow (received → opened →
  inspected → packed → shipped_to_buyer → confirm-delivery) instead of
  the old, incorrect supplier-based one — see
  `services/api/README.md`'s "Real bug fixed: delivery confirmation
  moved to the hub" section.
- `src/PayoutsFlow.test.jsx` (4, mocked, full component tree) — shows
  the real amount owed per supplier, not fabricated numbers or a fake
  schedule; recording a payout calls the real endpoint, clears the
  supplier from amount owed, and adds it to real history; shows real
  existing payout history, including a prior payout never triggered in
  this session; shows a real empty state when nothing is owed to any
  supplier.
- `src/reviews.integration.test.js` (6, REAL backend) — a submitted
  review is invisible publicly until a real admin approves it; a
  second submission for the same product is a real edit (same row,
  sent back to pending), never a new one; when verified purchase is
  required, only a buyer who actually received the product can review
  it; a buyer can delete only their own real review; an invalid rating
  is rejected and non-admins are blocked from moderation endpoints; and
  the average rating reflects only real approved reviews. **A real bug
  was found and fixed in this test file itself, without needing a code
  change**: the average-rating test initially asserted an exact review
  count, which broke the second time this file ran in the same
  session — product p9 genuinely accumulates real approved reviews
  across repeated runs, since this file has no direct DB connection to
  reset that state between runs (unlike `payouts.integration.test.js`).
  Fixed by asserting the real DELTA (count before vs. after this test's
  own two submissions), confirmed by running the file three times in a
  row without any cleanup in between. **Updated for migration 027**:
  the "verified purchase" helper now walks the full real hub workflow
  to reach a genuine delivered state, instead of the old, incorrect
  supplier-based one.
- `src/reviewPhotos.integration.test.js` (7, REAL backend, new) — a
  review can be submitted with up to 3 real photos; a 4th is rejected
  (the real confirmed cap); a review with no photos remains valid;
  re-submitting with different photos fully REPLACES the previous real
  set, not appends; photos correctly show in the admin moderation
  queue, the moderate response itself, and the real public endpoint
  once approved; deleting a review also genuinely removes its real
  photos via cascade; a real buyer (not just supplier/hub_staff) can
  now use the shared photo upload endpoint. **A real bug was found and
  fixed here**: the moderation endpoint's own response never attached
  photos, unlike every other endpoint in this module — approving or
  rejecting a review with photos showed `photos: []` in that one
  specific reply, even though they were genuinely still saved and
  visible everywhere else. See `services/api/README.md`'s "Real photos
  on product reviews" section for the full real design.
- `src/verifiedPurchaseReview.integration.test.js` (3, REAL backend,
  new, migration 035, using the full real order-to-delivery workflow)
  — a review from a buyer with no real purchase is stored as
  `isVerifiedPurchase: false`; a review from a buyer with a genuinely
  delivered order is stored as `true`, correctly shown in the moderate
  response and the real public endpoint; a real, later edit of the
  same review re-checks and re-stores the real status (submitted
  before delivery as `false`, edited after delivery as `true`, same
  review row throughout).
- `src/auditLog.integration.test.js` (5, REAL backend, new, migration
  036) — a real promo code creation is logged with the real code as
  its target; a real category commission change is logged with the
  real new value; a real review moderation action is logged with the
  real product ID; only the real owner account can view the audit
  log, not a regular admin; a non-admin (buyer) cannot view it at all.
  **A real bug was found and fixed here**: `promo_codes` has no real
  `id` column at all — the code itself is the natural key. The first
  attempt logged `rows[0].id`, genuinely `undefined`, silently
  becoming a `null` target — fixed to log the real `code` string
  instead.
- `src/lowStockAlerts.integration.test.js` (5, REAL backend, new,
  migration 037) — placing a real order genuinely decrements stock by
  the ordered quantity; a real order that would oversell past
  available stock is rejected, and stock is left completely
  unchanged; a real low-stock notification fires exactly once, right
  when crossing the real threshold (confirmed by placing a second
  order that crosses further below and checking the count stays at
  1); a supplier can configure their own real threshold per product; a
  negative threshold is rejected. **A real, significant, prerequisite
  gap was found and fixed first**: stock was never actually
  decremented anywhere in this whole project, and nothing prevented
  overselling — both fixed here as the real foundation this alert
  feature depends on. **A real bug was found and fixed along the
  way**: the notifications table's own CHECK constraint didn't allow a
  `'low_stock'` type at all — the first real end-to-end test caught
  this with a genuine constraint violation.
- `src/priceDropAlerts.integration.test.js` (5, REAL backend, new,
  migration 038) — the first real check on a product only records a
  real baseline, with no notification; a real price drop notifies
  every real buyer with that product wishlisted, with the correct
  before/after prices; a buyer who does NOT have the product
  wishlisted is never notified of its price drop; a real price
  increase (or no change) never fires a false drop notification; a
  non-admin cannot trigger a manual check. **A real, significant
  finding surfaced while testing this**: running the full suite
  revealed `p1` and `p4` — the two products nearly every test file in
  this whole project reuses as a shared fixture — had their real
  stock genuinely depleted to 0 by accumulated test runs across this
  project's history, now that migration 037 made stock real. Caused a
  real, widespread wave of ~60 unrelated failures. Fixed by
  replenishing the real database directly and updating `db/seed.js`
  to seed both with a real, deliberately large stock quantity going
  forward — see `services/api/README.md`'s "Real price-drop alerts on
  wishlist items" section for the full real story.
- `src/savedSearches.integration.test.js` (5, REAL backend, new,
  migration 039) — the first real check on a saved search only
  records a real baseline, with no notification, even with zero
  matches; a real, genuinely new match after the baseline correctly
  notifies — confirms the fix for a real bug (already found and fixed
  in an earlier pass) where a zero-match baseline incorrectly
  suppressed every future notification forever; a real, subsequent
  check with no further new matches does not re-notify; a buyer can
  list and delete their own real saved searches, and cannot delete
  another buyer's (404, not 403); a non-admin cannot trigger a manual
  check.
- `src/supplierDigest.integration.test.js` (3, REAL backend, new,
  migration 040) — triggering the sweep sends due digests and updates
  `last_digest_sent_at` so an immediate re-run finds nobody newly due;
  a non-admin cannot trigger a manual check; a real new order placed
  for a supplier is correctly reflected once their digest becomes due
  again, and a real, immediate re-check confirms one new order alone
  doesn't force a real week to pass. `gatherDigestData()`'s own SQL
  was separately verified directly against the real, heavily-used
  `s1` fixture — a wide date range returned real, large counts, a
  narrower one returned fewer, and a deliberately future date returned
  all real zeros, confirming the date filter genuinely narrows results
  rather than silently ignoring the parameter.
- `src/scheduledPromoCodes.integration.test.js` (4, REAL backend, new,
  migration 041) — a real code scheduled for a real future start date
  is rejected as not active yet; a real code whose scheduled start
  date has already passed is genuinely usable; a real code with a
  scheduled start after its own expiry is rejected as an impossible
  range; a real, already-existing code can have a scheduled start
  added via update, and takes effect immediately. **A real, honest
  finding preceded this build**: auto-expiring already worked
  correctly (confirmed directly, not assumed) — only the future-start
  half was genuinely missing.
- `src/recentlyViewed.integration.test.js` (4, REAL backend, new,
  migration 032) — recording a view and fetching the list shows it,
  most recent first; re-viewing a product moves it back to the front
  rather than duplicating it; an unauthenticated request is rejected
  and a nonexistent product is rejected too; a real buyer with no
  views yet gets a genuinely empty list, not an error.
- `src/reviewFlags.integration.test.js` (6, REAL backend, new,
  migration 033) — flagging without a real reason is rejected, with
  one it succeeds; re-flagging the same review by the same buyer is a
  genuine no-op, not a duplicate; the real admin flagged queue shows
  flag count and every real reason given; dismissing flags clears them
  and removes the review from the queue without changing its status;
  non-admins cannot see the flagged queue or dismiss flags; flagging a
  nonexistent review is rejected with a real 404.
- `src/ReviewsFlow.test.jsx` (7, mocked, full component tree) — shows
  the real pending review with its real rating and comment; approving
  a review calls the real endpoint and removes it from the pending
  queue; the verified-purchase toggle calls the real endpoint and
  reflects the real saved state; rejecting a review also removes it
  from the pending queue. **Plus 3 new tests (migration 033)**:
  switching to the Flagged tab shows the real flag count and every
  real reason given; dismissing flags calls the real endpoint and
  removes it from the flagged queue; hiding a flagged review calls the
  real moderate endpoint with reject.
- `src/uploads.integration.test.js` (6, REAL backend, real multipart
  file uploads against two real JPEG fixtures — one valid 900x900, one
  genuinely too-small 400x400) — a real, valid high-resolution image
  uploads successfully and honestly reports `storage: 'local'` (no real
  cloud credentials exist in this environment); a real too-small image
  is rejected with the exact real dimensions in the error; a real
  non-image file is rejected; unauthenticated uploads are rejected; a
  buyer cannot upload a product image; and a real hub staff account can
  also upload real evidence photos. **A real tooling issue was found
  and fixed while writing these**: Node's native `fetch` FormData/Blob
  combination hangs against this project's real multer-based endpoint
  (confirmed via direct `curl -F` testing that the actual endpoint
  itself works correctly) — switched to the well-established
  `form-data` package for reliable real multipart encoding instead.
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
- `src/supplierMessages.integration.test.js` (7, REAL backend) — a
  supplier's message stores the real original Chinese text and is
  honest about translation being unavailable rather than fabricating
  one; an admin reply is correctly marked English-original/Chinese-
  target; a supplier only ever sees their own thread while admin can
  view any specific supplier's by id; non-admins are rejected from the
  admin inbox and reply endpoint; replying to a nonexistent supplier is
  a real 404, not a raw database error; empty/whitespace-only text is
  rejected on both send endpoints; and the real admin inbox lists a
  supplier with a genuine most-recent-message preview.
- `src/SupplierMessagesFlow.test.jsx` (4, mocked, full component tree) —
  the real inbox renders a real supplier and message preview; opening
  a thread shows the real translated text by default with a working
  toggle to the real Chinese original; admin sending a real reply
  calls the real send endpoint and it appears immediately; a real
  empty state shows when no supplier has messaged yet.
- `src/promotions.integration.test.js` (17, REAL backend) — a fresh
  buyer gets a real, unique referral code starting at zero real
  referrals; the FULL real referral loop end-to-end (signup with a
  real code → the referred person's real first order → the referrer
  gets a real, genuinely-usable 10% reward, verified by actually
  placing an order with it and confirming the exact real discount); an
  invalid/made-up referral code at signup is a silent no-op, not a
  signup failure; an invalid promo code at checkout is a real 400 and
  the order is never created; a real admin flat-discount code applies
  exactly; a real per-buyer usage limit is enforced; a real total
  usage cap is enforced across DIFFERENT buyers, not just per-buyer; a
  real expired code and a real deactivated code are both rejected;
  non-admins cannot manage promo codes; a real code with genuine
  redemptions cannot be deleted, only deactivated; plus 6 real audience-
  targeting tests (migration 021) — a real "new users only" code
  succeeds for a genuinely new buyer and is rejected the moment they
  have any real order; a real minimum-spend and a real minimum-order-
  count code each reject a buyer below the real threshold and succeed
  once they genuinely cross it (verified by actually placing enough
  real orders, not asserting the math); a real win-back code rejects a
  buyer who ordered too recently; a guest checkout is rejected from any
  real targeted code; and a code with no targeting set remains open to
  everyone.
- `src/PromoCodesFlow.test.jsx` (5, mocked, full component tree) —
  renders the real seeded promo code; creating a new percentage code
  calls the real create endpoint and shows up immediately; creating a
  real "new users only" targeted code sends the real flag and shows
  the real targeting summary; deactivating a code calls the real
  update endpoint and shows "Inactive"; a real empty state shows when
  there are no promo codes yet.
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
