# Database

Real PostgreSQL persistence — replaces the earlier in-memory storage.
Confirmed working: an order placed through the API survives a full server
restart (previously, restarting the server lost everything).

## Local setup

**1. Install PostgreSQL** (if you don't already have it):
- macOS: `brew install postgresql@16 && brew services start postgresql@16`
- Windows: download the installer from https://www.postgresql.org/download/windows/
- Linux: `sudo apt-get install postgresql postgresql-contrib`

**2. Create a database and user:**
```bash
psql -U postgres
```
```sql
CREATE USER leap_dev WITH PASSWORD 'choose_a_local_password' CREATEDB;
CREATE DATABASE leap_marketplace_dev OWNER leap_dev;
```

**3. Set `DATABASE_URL`** in `services/api/.env` (copy from `.env.example` if you haven't already):
```
DATABASE_URL=postgresql://leap_dev:choose_a_local_password@localhost:5432/leap_marketplace_dev
```

**4. Run migrations:**
```bash
cd services/api
node db/migrate.js
```

**5. (Optional but recommended for local dev) Seed reference data:**
```bash
node db/seed.js
```
This adds the same sample suppliers/vehicles/products that were previously
hardcoded in-memory, so the app behaves the same way it did in earlier demos.
It also seeds a dev admin login (`admin@leap.dev` / `admin_dev_password_123`)
so the admin dashboard's login screen has something real to log in with,
and a dev supplier login (`supplier@leap.dev` / `supplier_dev_password_123`,
tied to supplier `s1`) for the supplier portal —
**change these passwords before any shared or production use.**

**6. Start the API as normal:**
```bash
npm run dev
```

## Schema

See `migrations/001_init.sql` for the full schema with comments. Summary:

| Table | Purpose |
|---|---|
| `suppliers` | China-based sellers, incl. `contact_email` (migration 004) |
| `users` | Buyers, admin, and now supplier accounts (`role` + `supplier_id`, migration 006) |
| `vehicles` | Year/Make/Model/Trim fitment reference data (Phase 1) |
| `products` | Catalog items |
| `product_fitment` | Which vehicles a product is confirmed to fit |
| `carts` / `cart_items` | Buyer shopping carts |
| `orders` | One row per buyer order (guest or logged-in) |
| `supplier_sub_orders` | Per-supplier split of a single order (BUY-031) |
| `order_line_items` | Line items within a supplier sub-order |
| `payment_transactions` | Every payment attempt, across all gateways |
| `support_tickets` / `support_ticket_messages` | Buyer↔platform support (migration 005) — no buyer↔supplier path exists, by design |
| `return_cases` / `return_case_buyer_messages` / `return_case_supplier_messages` | Return/dispute cases (migration 007) — TWO separate message tables, not one shared thread, structurally enforcing no direct buyer↔supplier contact |
| `user_saved_vehicles` | A buyer's own saved vehicles (migration 008) — distinct from `vehicles` (the shared reference catalog); conflating the two would show every vehicle in the system as "saved" |
| `password_reset_tokens` | Password reset tokens (migration 009) — one-time-use, 60-minute expiry, separate table rather than columns on `users` so a second reset request doesn't need extra bookkeeping to invalidate the first |
| `vehicle_brands` / `vehicle_models` / `vehicle_generations` / `vehicle_engines` / `vehicle_transmissions` | The structured Brand->Model->Generation->Engine/Transmission cascade (migration 010) for supplier product submission — a SEPARATE, deeper hierarchy from `vehicles`, not a replacement; see that migration's header comment |
| `product_fitment_entries` | A submitted product's specific fitment claim(s) — many-to-many against `vehicle_generations`, with an optional specific engine/transmission |
| `product_images` | Mandatory product photos (migration 010) — the "at least 3" rule is enforced in application code, not a DB constraint |
| `hubs` | Regional inspection hubs (migration 011) — the physical facilities between suppliers and buyers |
| `hub_shipments` | The hub's own leg of a shipment's journey (Hub -> Buyer) — a real status machine (`awaiting_receipt` through `shipped_to_buyer`, plus `flagged`), created automatically the moment a supplier actually marks their leg shipped, one row per `supplier_sub_orders` row |
| `hub_shipment_events` | The real audit trail — one row per inspection step actually performed, by whom, with notes |
| `hub_shipment_photos` | Mandatory evidence photos per step (migration 011) — same "enforced in application code, not a DB constraint" pattern as `product_images` |
| `products.name_ar` / `products.description_ar` | Arabic translation (migration 012), required to approve a listing — same rule as the existing `name`/`description` columns, which continue to mean "the default/English-facing value" rather than being renamed to `name_en` (see that migration's header comment for why) |
| `products.weight_kg` / `products.length_cm` / `products.width_cm` / `products.height_cm` | Real shipping dimensions and weight (migration 013), mandatory for new supplier submissions (enforced in application code, not a DB constraint) — will feed a real shipping-fee calculation in the admin dashboard, which is why these are stored as real numbers rather than free text |
| `pricing_fee_components` | Real, admin-managed fee variables (migration 014) — Leap Platform Fee, Bank Fee, Shipping Fee, etc. — applied in `sort_order` sequence to compute a buyer's USD price from a supplier's RMB cost |
| `fx_rates` | One row per currency pair (migration 014); only `CNY_USD` is used today. Holds the real, manually-set exchange rate the pricing engine actually uses — see that module's header comment for why there's no live-rate API configured in this environment |
| `product_categories` | Real, admin-managed major categories (migration 015) — id values match the hardcoded identifiers used since migration 001, so existing products' `category` values need no migration |
| `category_parts` | Real, admin-managed parts scoped to a category (migration 015) — what a supplier picks from instead of typing free text into `products.part`, which stays plain text (validated against this table in application code, not a foreign key) |
| `supplier_messages` | Real supplier ↔ platform messaging (migration 016), deliberately separate from `support_tickets` — see `services/api/README.md`'s "Real supplier messaging" section. Stores BOTH the real original text and its real translation (translated once at send time, not on every read) — `translated_text` is genuinely `NULL` when no real translation API credentials are configured, never a fabricated value |
| `buyer_addresses` | Real buyer address book (migration 017), capped at 3 per buyer in application code, not a DB constraint. Exactly one `is_default` at all times is enforced transactionally — see `services/api/README.md`'s "Real buyer address book" section |

**Not yet covered** (add a future migration once these backend modules
exist — currently only in the admin-dashboard/supplier-portal prototypes,
not real endpoints): commission/payout records, review/rating storage.

## Migration runner

`db/migrate.js` is a minimal, dependency-free migration runner — it just
tracks which `.sql` files in `db/migrations/` have been applied, in
filename order, in a `schema_migrations` table. It's intentionally simple
for the project's current stage. Swap it for a proper tool (node-pg-migrate,
Knex, Prisma Migrate) once the schema is evolving fast enough to need
rollback support or a more expressive migration DSL.

To add a new migration: create `db/migrations/003_whatever.sql` and run
`node db/migrate.js` again — it only applies files it hasn't seen before.

## What was and wasn't tested

This was built and verified against a real local PostgreSQL 16 instance,
not just written and hoped to work:
- Migrations apply cleanly and are idempotent (re-running skips applied ones)
- Seed data loads correctly
- Catalog, fitment, cart, order, and user endpoints all verified against
  real queries (not mocks)
- **The core guarantee this work exists for**: placed a real order, killed
  the server process entirely, started a fresh process, and confirmed the
  order and cart were both still there
- Transaction integrity: an order with an invalid product ID correctly
  rolls back with no partial data left in the database (verified by
  checking the row count directly in Postgres, not just trusting the API
  response)

Not yet done: connection pooling under real concurrent load, backup/restore
strategy, and moving from the local dev database to a managed hosted
Postgres instance for staging/production (e.g. RDS, Cloud SQL, Supabase,
Neon, Railway) — pick one during infrastructure setup (see Charter
Section 4).
