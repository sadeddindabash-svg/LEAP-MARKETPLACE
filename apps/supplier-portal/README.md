# Supplier Portal (Chinese-Language)

Tool used exclusively by verified China-based suppliers to manage listings,
inventory, and order fulfillment. Corresponds to SRS Section 3.2
(Supplier Portal) and the clickable, bilingual reference in
`docs/prototypes/leap_supplier_portal_prototype.jsx`.

## Scope (Phase 1 / Must Have)

- Supplier onboarding & verification (SUP-001–003)
- Product & inventory management: manual entry + bulk upload (SUP-010–015)
- Order fulfillment: accept, ship, tracking numbers (SUP-020–022)
- Communication & finance: Platform-only messaging, payouts (SUP-030–032)

Full requirement text and priority tags: `docs/SRS.docx`, Section 3.2.

## Important constraints — do not relax these

- **Chinese is the primary working language.** The prototype includes an
  English toggle for internal/ops use (e.g. bilingual staff or auditors
  checking on a supplier), but the default and primary experience for actual
  suppliers should be Chinese. Confirm with product before exposing the
  language toggle to real suppliers.
- **No direct buyer contact.** There is no buyer chat, buyer phone number, or
  buyer shipping address detail beyond region/country anywhere in this app —
  this is an explicit business requirement (SRS Section 2.5), not an
  oversight to "fix" later.
- **Settlement currency is RMB (¥)** regardless of UI language.

## Getting started

Placeholder folder. Once scaffolded, rebuild the seven screens from the
prototype (Overview, Products, Orders, Returns, Messages, Finance, Settings)
against real API endpoints, keeping the bilingual dictionary pattern
(`STRINGS.zh` / `STRINGS.en`) rather than hardcoding either language.
