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
require('dotenv').config();

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

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
