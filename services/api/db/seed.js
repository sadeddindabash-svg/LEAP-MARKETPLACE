#!/usr/bin/env node
/**
 * Seeds development data — matches the same suppliers/vehicles/products
 * that were previously hardcoded in the in-memory catalog/fitment modules,
 * so behavior is consistent after switching to a real database. Safe to
 * re-run: uses ON CONFLICT DO NOTHING throughout.
 *
 * Usage: node db/seed.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DEV_ADMIN_EMAIL = 'admin@leap.dev';
const DEV_ADMIN_PASSWORD = 'admin_dev_password_123';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });

  await pool.query(`
    INSERT INTO suppliers (id, name, country, verification_status) VALUES
      ('s1', 'Guangzhou AutoParts Co.', 'China', 'verified'),
      ('s2', 'Ningbo Filtration Ltd.', 'China', 'verified')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO vehicles (id, make, model, trim, years_range) VALUES
      ('v1', 'BMW', '1 Hatchback (F20)', '118d 2.0', '2015–2019'),
      ('v2', 'Toyota', 'Camry (XV70)', '2.5L SE', '2018–2023'),
      ('v3', 'Honda', 'Civic (FC)', '1.5L Turbo Sport', '2016–2021')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO products (id, supplier_id, name, category, price, currency_code, stock_quantity, estimated_delivery_days, rating, review_count) VALUES
      ('p1', 's1', 'RIDEX Front Brake Disc, Vented 300mm', 'brake', 34.90, 'USD', 320, 6, 4.6, 812),
      ('p4', 's2', 'MAHLE Oil Filter Element', 'filters', 6.90, 'USD', 540, 4, 4.7, 2210)
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO product_fitment (product_id, vehicle_id) VALUES
      ('p1', 'v1'),
      ('p4', 'v1'), ('p4', 'v2'), ('p4', 'v3')
    ON CONFLICT DO NOTHING;
  `);

  // Dev-only admin account so the admin dashboard's login screen has
  // something real to log in with. CHANGE THIS PASSWORD before any
  // non-local use — it's printed in plaintext right here in the seed
  // script, which is fine for a throwaway local dev database and not fine
  // for anything else.
  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, email, name, role, password_hash) VALUES ($1, $2, 'Dev Admin', 'admin', $3)
     ON CONFLICT (email) DO NOTHING`,
    ['admin_dev_seed', DEV_ADMIN_EMAIL, passwordHash]
  );
  console.log(`Seeded dev admin login: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD} (change before any shared/production use)`);

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
