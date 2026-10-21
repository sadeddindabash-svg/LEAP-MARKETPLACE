// Records, for each line of an order that has just been written, WHICH CAR the part is for (see choose.js for the rule). It is called INSIDE the order's own transaction, just before it
// commits, and it is built so that it can NEVER stop an order: everything it does runs in a SAVEPOINT, so if anything unexpected happens it is undone, the problem is logged, and the order
// still goes through without a car (the supplier simply sees no car for it).
const { chooseCar } = require('./choose');

async function writeOrderVehicles(client, { orderId, userId }) {
  const { rows: lines } = await client.query(
    `SELECT oli.id, oli.product_id FROM order_line_items oli JOIN supplier_sub_orders so ON so.id = oli.sub_order_id WHERE so.order_id = $1 ORDER BY oli.id`, [orderId]);
  if (lines.length === 0) return 0;

  const { rows: fit } = await client.query('SELECT product_id, generation_id, year FROM product_fitment_entries WHERE product_id = ANY($1)', [[...new Set(lines.map((l) => l.product_id))]]);
  const entriesOf = new Map();
  for (const f of fit) { if (!entriesOf.has(f.product_id)) entriesOf.set(f.product_id, []); entriesOf.get(f.product_id).push(f); }
  const garage = userId
    ? (await client.query('SELECT generation_id, year, version_id, is_default, created_at FROM user_saved_generations WHERE buyer_id = $1 ORDER BY is_default DESC, created_at DESC', [userId])).rows
    : [];

  const decisions = lines.map((line) => ({ line, ...chooseCar(entriesOf.get(line.product_id) || [], garage) }));
  const cars = decisions.filter((d) => d.car).map((d) => d.car);
  const generationIds = [...new Set(cars.map((c) => c.generation_id))];
  const versionIds = [...new Set(cars.map((c) => c.version_id).filter(Boolean))];
  const generations = new Map(), versions = new Map();
  if (generationIds.length) {
    const { rows } = await client.query(
      `SELECT g.id, b.name AS brand, b.name_ar AS brand_ar, b.name_zh AS brand_zh, m.name AS model, m.name_ar AS model_ar, m.name_zh AS model_zh,
              g.photo_url AS generation_photo, m.photo_url AS model_photo, b.photo_url AS brand_photo
       FROM vehicle_generations g JOIN vehicle_models m ON m.id = g.model_id JOIN vehicle_brands b ON b.id = m.brand_id WHERE g.id = ANY($1)`, [generationIds]);
    for (const r of rows) generations.set(r.id, r);
  }
  if (versionIds.length) {
    const { rows } = await client.query('SELECT id, name, name_ar, name_zh, engine, engine_ar, engine_zh, seats, photo_url FROM vehicle_versions WHERE id = ANY($1)', [versionIds]);
    for (const r of rows) versions.set(r.id, r);
  }

  let written = 0;
  for (const d of decisions) {
    const gen = d.car ? generations.get(d.car.generation_id) : null;
    // a car whose model no longer exists cannot be described: it is treated as "no car" rather than guessed
    const status = d.car && !gen ? 'no_car' : d.status;
    const car = status === 'listed' || status === 'not_listed' ? d.car : null;
    const ver = car && car.version_id ? versions.get(car.version_id) || null : null;
    const photo = car ? (ver && ver.photo_url) || gen.generation_photo || gen.model_photo || gen.brand_photo || null : null;
    const { rowCount } = await client.query(
      `INSERT INTO order_line_vehicles (line_item_id, status, is_default_car, generation_id, year, version_id, brand, brand_ar, brand_zh, model, model_ar, model_zh,
         version, version_ar, version_zh, engine, engine_ar, engine_zh, seats, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (line_item_id) DO NOTHING`,
      [d.line.id, status, car ? d.isDefault : null, car ? car.generation_id : null, car ? car.year : null, ver ? ver.id : null,
        car ? gen.brand : null, car ? gen.brand_ar : null, car ? gen.brand_zh : null, car ? gen.model : null, car ? gen.model_ar : null, car ? gen.model_zh : null,
        ver ? ver.name : null, ver ? ver.name_ar : null, ver ? ver.name_zh : null, ver ? ver.engine : null, ver ? ver.engine_ar : null, ver ? ver.engine_zh : null, ver ? ver.seats : null, photo]);
    written += rowCount;
  }
  return written;
}

/** Called by POST /orders inside its transaction. Never throws and never leaves the transaction in an error state. */
async function recordOrderVehicles(client, { orderId, userId }) {
  try {
    await client.query('SAVEPOINT order_vehicles');
  } catch (err) {
    console.error(`[order-vehicles] could not start for order ${orderId}: ${err.message}`);
    return 0;
  }
  try {
    const written = await writeOrderVehicles(client, { orderId, userId });
    await client.query('RELEASE SAVEPOINT order_vehicles');
    return written;
  } catch (err) {
    console.error(`[order-vehicles] the cars of order ${orderId} could not be recorded (the order itself is unaffected): ${err.message}`);
    try { await client.query('ROLLBACK TO SAVEPOINT order_vehicles'); await client.query('RELEASE SAVEPOINT order_vehicles'); } catch (inner) { /* the order carries on regardless */ }
    return 0;
  }
}

module.exports = { recordOrderVehicles, writeOrderVehicles };
