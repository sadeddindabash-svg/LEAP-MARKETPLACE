// The buyer's product title in parts (patch-name-car-part, confirmed with the person via mockup):
//   name · brand model · version(s) (years) or All versions (years) · Part No.
// The website and the app draw it: on a product card in 2 rows (the second row slides to show the rest), on the product page in full.
// The car is the product's first fitment model, unless the list was asked for one car (generationId/year, "shopping for my car"): then that car, when the part fits it.
// A part with no fitment fits every car: allCars. Never throws: on any problem it returns null and the clients show the plain name, as before.
const { readVersionsByEntry } = require('../orderVehicles/fitmentVersions');

const MAX_VERSIONS_LISTED = 3;      // more than this: "N versions"

const pick = (en, ar, lang) => (lang === 'ar' && ar ? ar : en) || null;

async function fitTitleFor(q, productId, lang, opts = {}) {
  try {
    let { name, partNumber } = opts;
    if (name === undefined || partNumber === undefined) {
      const { rows } = await q.query('SELECT name, name_ar, oem_number FROM products WHERE id = $1', [productId]);
      if (!rows[0]) return null;
      if (name === undefined) name = pick(rows[0].name, rows[0].name_ar, lang);
      if (partNumber === undefined) partNumber = rows[0].oem_number;
    }
    partNumber = typeof partNumber === 'string' && partNumber.trim() ? partNumber.trim() : null;
    const { rows: entries } = await q.query(
      `SELECT pfe.id AS entry_id, pfe.generation_id, pfe.year, vm.id AS model_id, vb.name AS brand, vb.name_ar AS brand_ar, vm.name AS model, vm.name_ar AS model_ar
       FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       JOIN vehicle_brands vb ON vb.id = vm.brand_id
       WHERE pfe.product_id = $1
       ORDER BY pfe.id ASC`, [productId]);
    if (entries.length === 0) return { name, partNumber, allCars: true };

    // the models in the order they were added
    const models = [];
    const byModel = new Map();
    for (const e of entries) {
      if (!byModel.has(e.model_id)) { byModel.set(e.model_id, []); models.push(e.model_id); }
      byModel.get(e.model_id).push(e);
    }
    let chosen = models[0];
    let forYourCar = false;
    const prefer = opts.prefer || {};
    if (prefer.generationId) {
      const year = prefer.year === undefined || prefer.year === null || prefer.year === '' ? null : Number(prefer.year);
      const hit = entries.find((e) => e.generation_id === prefer.generationId && (year === null || Number(e.year) === year));
      if (hit) { chosen = hit.model_id; forYourCar = true; }
    }
    const group = byModel.get(chosen);
    const first = group[0];
    const years = group.map((e) => Number(e.year)).filter((y) => Number.isFinite(y) && y > 0);

    const versionsOf = await readVersionsByEntry(q, group.map((e) => e.entry_id));
    const allVersions = group.some((e) => !versionsOf.get(e.entry_id) || versionsOf.get(e.entry_id).length === 0);
    const names = [];
    if (!allVersions) {
      for (const e of group) for (const v of versionsOf.get(e.entry_id)) {
        const n = pick(v.name, v.nameAr, lang);
        if (n && !names.includes(n)) names.push(n);
      }
    }
    return {
      name,
      partNumber,
      allCars: false,
      brand: pick(first.brand, first.brand_ar, lang),
      model: pick(first.model, first.model_ar, lang),
      allVersions,
      versions: names.slice(0, MAX_VERSIONS_LISTED),
      versionCount: names.length,
      yearFrom: years.length ? Math.min(...years) : null,
      yearTo: years.length ? Math.max(...years) : null,
      moreCars: models.length - 1,
      forYourCar,
    };
  } catch (err) {
    console.error(`[fit-title] product ${productId}: ${err.message}`);
    return null;
  }
}

module.exports = { fitTitleFor, MAX_VERSIONS_LISTED };
