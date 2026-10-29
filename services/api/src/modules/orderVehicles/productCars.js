// The cars a PRODUCT is listed for (its fitment list, product_fitment_entries), read live. Two readers share one query:
//   loadProductCars  for the SUPPLIER portal: for each product, its main photo (the first photo uploaded) and the car(s) it belongs to, with their photos and the engine and transmission when the
//                    fitment names them. It never contains the buyer's car: that is deliberately not sent to a supplier.
//   loadBuyerFit     for the BUYER'S product page and cart: the first few cars the product fits, how many in all, and a compact key (generation|year) of EVERY car it fits, so the storefront can
//                    tell whether the buyer's own car is one of them.
// The first car is the one the supplier added first (the same "primary" car the product page already shows).
const { readVersionsByEntry, buyerVersionRules } = require('./fitmentVersions');
const MAX_SUPPLIER_CARS = 4;
const MAX_BUYER_CARS = 3;
const MAX_KEYS = 500;
const MAX_FIT_GROUPS = 60;

/**
 * Every MODEL a part fits, with the years: [{ brand, brandAr, model, modelAr, ranges: [[2022, 2024], [2026, 2026]], vehicleCount }] in the order the supplier added them (the first is the "primary" one the page has always shown).
 * Years that follow each other become one range, so a part that fits 100 vehicles stays a short list. Two generations of the same model are one group (their years are merged).
 */
function groupFit(entries) {
  const groups = new Map();
  for (const r of entries) {
    const key = `${r.brand}\u0000${r.model}`;
    let g = groups.get(key);
    if (!g) { g = { brand: r.brand, brandAr: r.brand_ar || null, model: r.model, modelAr: r.model_ar || null, brandLogoUrl: r.brand_photo || null, years: new Set() }; groups.set(key, g); }
    const year = r.year === null || r.year === undefined || r.year === '' ? NaN : Number(r.year);      // a missing year is not year 0
    if (Number.isFinite(year)) g.years.add(year);
  }
  return [...groups.values()].map((g) => {
    const years = [...g.years].sort((a, b) => a - b); const ranges = [];
    for (const y of years) { const last = ranges[ranges.length - 1]; if (last && y === last[1] + 1) last[1] = y; else ranges.push([y, y]); }
    return { brand: g.brand, brandAr: g.brandAr, model: g.model, modelAr: g.modelAr, brandLogoUrl: g.brandLogoUrl, ranges, vehicleCount: years.length };
  });
}

const names = (en, ar, zh) => (en ? { en, ar: ar || null, zh: zh || null } : null);

async function readFitment(q, productIds) {
  const { rows } = await q.query(
    `SELECT pfe.id AS entry_id, pfe.product_id, pfe.generation_id, pfe.year, b.name AS brand, b.name_ar AS brand_ar, b.name_zh AS brand_zh, m.name AS model, m.name_ar AS model_ar, m.name_zh AS model_zh,
            g.name AS generation_name, g.year_start AS generation_start, g.year_end AS generation_end, (SELECT COUNT(*)::int FROM vehicle_versions vv WHERE vv.generation_id = pfe.generation_id) AS version_count,
            g.photo_url AS generation_photo, m.photo_url AS model_photo, b.photo_url AS brand_photo, e.name AS engine, t.name AS transmission
     FROM product_fitment_entries pfe
     JOIN vehicle_generations g ON g.id = pfe.generation_id
     JOIN vehicle_models m ON m.id = g.model_id
     JOIN vehicle_brands b ON b.id = m.brand_id
     LEFT JOIN vehicle_engines e ON e.id = pfe.engine_id
     LEFT JOIN vehicle_transmissions t ON t.id = pfe.transmission_id
     WHERE pfe.product_id = ANY($1)
     ORDER BY pfe.product_id, pfe.id`, [productIds]);
  const versionsOf = await readVersionsByEntry(q, rows.map((r) => r.entry_id));      // the versions each car is narrowed to (none = every version)
  for (const r of rows) r.versions = versionsOf.get(r.entry_id) || null;
  const byProduct = new Map();
  for (const r of rows) { if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []); byProduct.get(r.product_id).push(r); }
  return byProduct;
}

async function loadProductCars(q, productIds) {
  const out = new Map();
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (ids.length === 0) return out;
  const fitment = await readFitment(q, ids);
  const { rows: photos } = await q.query('SELECT DISTINCT ON (product_id) product_id, url FROM product_images WHERE product_id = ANY($1) ORDER BY product_id, sort_order, id', [ids]);
  const photoOf = new Map(photos.map((p) => [p.product_id, p.url]));
  for (const id of ids) {
    const entries = fitment.get(id) || [];
    out.set(id, {
      partPhotoUrl: photoOf.get(id) || null,
      fitsAnyCar: entries.length === 0,
      carCount: entries.length,
      cars: entries.slice(0, MAX_SUPPLIER_CARS).map((r) => ({
        year: r.year, brand: names(r.brand, r.brand_ar, r.brand_zh), model: names(r.model, r.model_ar, r.model_zh),
        engine: r.engine || null, transmission: r.transmission || null,
        generation: { name: r.generation_name, yearStart: r.generation_start, yearEnd: r.generation_end, versionCount: r.version_count },
        // null = every version
        versions: r.versions ? r.versions.map((v) => ({ id: v.id, name: names(v.name, v.nameAr, v.nameZh), engine: v.engine, seats: v.seats })) : null,
        photoUrl: r.generation_photo || r.model_photo || r.brand_photo || null,
      })),
    });
  }
  return out;
}

/** Never throws: a problem here must not take a product page down (the page then simply shows no fit message). */
async function loadBuyerFit(q, productId) {
  try {
    const entries = (await readFitment(q, [productId])).get(productId) || [];
    const groups = groupFit(entries);
    return {
      fitCarCount: entries.length,
      fitCars: entries.slice(0, MAX_BUYER_CARS).map((r) => ({ generationId: r.generation_id, year: r.year, brand: r.brand, brandAr: r.brand_ar || null, model: r.model, modelAr: r.model_ar || null })),
      fitKeys: entries.slice(0, MAX_KEYS).map((r) => `${r.generation_id}|${r.year}`),
      // The cars of this part that are NARROWED to some versions ({ "generation|year": [version ids] }) and the names of those versions. A car that is not in it fits EVERY version.
      ...buyerVersionRules(entries.slice(0, MAX_KEYS)),
      // Every model it fits with its year ranges, how many models in all, and how many different vehicles (a generation and a year): see groupFit. Left OUT when the fitment could not be read, so an error never looks like "fits every vehicle".
      fitGroups: groups.slice(0, MAX_FIT_GROUPS),
      fitGroupCount: groups.length,
      fitVehicleCount: new Set(entries.map((r) => `${r.generation_id}|${r.year}`)).size,
    };
  } catch (err) {
    console.error(`[product-fit] could not read the fitment of product ${productId}: ${err.message}`);
    return { fitCarCount: 0, fitCars: [], fitKeys: [] };
  }
}

module.exports = { loadProductCars, loadBuyerFit, groupFit, MAX_SUPPLIER_CARS, MAX_BUYER_CARS, MAX_FIT_GROUPS };
