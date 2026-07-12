# Core API Service

Backend services shared by the buyer app, admin dashboard, and supplier
portal. Corresponds to SRS Section 6 (System Architecture Overview) and
Section 7 (Data Requirements).

## Suggested service boundaries

- **Catalog** — products, categories, translations
- **Fitment** — Year/Make/Model/Trim reference data (Phase 1), VIN decoding (Phase 2)
- **Cart & Order** — cart state, checkout, per-supplier sub-order splitting,
  order lifecycle
- **User** — buyer, supplier, and admin accounts, roles, saved
  vehicles/addresses
- **Payment** — abstraction over Stripe / PayPal / Google Pay / card networks
  / region-specific methods, so the rest of the system doesn't care which
  gateway processed a given transaction
- **Notification** — SMS / email / push
- **Translation** — machine translation pipeline with a human-review queue hook

These can start as modules within one service and be split into separate
services later — don't over-engineer microservices before there's a reason to.

## Core data entities

See `docs/SRS.docx` Section 7.1 for the full entity list (User, Supplier,
Vehicle Reference, Product/SKU, Fitment Mapping, Order, Supplier Sub-Order,
Payment Transaction, Commission/Payout Record, Return/Dispute Case,
Review/Rating, Support Ticket/Chat).

## Environment variables

Copy `.env.example` (once created) to `.env` for local development. Never
commit real credentials — payment gateway keys, database URLs, and
translation API keys are secrets.

## Getting started

Placeholder folder. Scaffold your chosen backend framework here once the
tech lead confirms the stack (REST vs. GraphQL, language/framework, and
database choice).
