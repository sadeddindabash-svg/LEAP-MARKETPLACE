// A REPLACEMENT order (made when an admin confirms a replacement for a faulty part, see faultCases/helpers.js) is for the SAME car as the part it replaces, so the supplier who is asked to
// send it must see that car too. This copies, line by line (matched by product), the car recorded on the original sub-order's lines onto the replacement sub-order's lines. It runs inside
// the replacement's own transaction in a SAVEPOINT, so it can never stop a replacement: if anything goes wrong it is undone and logged, and the replacement simply shows no car.
async function copyLineVehicles(client, { fromSubOrderId, toSubOrderId }) {
  try {
    await client.query('SAVEPOINT copy_order_vehicles');
  } catch (err) {
    console.error(`[order-vehicles] could not start copying the cars to sub-order ${toSubOrderId}: ${err.message}`);
    return 0;
  }
  try {
    const { rowCount } = await client.query(
      `INSERT INTO order_line_vehicles (line_item_id, status, is_default_car, generation_id, year, version_id, brand, brand_ar, brand_zh, model, model_ar, model_zh,
         version, version_ar, version_zh, engine, engine_ar, engine_zh, seats, photo_url)
       SELECT DISTINCT ON (nl.id) nl.id, olv.status, olv.is_default_car, olv.generation_id, olv.year, olv.version_id, olv.brand, olv.brand_ar, olv.brand_zh, olv.model, olv.model_ar, olv.model_zh,
         olv.version, olv.version_ar, olv.version_zh, olv.engine, olv.engine_ar, olv.engine_zh, olv.seats, olv.photo_url
       FROM order_line_items nl
       JOIN order_line_items ol ON ol.product_id = nl.product_id AND ol.sub_order_id = $1
       JOIN order_line_vehicles olv ON olv.line_item_id = ol.id
       WHERE nl.sub_order_id = $2
       ORDER BY nl.id, ol.id
       ON CONFLICT (line_item_id) DO NOTHING`, [fromSubOrderId, toSubOrderId]);
    await client.query('RELEASE SAVEPOINT copy_order_vehicles');
    return rowCount;
  } catch (err) {
    console.error(`[order-vehicles] the cars could not be copied to sub-order ${toSubOrderId} (the replacement itself is unaffected): ${err.message}`);
    try { await client.query('ROLLBACK TO SAVEPOINT copy_order_vehicles'); await client.query('RELEASE SAVEPOINT copy_order_vehicles'); } catch (inner) { /* the replacement carries on regardless */ }
    return 0;
  }
}

module.exports = { copyLineVehicles };
