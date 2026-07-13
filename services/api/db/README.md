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

**Not yet covered** (add a future migration once these backend modules
exist — currently only in the admin-dashboard/supplier-portal prototypes,
not real endpoints): commission/payout records, return/dispute cases,
review/rating storage.

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
