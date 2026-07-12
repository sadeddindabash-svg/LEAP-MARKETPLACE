# Admin Dashboard (Platform Operations)

Internal tool used by Leap staff to operate the marketplace. Corresponds to
SRS Section 3.3 (Platform Admin Backend) and the clickable reference in
`docs/prototypes/leap_admin_dashboard_prototype.jsx`.

## Scope (Phase 1 / Must Have)

- Supplier & catalog management, moderation (ADM-001–003)
- Order, dispute & support management (ADM-010–013)
- Commission, payouts & financial reporting (ADM-020–023)
- Roles, access control & audit trail (ADM-030–031)

Full requirement text and priority tags: `docs/SRS.docx`, Section 3.3.

## Suggested stack

React web app (see prototype for component/screen structure: Overview,
Orders, Order Detail, Suppliers, Moderation, Payouts, Support Tickets,
Settings). Recharts is used for the KPI/trend charts in the prototype —
reasonable default for the real build too, or substitute your team's
preferred charting library.

## Getting started

Placeholder folder. Once scaffolded:

1. Rebuild the seven screens from `docs/prototypes/leap_admin_dashboard_prototype.jsx`
   against real API endpoints instead of the mock data arrays in that file.
2. Role-based access (Super Admin, Catalog Moderator, Support Agent, Finance
   Admin — ADM-030) should gate navigation and actions from day one, not be
   retrofitted later.
3. Every action that touches money or account status (refunds, payouts,
   supplier suspension) must write to an audit log (ADM-031) — don't skip
   this for the MVP.
