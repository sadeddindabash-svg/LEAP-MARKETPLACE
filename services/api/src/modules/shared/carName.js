// Buyer-facing product name: the name that was added, then the car's brand, then its model
// ("Front Brake Disc" + Toyota + Camry -> "Front Brake Disc Toyota Camry"; Arabic: name_ar + brand's name_ar + model's name_ar).
// Confirmed with the person via mockup. The car is the product's first fitment, the same one attachPrimaryFitment shows.
// A brand or model the added name already has in it is not added again. Admin and the supplier hub keep the plain name.

// LEFT JOIN for any query on `products p`: adds fit_brand, fit_brand_ar, fit_model, fit_model_ar (null when there is no fitment).
const CAR_JOIN = `LEFT JOIN LATERAL (
       SELECT vb.name AS fit_brand, vb.name_ar AS fit_brand_ar, vm.name AS fit_model, vm.name_ar AS fit_model_ar
       FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       JOIN vehicle_brands vb ON vb.id = vm.brand_id
       WHERE pfe.product_id = p.id
       ORDER BY pfe.id ASC LIMIT 1
     ) fit ON true`;

const CAR_COLUMNS = 'fit.fit_brand, fit.fit_brand_ar, fit.fit_model, fit.fit_model_ar';

function clean(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

// name + brand + model, skipping whatever is empty or already in the name (letter case ignored).
function withCar(name, brand, model) {
  let out = clean(name);
  for (const word of [clean(brand), clean(model)]) {
    if (!word) continue;
    if (out.toLowerCase().includes(word.toLowerCase())) continue;
    out = out ? `${out} ${word}` : word;
  }
  return out;
}

// A row with name, name_ar and the CAR_COLUMNS -> the full name in the buyer's language.
function buyerName(row, lang) {
  if (!row) return '';
  const ar = lang === 'ar';
  const name = ar && row.name_ar ? row.name_ar : row.name;
  const brand = ar && row.fit_brand_ar ? row.fit_brand_ar : row.fit_brand;
  const model = ar && row.fit_model_ar ? row.fit_model_ar : row.fit_model;
  return withCar(name, brand, model);
}

module.exports = { CAR_JOIN, CAR_COLUMNS, withCar, buyerName };
