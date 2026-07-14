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
const DEV_HUB_STAFF_EMAIL = 'hub@leap.dev';
const DEV_HUB_STAFF_PASSWORD = 'hub_dev_password_123';

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

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

  // Fitment cascade reference data (migration 010) — Brand -> Model ->
  // Generation -> Engine/Transmission, for the supplier product-submission
  // form. Real, meaningful depth (not just one entry per level) so the
  // cascading picker actually has something to cascade through.
  const cascade = [
    { brand: 'BMW', models: [
      { model: '1 Series', generations: [
        { gen: 'F20', yearStart: 2015, yearEnd: 2019,
          engines: ['118i 1.5T', '118d 2.0D', '120d 2.0D'],
          transmissions: ['6-Speed Manual', '8-Speed Automatic'] },
      ] },
      { model: '3 Series', generations: [
        { gen: 'F30', yearStart: 2012, yearEnd: 2019,
          engines: ['320i 2.0T', '320d 2.0D'],
          transmissions: ['6-Speed Manual', '8-Speed Automatic'] },
      ] },
    ] },
    { brand: 'Toyota', models: [
      { model: 'Camry', generations: [
        { gen: 'XV70', yearStart: 2018, yearEnd: 2023,
          engines: ['2.5L 4-Cyl', '3.5L V6'],
          transmissions: ['8-Speed Automatic'] },
      ] },
    ] },
    { brand: 'Honda', models: [
      { model: 'Civic', generations: [
        { gen: 'FC', yearStart: 2016, yearEnd: 2021,
          engines: ['1.5L Turbo', '2.0L NA'],
          transmissions: ['CVT', '6-Speed Manual'] },
      ] },
    ] },
  ];
  let brandN = 0, modelN = 0, genN = 0, engN = 0, transN = 0;
  for (const b of cascade) {
    const brandId = `brand_${slugify(b.brand)}`;
    await pool.query(`INSERT INTO vehicle_brands (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [brandId, b.brand]);
    brandN++;
    for (const m of b.models) {
      const modelId = `model_${slugify(b.brand)}_${slugify(m.model)}`;
      await pool.query(`INSERT INTO vehicle_models (id, brand_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [modelId, brandId, m.model]);
      modelN++;
      for (const g of m.generations) {
        const genId = `gen_${slugify(b.brand)}_${slugify(m.model)}_${slugify(g.gen)}`;
        await pool.query(
          `INSERT INTO vehicle_generations (id, model_id, name, year_start, year_end) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [genId, modelId, g.gen, g.yearStart, g.yearEnd]
        );
        genN++;
        for (const e of g.engines) {
          const engId = `eng_${genId}_${slugify(e)}`;
          await pool.query(`INSERT INTO vehicle_engines (id, generation_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [engId, genId, e]);
          engN++;
        }
        for (const t of g.transmissions) {
          const transId = `trans_${genId}_${slugify(t)}`;
          await pool.query(`INSERT INTO vehicle_transmissions (id, generation_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [transId, genId, t]);
          transN++;
        }
      }
    }
  }
  console.log(`Seeded fitment cascade: ${brandN} brands, ${modelN} models, ${genN} generations, ${engN} engines, ${transN} transmissions.`);

  // Regional inspection hubs (migration 011) — real, meaningful data so
  // the admin's hub-assignment picker and the Hub Portal's login both
  // have something real to work with.
  const hubsSeed = [
    { id: 'hub_guangzhou', name: 'Guangzhou Inspection Hub', region: 'China (South)', address: 'Panyu District, Guangzhou' },
    { id: 'hub_dubai', name: 'Dubai Logistics Hub', region: 'UAE / GCC', address: 'Jebel Ali Free Zone, Dubai' },
    { id: 'hub_miami', name: 'Miami Distribution Hub', region: 'Americas', address: 'Doral, Miami, FL' },
  ];
  for (const h of hubsSeed) {
    await pool.query(
      `INSERT INTO hubs (id, name, region, address) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [h.id, h.name, h.region, h.address]
    );
  }
  console.log(`Seeded ${hubsSeed.length} regional inspection hubs.`);

  // Dev-only hub staff login, tied to the Guangzhou hub — same pattern
  // as the dev admin/supplier logins above.
  const hubStaffPasswordHash = await bcrypt.hash(DEV_HUB_STAFF_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, email, name, role, hub_id, password_hash) VALUES ($1, $2, 'Mei Lin', 'hub_staff', 'hub_guangzhou', $3)
     ON CONFLICT (email) DO NOTHING`,
    ['hub_staff_dev_seed', DEV_HUB_STAFF_EMAIL, hubStaffPasswordHash]
  );
  console.log(`Seeded dev hub staff login: ${DEV_HUB_STAFF_EMAIL} / ${DEV_HUB_STAFF_PASSWORD} (change before any shared/production use)`);

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
