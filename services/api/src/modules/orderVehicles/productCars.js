// The cars a PRODUCT is listed for (its fitment list, product_fitment_entries), read live. Two readers share one query:
//   loadProductCars  for the SUPPLIER portal: for each product, its main photo (the first photo uploaded) and the car(s) it belongs to, with their photos and the engine and transmission when the
//                    fitment names them. It never contains the buyer's car: that is deliberately not sent to a supplier.
//   loadBuyerFit     for the BUYER'S product page and cart: the first few cars the product fits, how many in all, and a compact key (generation|year) of EVERY car it fits, so the storefront can
//                    tell whether the buyer's own car is one of them.
// The first car is the one the supplier added first (the same "primary" car the product page already shows).
const MAX_SUPPLIER_CARS = 4;
const MAX_BUYER_CARS = 3;
const MAX_KEYS = 500;

const names = (en, ar, zh) => (en ? { en, ar: ar || null, zh: zh || null } : null);

async function readFitment(q, productIds) {
  const { rows } = await q.query(
    `SELECT pfe.product_id, pfe.generation_id, pfe.year, b.name AS brand, b.name_ar AS brand_ar, b.name_zh AS brand_zh, m.name AS model, m.name_ar AS model_ar, m.name_zh AS model_zh,
            g.photo_url AS generation_photo, m.photo_url AS model_photo, b.photo_url AS brand_photo, e.name AS engine, t.name AS transmission
     FROM product_fitment_entries pfe
     JOIN vehicle_generations g ON g.id = pfe.generation_id
     JOIN vehicle_models m ON m.id = g.model_id
     JOIN vehicle_brands b ON b.id = m.brand_id
     LEFT JOIN vehicle_engines e ON e.id = pfe.engine_id
     LEFT JOIN vehicle_transmissions t ON t.id = pfe.transmission_id
     WHERE pfe.product_id = ANY($1)
     ORDER BY pfe.product_id, pfe.id`, [productIds]);
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
        engine: r.engine || null, transmission: r.transmission || null, photoUrl: r.generation_photo || r.model_photo || r.brand_photo || null,
      })),
    });
  }
  return out;
}

/** Never throws: a problem here must not take a product page down (the page then simply shows no fit message). */
async function loadBuyerFit(q, productId) {
  try {
    const entries = (await readFitment(q, [productId])).get(productId) || [];
    return {
      fitCarCount: entries.length,
      fitCars: entries.slice(0, MAX_BUYER_CARS).map((r) => ({ generationId: r.generation_id, year: r.year, brand: r.brand, brandAr: r.brand_ar || null, model: r.model, modelAr: r.model_ar || null })),
      fitKeys: entries.slice(0, MAX_KEYS).map((r) => `${r.generation_id}|${r.year}`),
    };
  } catch (err) {
    console.error(`[product-fit] could not read the fitment of product ${productId}: ${err.message}`);
    return { fitCarCount: 0, fitCars: [], fitKeys: [] };
  }
}

module.exports = { loadProductCars, loadBuyerFit, MAX_SUPPLIER_CARS, MAX_BUYER_CARS };
