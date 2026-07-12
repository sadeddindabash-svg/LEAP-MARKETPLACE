# Leap Supplier Portal (Chinese-Language)

Real React (Vite) project for the Chinese supplier tool. See
`/docs/SRS.docx` Section 3.2 for the full requirement list.

## Status

This is the reference prototype (`docs/prototypes/leap_supplier_portal_prototype.jsx`)
dropped in as `src/App.jsx` and confirmed to **build successfully** with
`npm run build` (Vite + React 19 + recharts + lucide-react). It includes a
working 中文/EN language toggle (bilingual `STRINGS` dictionary pattern —
see the file's top section) and mock data — nothing is wired to
`services/api` yet.

## Important constraints — do not relax these when wiring up real data

- **No direct buyer contact anywhere.** No buyer chat, phone number, or
  full address — only region/country. This is a business requirement, not
  an oversight.
- **Settlement currency is RMB (¥)** regardless of UI language.
- The 中文/EN toggle is intended for internal/bilingual ops use. Confirm
  with product before assuming real suppliers should see the English option.

## Setup

```bash
cd apps/supplier-portal
npm install
npm run dev       # http://localhost:5173
```

## Next steps to make this real

1. Split `src/App.jsx` into separate files (pages/components) — same note
   as the admin dashboard.
2. Replace mock data with real fetches to `services/api`. The Products page
   can be wired first — `GET /catalog/products` already exists.
3. Add supplier authentication/session (this portal has no login yet).
4. Add the missing backend endpoints: bulk upload processing, returns/
   disputes, messages, payouts detail.
5. Keep the bilingual `STRINGS.zh` / `STRINGS.en` pattern for any new UI text
   — don't hardcode strings in either language.
