// What a supplier is shown for the lines of THEIR order: the car as it was recorded, and a photo looked up live (version, else year, else model, else brand), falling back to the photo address
// copied at order time. The caller passes only the line ids of the supplier's own sub-order, so a supplier can never read another supplier's lines through this.
async function loadLineVehicles(q, lineIds) {
  const out = new Map();
  if (!Array.isArray(lineIds) || lineIds.length === 0) return out;
  const { rows } = await q.query(
    `SELECT olv.*, COALESCE(ver.photo_url, g.photo_url, m.photo_url, b.photo_url, olv.photo_url) AS live_photo
     FROM order_line_vehicles olv
     LEFT JOIN vehicle_versions ver ON ver.id = olv.version_id
     LEFT JOIN vehicle_generations g ON g.id = olv.generation_id
     LEFT JOIN vehicle_models m ON m.id = g.model_id
     LEFT JOIN vehicle_brands b ON b.id = m.brand_id
     WHERE olv.line_item_id = ANY($1)`, [lineIds]);
  const names = (en, ar, zh) => (en ? { en, ar: ar || null, zh: zh || null } : null);
  for (const r of rows) {
    const hasCar = r.status === 'listed' || r.status === 'not_listed';
    out.set(r.line_item_id, {
      status: r.status,
      isDefaultCar: r.is_default_car,
      car: hasCar ? {
        year: r.year, seats: r.seats, photoUrl: r.live_photo || null,
        brand: names(r.brand, r.brand_ar, r.brand_zh), model: names(r.model, r.model_ar, r.model_zh),
        version: names(r.version, r.version_ar, r.version_zh), engine: names(r.engine, r.engine_ar, r.engine_zh),
      } : null,
    });
  }
  return out;
}

module.exports = { loadLineVehicles };
