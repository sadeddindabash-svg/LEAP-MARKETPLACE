# Leap Supplier Portal (Chinese-Language)

Real React (Vite) project for the Chinese supplier tool. See
`/docs/SRS.docx` Section 3.2 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_supplier_portal_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication, a real Products page, and real order
fulfillment** (view + status/tracking updates) — the supplier side of the
three-party marketplace is no longer just a disconnected mock. Overview,
Returns, Messages, Finance, and Settings (partially) are still mock data.
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

## Products page (SUP-010–012)

- `GET /supplier/me/products` — only this supplier's own products, scoped
  server-side (not just filtered in the UI) via `WHERE supplier_id = ...`.
- New product form (`AddProductForm`) submits to `POST /supplier/me/products`.
  New listings start in `translating` status — **a supplier cannot make
  their own product live to buyers without going through admin moderation
  first** (the same moderation queue built into the admin dashboard).
  Verified end-to-end: a product created here actually shows up in the
  admin's real moderation queue.
- `PATCH /supplier/me/products/:id` — edit price/stock. Ownership is
  enforced by the `WHERE` clause itself, not a lookup-then-check — trying
  to edit another supplier's product returns 404 (not 403), the same
  "don't confirm it exists" behavior used elsewhere in this codebase.
- **Fields dropped from the original mock form**: OEM number, fitment,
  description, and image upload. None of these are wired to real backend
  storage yet, and a form that visually accepts input it silently discards
  would be misleading — there's a note in the form itself explaining this,
  and category options were changed to match the mobile app's real
  category IDs (`brake`, `engine`, `electrical`, `filters`, `suspension`,
  `lighting`) so a product added here shows up correctly there.

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

Two test files, 15 tests total, all passing:
- `src/supplierPortal.integration.test.js` (10, REAL backend, no mocking):
  login with a real supplier JWT including `supplierId`, a buyer account
  correctly rejected from supplier endpoints, products scoped to only this
  supplier (confirms another supplier's product never appears), a created
  product verified to appear in the admin's real moderation queue, product
  edit ownership enforcement, and — the key one — placing a real order and
  marking it shipped with tracking, then confirming that exact tracking
  number and status via a **separate request as the admin**, proving the
  cross-app data flow is real.
- `src/App.test.jsx` (5, mocked fetch): login gate shows/hides correctly,
  a non-supplier role is rejected even with valid credentials, the language
  toggle works on the login screen itself, and logout clears the session.

The full existing admin-dashboard test suite (48 tests) was also re-run
against the updated backend to confirm the new supplier-accounts migration
and auth changes didn't break anything there — still 48/48 passing.

## Next steps to make this real

1. Wire Overview, Returns, Messages, and Finance/Payouts pages — each
   needs backend work first: Returns needs a return/dispute case table
   (doesn't exist yet, same gap noted in `services/api/db/README.md`),
   Messages needs a supplier-facing thread (the admin-side Tickets module
   could potentially be extended, or this needs its own path), and Payouts
   is blocked on the commission-rate decision (Charter Section 1) — same
   reason the admin dashboard's Payouts page is still mock.
2. Split `src/App.jsx` into separate files (pages/components) — same note
   as the admin dashboard; this file is large now.
3. Add the OEM/fitment/description/image fields to real backend storage,
   then restore them to the Add Product form.
4. Consider a bulk-upload CSV endpoint for `BulkUploadPanel`, which is
   still entirely mock (upload UI exists, nothing is processed).
