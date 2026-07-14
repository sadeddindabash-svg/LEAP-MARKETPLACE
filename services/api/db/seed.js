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
const DEV_SUPPLIER_EMAIL = 'supplier@leap.dev';
const DEV_SUPPLIER_PASSWORD = 'supplier_dev_password_123';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });

  await pool.query(`
    INSERT INTO suppliers (id, name, country, contact_email, verification_status) VALUES
      ('s1', 'Guangzhou AutoParts Co.', 'China', 'wei.zhang@gzauto.cn', 'verified'),
      ('s2', 'Ningbo Filtration Ltd.', 'China', 'li.chen@ningbofilt.cn', 'verified'),
      ('s3', 'Qingdao Transmission Works', 'China', 'hao.xu@qdtrans.cn', 'pending')
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
    INSERT INTO products (id, supplier_id, name, category, price, currency_code, stock_quantity, estimated_delivery_days, rating, review_count, status) VALUES
      ('p1', 's1', 'RIDEX Front Brake Disc, Vented 300mm', 'brake', 34.90, 'USD', 320, 6, 4.6, 812, 'active'),
      ('p4', 's2', 'MAHLE Oil Filter Element', 'filters', 6.90, 'USD', 540, 4, 4.7, 2210, 'active'),
      ('p9', 's3', '6-Speed Manual Transmission Gear Set', 'transmission', 210.00, 'USD', 40, 12, NULL, 0, 'translating')
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

  // Support tickets — one open (guest, unanswered), one in_progress (has
  // an admin reply already) so the admin dashboard has something real in
  // both states to display and act on.
  //
  // NOTE: the ticket rows themselves are idempotent (ON CONFLICT (id) DO
  // NOTHING on a real primary key), but the message inserts below are NOT
  // — support_ticket_messages has no natural unique key to conflict on,
  // so re-running this seed script multiple times will insert duplicate
  // messages under the same tickets. Low-stakes for local dev seed data;
  // fix with a proper "only seed messages if this ticket is new" check
  // before using this seed script anywhere that matters.
  await pool.query(`
    INSERT INTO support_tickets (id, guest_email, subject, status, priority) VALUES
      ('T-5500', 'ticket-guest@example.com', 'Wrong brake disc size delivered', 'open', 'high')
    ON CONFLICT (id) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO support_ticket_messages (ticket_id, sender_role, message) VALUES
      ('T-5500', 'buyer', 'I ordered a 300mm disc but received a 290mm one. Can you help?')
    ON CONFLICT DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO support_tickets (id, guest_email, subject, status, priority) VALUES
      ('T-5501', 'another-guest@example.com', 'Refund status inquiry', 'in_progress', 'medium')
    ON CONFLICT (id) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO support_ticket_messages (ticket_id, sender_role, message) VALUES
      ('T-5501', 'buyer', 'When will my refund be processed?'),
      ('T-5501', 'admin', 'Your refund has been submitted to your original payment method and should land within 5-7 business days.')
    ON CONFLICT DO NOTHING;
  `);

  // Dev-only supplier portal login, tied to supplier s1 (Guangzhou
  // AutoParts Co.) — same pattern as the dev admin login above. CHANGE
  // THIS PASSWORD before any shared/production use.
  const supplierPasswordHash = await bcrypt.hash(DEV_SUPPLIER_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, email, name, role, supplier_id, password_hash) VALUES ($1, $2, 'Wei Zhang', 'supplier', 's1', $3)
     ON CONFLICT (email) DO NOTHING`,
    ['supplier_dev_seed', DEV_SUPPLIER_EMAIL, supplierPasswordHash]
  );
  console.log(`Seeded dev supplier login: ${DEV_SUPPLIER_EMAIL} / ${DEV_SUPPLIER_PASSWORD} (change before any shared/production use)`);

  // Return/dispute case — only seeded if a real supplier_sub_order already
  // exists to attach it to (sub-orders are only created via real order
  // placement, so this is conditional rather than a hardcoded ID that
  // might not exist in a given database).
  const existingSubOrder = await pool.query(
    `SELECT so.id, so.order_id FROM supplier_sub_orders so WHERE so.supplier_id = 's1' ORDER BY so.id ASC LIMIT 1`
  );
  if (existingSubOrder.rows.length > 0) {
    const { id: subOrderId, order_id: orderId } = existingSubOrder.rows[0];
    await pool.query(
      `INSERT INTO return_cases (id, order_id, sub_order_id, guest_email, reason, status) VALUES
        ('RC-3400', $1, $2, 'seed-return-buyer@example.com', 'Wrong brake disc size delivered', 'awaiting')
       ON CONFLICT (id) DO NOTHING`,
      [orderId, subOrderId]
    );
    await pool.query(
      `INSERT INTO return_case_buyer_messages (case_id, sender_role, message) VALUES
        ('RC-3400', 'buyer', 'I ordered a 300mm disc but received a 290mm one. Can you help?')
       ON CONFLICT DO NOTHING`
    );
    console.log('Seeded a return case (RC-3400) against an existing order for supplier s1.');
  } else {
    console.log('Skipped seeding a return case — no supplier_sub_orders exist yet (place an order first if you want demo data here).');
  }

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
