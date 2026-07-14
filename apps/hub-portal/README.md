# Leap Inspection Hub Portal

The fourth real party in the marketplace, alongside the buyer app, the
admin dashboard, and the supplier portal: **regional inspection hub
staff**. Every order now has two real shipping legs, always —
**Supplier → Hub → Buyer** — confirmed as an explicit business decision,
not assumed. A supplier never ships directly to a buyer. See
`services/api/README.md`'s "Inspection Hubs" section for the full
backend design and reasoning.

## Status

Built from scratch this pass — real authentication, a real inbound
shipment queue, and a real step-by-step inspection workflow (receive →
open → inspect → pack → ship to buyer), each step requiring a genuine
uploaded evidence photo. Not a mock — every action here calls the real
backend and is verified against it.

## Why a separate app, not a page in the admin dashboard

- **Different job, different user.** Hub staff aren't admins — they
  shouldn't see supplier payouts, dispute resolution, or platform
  settings. They need one thing: what's in front of them right now, and
  what to do with it.
- **Different device, different UI shape.** This is camera-heavy,
  checklist-driven work happening on a warehouse floor, likely on a
  phone or tablet — not a dense multi-page desktop dashboard. The
  layout here is deliberately one-task-at-a-time and camera-forward,
  unlike the admin dashboard and supplier portal's denser desk-bound
  style.
- **Least privilege.** A hub in one region shouldn't see another
  region's shipments, and shouldn't have any access to buyer financial
  data — enforced server-side via `hub_id` scoping, the same pattern as
  supplier accounts and `supplier_id`.

## Authentication

Real login against `POST /auth/login`, same endpoint every other app
uses. Rejects (client-side, with a clear message) any successfully
authenticated account that isn't `role: 'hub_staff'` — this portal
should never show a supplier or buyer their own account "logged in
successfully" only to display an empty, meaningless queue.

## Inbound queue

`GET /hub/me/shipments` — scoped server-side to this hub's own
`hub_id`, not just filtered in the UI. Real filter tabs (All / Awaiting
receipt / In progress / Shipped / Flagged) — no fabricated counts, all
computed from the real fetched list.

## The inspection workflow

Real, ordered, cannot-be-skipped steps, matching the backend's own
enforcement (`services/api/src/modules/hub/routes.js`) exactly — this
UI doesn't invent an order of its own that could drift from what the
server actually allows:

1. **Received** — photograph the package as it arrives
2. **Opened** — photograph the contents
3. **Inspected** — photograph the part clearly (orientation, side, OEM markings)
4. **Packed** — photograph it repackaged and ready
5. **Shipped to buyer** — photograph the final label, and a tracking
   number is required here specifically

At any point before the final step, staff can **flag a quality issue**
instead (wrong item, damage, mismatch) — a real branch in the backend's
status machine, not a cosmetic dead-end button. Each of these is
enforced server-side too: submitting a step out of order, or with zero
photos, is rejected with a clear error — this isn't just a client-side
nicety a crafted request could bypass.

**Honest limitation, shared with the supplier portal's product
photos**: evidence photos are stored on the backend's local disk,
served statically — real and working, not a stub, but production would
want real object storage (S3, etc.) instead. See
`services/api/src/modules/uploads/routes.js`'s header comment.

## History / audit trail

Every shipment detail view shows the complete real record — every
step, its notes, its photos, who performed it, and when. The same
underlying data is also visible from the admin dashboard's Order detail
page (see `apps/admin-dashboard/README.md`), so an admin doesn't need
to ask hub staff what happened — it's already there.

## Setup

```bash
cd apps/hub-portal
npm install
cp .env.example .env.local   # points at your local backend
npm run dev
```

Requires `services/api` running with migrations applied
(`node db/migrate.js`) and seeded (`node db/seed.js` — seeds 3 real
regional hubs and a dev hub-staff login:
`hub@leap.dev` / `hub_dev_password_123`, scoped to the Guangzhou hub).

## Testing

Two test files, 9 tests, all passing:

- `src/App.test.jsx` (6, mocked, full component tree) — real login and
  role rejection for non-hub-staff accounts, opening a shipment shows
  real items and the correct next-step prompt, confirming a step with
  zero photos is blocked, the flag-an-issue panel opens and cancels
  correctly, logout clears the session.
- `src/hubPortal.integration.test.js` (3, REAL backend, forces
  `@vitest-environment node` for genuine multipart photo uploads — same
  reason as `supplier-portal/src/productSubmission.integration.test.js`,
  jsdom's fetch/FormData/Blob don't correctly serialize real multipart
  bodies): uploads a real photo via this app's own upload helper and
  confirms it's genuinely served back, a too-small real photo is
  rejected, and — the critical one — the FULL real workflow using this
  app's own API helpers end-to-end: `fetchMyShipments` finds a shipment
  a supplier really shipped, `recordShipmentEvent` advances it through
  every real step with real uploaded photos, and the same journey is
  confirmed visible from the admin dashboard's order detail view
  afterward — proving this isn't a self-consistent mock, it's genuinely
  shared data.

## Next steps to make this real

1. Localization — this portal is English-only for now, unlike the
   supplier portal's bilingual Chinese/English support. If hub staff in
   non-English-speaking regions need this, the same `LangContext`
   pattern used in the supplier portal could be extended here.
2. Wire the "flag a quality issue" outcome into the existing
   Returns/Disputes system, so a flagged shipment automatically creates
   a real return case rather than just being visible to admin as a
   flag.
3. Real object storage for evidence photos (see the honest limitation
   noted above) — same next step already flagged for product photos.
4. Buyer-facing mobile tracking UI showing the expanded two-leg journey
   (the backend already supports this via the order detail endpoint;
   the mobile screen itself hasn't been built yet).
