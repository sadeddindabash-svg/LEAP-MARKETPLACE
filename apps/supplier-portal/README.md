# Leap Supplier Portal (Chinese-Language)

Real React (Vite) project for the Chinese supplier tool. See
`/docs/SRS.docx` Section 3.2 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_supplier_portal_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication, a fully structured Products submission flow**
(cascading Brand->Model->Generation->Engine/Transmission fitment, mandatory
photo upload with real resolution checks, Chinese-language submission with
admin translation approval), **real order fulfillment** (view +
status/tracking updates), **real return/dispute case handling, and a real
Overview page** — the supplier side of the three-party marketplace is no
longer just a disconnected mock. Messages, Finance, and Settings
(partially) are still mock data.
The working 中文/EN language toggle (bilingual `STRINGS` dictionary
pattern) is preserved throughout, including on the new login screen.

## Important constraints — do not relax these when wiring up more real data

- **No direct buyer contact anywhere.** No buyer chat, phone number, or
  full address — only what's needed to fulfill an order. This is a
  business requirement, not an oversight. The real `GET /supplier/me/orders`
  endpoint reflects this: it returns order/item data, never buyer contact info.
- **Settlement currency is RMB (¥) regardless of UI language** — this is
  about how suppliers get *paid out* (Finance/Payouts, not yet wired — see
  "Next steps"), which is separate from what currency a *product is listed
  in* for buyers. Products created via the new Add Product form use USD
  (matching the rest of the seeded catalog) because that's the buyer-facing
  price — this does NOT contradict the RMB settlement constraint, which
  applies to the payout side once that's built.
- The 中文/EN toggle is intended for internal/bilingual ops use. Confirm
  with product before assuming real suppliers should see the English option.

## Authentication (SUP-001–003)

- New: suppliers can now log in. Backend migration `006_supplier_accounts.sql`
  adds a `supplier` role to `users` and a `supplier_id` linking that account
  to a specific supplier business — enforced at the database level (a
  `supplier`-role user without a `supplier_id` is a constraint violation,
  not just an application bug waiting to happen).
- `src/LoginPage.jsx` — bilingual login screen (language toggle works here
  too, before login) calling the real `POST /auth/login`.
- `src/App.jsx` default export is now an auth gate: verifies any saved
  token against `GET /auth/me` on load, rejects non-supplier roles even
  with otherwise-valid credentials, and fetches the real supplier profile
  (`GET /supplier/me`) once authenticated.
- **Fixed a "known gap" the admin dashboard left unsolved**: that app's
  `TopBar` still shows a hardcoded placeholder name because wiring the
  real user through every page would have meant prop-drilling or adding
  Context. This app already had a `LangContext` pattern for the language
  toggle, so adding a matching `SupplierContext` (see `supplierContext.js`)
  was low-effort — `TopBar`, the sidebar footer, and Settings all show the
  real logged-in supplier's name now, not a mock.
- Dev login for testing: `supplier@leap.dev` / `supplier_dev_password_123`
  (seeded by `db/seed.js`, tied to supplier `s1` / Guangzhou AutoParts Co.)
  — **change this password before any shared/production use.**

## Overview page

The portal's landing page (and default view after login) — wired to real
data using the same honesty principle established for the admin
dashboard's Overview page (see `services/api/README.md`).

- `GET /supplier/me/overview` (supplier-only, scoped to `req.user.supplierId`)
  returns: total orders, pending orders, total listings, pending returns,
  a 7-day order-count trend, top products by units sold, and recent orders
  — all real, all scoped to only this supplier's own data.
- **Deliberately does NOT show a fabricated ¥ sales total or star
  rating** — the original mock showed "¥78,250" weekly sales and a "4.6"
  rating. The "settlement currency is RMB" business rule (see "Important
  constraints" above) is about how a supplier eventually gets *paid out*
  once a payout/commission system exists — it is NOT license to sum raw
  order amounts (which are in whatever currency the buyer paid in, not
  RMB) and present that as a real RMB sales figure. That would need both
  a payout system and FX conversion, neither of which exist yet. There's
  also no reviews/ratings system in this schema at all, so a star rating
  cannot be honestly shown either. Used counts everywhere a currency
  amount would be fabricated, same as the admin dashboard's equivalent page.
- Replaced the mock's fake "Platform notifications" list (entirely
  invented — no backend notification feed exists) with a real "Recent
  orders" list.
- **A real bug caught by the verification process, not by inspection**:
  since this page is the default landing view right after login, the
  *existing* `App.test.jsx` (written before this page was wired to real
  data) didn't mock `/supplier/me/overview` at all — so its "logs out
  correctly" test started crashing the moment Overview began fetching
  real data on render. Fixed by updating that test file's mock router,
  not by working around the crash.

## Products page (SUP-010–012)

- `GET /supplier/me/products` — only this supplier's own products, scoped
  server-side (not just filtered in the UI) via `WHERE supplier_id = ...`.
- `PATCH /supplier/me/products/:id` — edit price/stock. Ownership is
  enforced by the `WHERE` clause itself, not a lookup-then-check — trying
  to edit another supplier's product returns 404 (not 403), the same
  "don't confirm it exists" behavior used elsewhere in this codebase.

### Structured product submission (this pass)

`AddProductForm` was rebuilt from scratch to match the real required
submission flow — everything the earlier version's form explicitly
noted as "dropped because backend storage isn't wired" is now real:

- **Cascading fitment picker**: Brand -> Model -> Generation -> Year ->
  Engine (optional) -> Transmission (optional), each level fetched live
  from the real reference cascade (`GET /fitment/brands` etc. — see
  `services/api/README.md`'s dedicated section on this feature) as the
  supplier makes each selection. Engine/transmission options are scoped
  to the chosen generation, not shown as one giant flat list.
- **Category / Part / Position / OEM Number**: Category and Position are
  real fixed lists (matching the backend's `ALLOWED_CATEGORIES` and
  `ALLOWED_POSITIONS` exactly) — not free text pretending to be
  structured. Part and OEM Number are free text (a curated Part-name
  reference list per category would be a reasonable future enhancement,
  not built here).
- **Mandatory photos**: a real file picker uploads each selected image
  immediately via `POST /uploads/product-image`, shows a live thumbnail
  preview with a remove button, and the submit button's own validation
  blocks submission with fewer than 3. The backend independently enforces
  the same "at least 3" rule — this isn't just a frontend nicety a
  crafted request could bypass.
- **Chinese submission**: the form collects `nameZh`/`descriptionZh`
  directly (this portal's whole premise is Chinese-language suppliers).
  A note in the form tells the supplier plainly what happens next —
  the listing is "awaiting translation" until the Leap team reviews and
  approves it, matching the real admin-side workflow (see the admin
  dashboard's Moderation page section for the other half of this).
- **Verified end-to-end against the real backend**: uploaded real images
  (including one deliberately too small, to confirm the resolution
  check genuinely rejects it — not just documented as a rule), created a
  full submission with a real fitment claim, confirmed it appears
  correctly in the admin's moderation queue with the Chinese original and
  photos intact, confirmed an admin cannot approve it without providing
  an English translation, approved it with one, and confirmed buyers then
  see the real English name — not the Chinese original — via a completely
  separate request. See `src/productSubmission.integration.test.js`.

## Order fulfillment (SUP-020–022)

- `GET /supplier/me/orders` — this supplier's sub-orders only, with real
  line items (product name, quantity, unit price) joined from the actual
  order data — not the buyer's full order, just this supplier's portion.
- `OrderDetailPanel` now updates status and tracking number via
  `PATCH /supplier/me/orders/:subOrderId`, with the same ownership
  enforcement as the product edit above.
- **The single best proof this actually works**: marking an order shipped
  with a tracking number here immediately shows up correctly on the real
  admin dashboard's order detail page — verified by an integration test
  that does exactly that and checks the admin-side response, not just this
  app's own state. The two apps are reading the same real data, not each
  independently faking it.
- Dropped the "carrier" dropdown and "region" note from the original mock
  — neither is tracked by the real backend. Replaced the separate
  "Accept order" / "Mark out-of-stock" buttons with a direct status
  selector (pending/preparing/shipped/delivered/dispute) that maps to
  exactly what the real `supplier_sub_orders.status` column supports.
- **New, real coupling as of the inspection-hubs feature**: a supplier
  can no longer mark a sub-order 'shipped' until an admin has assigned
  it to a regional inspection hub — every order now has two real
  shipping legs, Supplier → Hub → Buyer, always, confirmed as an
  explicit business decision (see `services/api/README.md`'s
  "Inspection hubs" section). Attempting to ship without an assigned hub
  is rejected with a clear message, not silently allowed. Once shipped,
  the hub's own inspection workflow takes over — see the new
  `apps/hub-portal/README.md`.

## Returns & disputes (SUP-030)

This existing mock page is now wired to a genuinely new backend feature —
`services/api/src/modules/returns/routes.js`, built at the same time as
the admin dashboard's Returns page.

- `GET /returns/supplier/me` and `GET /returns/supplier/me/:id` — only
  return cases tied to THIS supplier's own sub-orders. Confirmed by an
  integration test that creates a case for a different supplier and
  checks it never appears here, not just that the UI wouldn't show it.
- **The most important thing to understand about this feature**: the
  supplier only ever sees a separate supplier↔admin message thread —
  never the buyer's original message, name, or email. This isn't a
  UI-level filter; the backend has two entirely separate database tables
  (`return_case_buyer_messages` and `return_case_supplier_messages`), and
  the supplier-facing endpoints never touch the buyer one. There is no
  possible response from this API that leaks a buyer's message to a
  supplier. This matches the same "no direct buyer↔supplier contact" rule
  already enforced in the support-tickets and order modules — see this
  README's "Important constraints" section above.
- `POST /returns/supplier/me/:id/messages` — supplier replies to the
  admin (not the buyer). Verified end-to-end: a reply sent here shows up
  correctly in the admin dashboard's supplier-thread panel, confirmed via
  a separate request as the admin — same cross-app proof pattern used for
  order fulfillment above.
- Dropped the mock's per-case region/order-note styling that assumed
  richer data than what's real; the reply flow itself (open a case, view
  the relayed conversation, submit a reply) is preserved from the
  original prototype design.

## Setup

```bash
cd apps/supplier-portal
npm install
cp .env.example .env.local   # points at your local backend
npm run dev       # http://localhost:5173
```

## Testing

```bash
npm test
```

Six test files, 35 tests total, all passing:
- `src/supplierPortal.integration.test.js` (10, REAL backend, no mocking):
  login with a real supplier JWT including `supplierId`, a buyer account
  correctly rejected from supplier endpoints, products scoped to only this
  supplier (confirms another supplier's product never appears), a created
  product verified to appear in the admin's real moderation queue, product
  edit ownership enforcement, and — the key one — placing a real order,
  confirming shipping is genuinely rejected until a hub is assigned (the
  new inspection-hubs requirement — see `services/api/README.md`),
  assigning one as admin, then marking it shipped with tracking and
  confirming that exact tracking number and status via a **separate
  request as the admin**, proving the cross-app data flow is real.
- `src/App.test.jsx` (5, mocked fetch): login gate shows/hides correctly,
  a non-supplier role is rejected even with valid credentials, the language
  toggle works on the login screen itself, and logout clears the session.
- `src/returns.integration.test.js` (6, REAL backend, no mocking) — the
  strongest test in this whole app: creates a case tied to a DIFFERENT
  supplier and confirms it's invisible both in the list and via direct ID
  access (404, not just filtered), and directly asserts the buyer's actual
  message text is absent from `JSON.stringify()` of everything this
  supplier can fetch — not just "the UI doesn't show it," but "the string
  literally does not appear in the response." Also confirms a supplier
  reply shows up correctly on the admin side via a separate request.
- `src/overview.integration.test.js` (6, REAL backend) — rejects
  unauthenticated and admin-role access (supplier-only), checks response
  shape, and asserts `salesTotal`/`rating` are absent from the response
  entirely — proving the "no fabricated ¥ figure, no fake rating"
  decision is backend-enforced, not a frontend display choice. Also
  confirms `totalListings` matches a real, independently-fetched product
  count, one real order increases `totalOrders` by exactly one, and an
  order for a *different* supplier's product never appears in
  `recentOrders`.
- `src/OverviewFlow.test.jsx` (2, mocked, full component tree) — renders
  real counts on login (Overview is the default landing page) and
  confirms the old fabricated figures (`¥78,250`, `4.6`) are completely
  gone; renders real recent-order and top-product data.
- `src/productSubmission.integration.test.js` (6, REAL backend, uploads
  genuinely constructed test images — not mocked file objects — to
  exercise the real multipart upload path): the fitment cascade resolves
  correctly against real seeded reference data, a real image below the
  minimum resolution is genuinely rejected (not just documented as a
  rule) while one at/above it is accepted and actually served back,
  submission with fewer than 3 photos 400s, a fitment year outside the
  real generation's actual range 400s, and — the critical one — a full
  real submission (real photos, real fitment) shows up correctly in the
  admin's moderation queue, cannot be approved without a translation, and
  once approved, is confirmed visible to buyers under the real English
  name via a separate request. **Note**: this file forces the Node test
  environment (`// @vitest-environment node`) rather than the project's
  default jsdom — found the hard way that jsdom's `fetch`/`FormData`/`Blob`
  don't correctly serialize real multipart uploads, which silently hangs
  the request instead of failing with a clear error.

The full existing admin-dashboard test suite (93 tests) was also re-run
against the updated backend to confirm nothing broke there — still
93/93 passing.

## Next steps to make this real

1. Wire Messages and Finance/Payouts pages — each needs backend work
   first: Messages needs a supplier-facing thread (the admin-side Tickets
   module could potentially be extended, or this needs its own path),
   and Payouts is blocked on the commission-rate decision (Charter
   Section 1) — same reason the admin dashboard's Payouts page is still
   mock.
2. Split `src/App.jsx` into separate files (pages/components) — same note
   as the admin dashboard; this file is large now.
3. Add the OEM/fitment/description/image fields to real backend storage,
   then restore them to the Add Product form.
4. Consider a bulk-upload CSV endpoint for `BulkUploadPanel`, which is
   still entirely mock (upload UI exists, nothing is processed).
