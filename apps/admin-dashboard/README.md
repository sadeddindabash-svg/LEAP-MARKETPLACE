# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx`, confirmed to **build successfully**, and now
has **real authentication** gating access to it. Page data (Orders,
Suppliers, Moderation, Payouts, Tickets) is still mock data — only the
login gate itself is real, not yet the dashboard's content.

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

## Testing

```bash
npm test
```

Two test files:
- `src/App.test.jsx` — 7 tests with mocked `fetch`: successful admin login,
  a non-admin login is correctly rejected even with valid credentials, wrong
  password shows the API's real error message, session restores from a
  saved token, an expired/invalid saved token is cleared rather than
  leaving the app stuck, and logout works.
- `src/auth.integration.test.js` — 4 tests against the **real running
  backend**, no mocking (skips automatically if `services/api` isn't
  running locally, so this won't break a CI run without a database
  available). This is what actually proves the login flow works
  end-to-end, not just that the mocked assumptions are internally
  consistent.

## Next steps to make this real

1. Wire the `TopBar`'s hardcoded user display to the real logged-in admin
   (see "Known gap" above).
2. Split `src/App.jsx` into separate files under `src/pages/` and
   `src/components/` — it currently works as one large file (that's how
   the prototype was authored) but should be broken up before more people
   work on it.
3. Replace mock data (`ORDERS`, `SUPPLIERS`, `MODERATION_QUEUE`, `PAYOUTS`,
   `TICKETS` arrays near the top of the file) with real fetches to
   `services/api`, sending the auth token on each request. The Orders page
   can be wired first — `GET /order` already exists, returns real data, and
   (as of the auth work) is already scoped to admins seeing everything.
4. Add the missing backend endpoints this dashboard needs and doesn't yet
   have: suppliers, catalog moderation queue, payouts, support tickets.
5. Consider code-splitting (the build currently warns about a >500kB bundle)
   once real routing is introduced — e.g. React Router with lazy-loaded pages.
