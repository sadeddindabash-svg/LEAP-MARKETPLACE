# Leap Auto Parts Marketplace

Multi-vendor, fitment-based auto parts e-commerce platform. Three-party model:
**Buyer app** ↔ **Platform (this repo's backend + admin)** ↔ **Supplier portal** (Chinese-language, China-based suppliers).

> Status: pre-development scaffold. See `/docs` for the full Software Requirements
> Specification and the project kickoff charter before writing code — they define
> scope, priorities (Must/Should/Could), and the open decisions still pending sign-off.

## Repository layout

```
leap-marketplace/
├── docs/                   Requirements, kickoff charter, and clickable UI prototypes
├── apps/
│   ├── mobile/             Buyer-facing app (iOS + Android)
│   ├── admin-dashboard/    Internal platform operations tool
│   └── supplier-portal/    Chinese-language supplier tool
├── services/
│   └── api/                Core backend services (catalog, cart, order, payment, user)
└── .github/workflows/       CI pipelines
```

Each `apps/*` and `services/*` folder has its own README with scope and suggested stack —
read that before scaffolding code inside it.

## Before you start building

1. Read `docs/SRS.docx` — especially Section 3 (Functional Requirements, tagged
   Must/Should/Could) and Section 11 (Appendix: Open Items Requiring Confirmation).
2. Read `docs/Project_Kickoff_Charter.docx` — Section 1 lists the decisions that
   must be resolved before implementation starts (mobile framework, launch
   countries, fitment data source, shipping partner, payment methods per
   country, commission structure, etc.).
3. Review the three prototypes in `docs/prototypes/` — they define the expected
   UI/UX and information architecture for the buyer app, admin dashboard, and
   supplier portal. They are React/Tailwind mockups with mock data, not
   production code — treat them as a visual and structural spec, not a
   dependency to import from.

## Suggested tech stack (from the SRS — confirm with your tech lead before locking in)

- **Mobile**: React Native or Flutter (cross-platform, to fit the 16-week Phase 1
  timeline and budget) — see Charter Section 1, "Mobile development approach"
- **Backend**: REST or GraphQL API layer, service-oriented around catalog,
  fitment, cart, order, user, notification, and payment orchestration
- **Admin dashboard / Supplier portal**: React web apps
- **Payments**: Stripe, PayPal, Google Pay, major card networks, plus
  region-specific methods added per launch market
- **Translation**: machine translation pipeline (Chinese → buyer-facing
  languages) with an optional human-review queue for top-selling SKUs
- **Infra**: cloud-hosted (AWS/GCP/Azure — not yet selected), multi-region-ready

## Contributing

See `CONTRIBUTING.md` for branching and commit conventions. Until the team and
tooling are finalized, keep changes scoped to scaffolding, configuration, and
documentation.

## License

Proprietary — see `LICENSE`. Not for external distribution.
