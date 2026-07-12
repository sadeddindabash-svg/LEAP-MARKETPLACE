# Leap Admin Dashboard

Real React (Vite) project for the platform operations tool. See
`/docs/SRS.docx` Section 3.3 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_admin_dashboard_prototype.jsx`)
dropped in as `src/App.jsx` and confirmed to **build successfully** with
`npm run build` (Vite + React 19 + recharts + lucide-react). All data is
still mock data defined at the top of `App.jsx` — nothing is wired to
`services/api` yet.

## Setup

```bash
cd apps/admin-dashboard
npm install
npm run dev       # http://localhost:5173
```

## Next steps to make this real

1. Split `src/App.jsx` into separate files under `src/pages/` and
   `src/components/` — it currently works as one large file (that's how
   the prototype was authored) but should be broken up before more people
   work on it.
2. Replace mock data (`ORDERS`, `SUPPLIERS`, `MODERATION_QUEUE`, `PAYOUTS`,
   `TICKETS` arrays near the top of the file) with real fetches to
   `services/api`. The Orders page can be wired first — `GET /order`
   already exists and returns real (in-memory) data.
3. Add authentication and role-based route guarding (ADM-030) — there's no
   login screen yet.
4. Add the missing backend endpoints this dashboard needs and doesn't yet
   have: suppliers, catalog moderation queue, payouts, support tickets.
5. Consider code-splitting (the build currently warns about a >500kB bundle)
   once real routing is introduced — e.g. React Router with lazy-loaded pages.
