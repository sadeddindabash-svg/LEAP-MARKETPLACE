const ALLOWED_POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];

/**
 * Real, shared validation for supplier product submission (migration
 * 023's bulk import feature). Deliberately a SEPARATE module from the
 * existing single-item POST /me/products endpoint's own inline
 * validation, even though the real checks are equivalent — the
 * existing endpoint has extensive real test coverage already, and
 * duplicating this logic here avoids any regression risk on that
 * well-tested code, at the honest cost of some real duplication.
 */

async function validateFitment({ generationId, year, engineId, transmissionId }, client) {
  if (!generationId || !year) {
    return { valid: false, error: 'fitment.generationId and fitment.year are required' };
  }
  const genCheck = await client.query('SELECT * FROM vehicle_generations WHERE id = $1', [generationId]);
  if (genCheck.rows.length === 0) {
    return { valid: false, error: 'Unknown fitment.generationId' };
  }
  const generation = genCheck.rows[0];
  const maxYear = generation.year_end || new Date().getFullYear() + 1;
  if (year < generation.year_start || year > maxYear) {
    return { valid: false, error: `fitment.year ${year} is outside this generation's range (${generation.year_start}–${generation.year_end || 'present'})` };
  }
  if (engineId) {
    const engCheck = await client.query('SELECT id FROM vehicle_engines WHERE id = $1 AND generation_id = $2', [engineId, generationId]);
    if (engCheck.rows.length === 0) {
      return { valid: false, error: 'fitment.engineId does not belong to the given generation' };
    }
  }
  if (transmissionId) {
    const transCheck = await client.query('SELECT id FROM vehicle_transmissions WHERE id = $1 AND generation_id = $2', [transmissionId, generationId]);
    if (transCheck.rows.length === 0) {
      return { valid: false, error: 'fitment.transmissionId does not belong to the given generation' };
    }
  }
  return { valid: true, generation };
}

// Real, best-effort validation for the bulk-import path (migration 023):
// unlike the single-item endpoint, an invalid/unrecognized category or
// part is NOT a hard rejection here -- per the confirmed design, it's
// simply treated as "not provided," left for the supplier to fill in
// during the real per-item completion step. Returns the real matched
// ids/names if valid, or null if not -- never throws.
async function tryMatchCategoryAndPart(category, part, client) {
  if (!category) return { category: null, part: null };
  const categoryCheck = await client.query('SELECT id FROM product_categories WHERE id = $1 OR name_en = $1', [category]);
  if (categoryCheck.rows.length === 0) return { category: null, part: null };
  const realCategoryId = categoryCheck.rows[0].id;
  if (!part) return { category: realCategoryId, part: null };
  const partCheck = await client.query('SELECT name_en FROM category_parts WHERE category_id = $1 AND name_en = $2', [realCategoryId, part]);
  if (partCheck.rows.length === 0) return { category: realCategoryId, part: null };
  return { category: realCategoryId, part: partCheck.rows[0].name_en };
}

function tryMatchPosition(position) {
  if (!position) return null;
  return ALLOWED_POSITIONS.find((p) => p.toLowerCase() === String(position).toLowerCase()) || null;
}

// Real dimensions -- unlike category/part/position, these are numeric,
// so "provided but invalid" (e.g. a negative number) is distinct from
// "not provided at all." Returns { weightKg, lengthCm, widthCm,
// heightCm }, each null if not validly provided.
function tryMatchDimensions({ weightKg, lengthCm, widthCm, heightCm }) {
  const clean = (v) => (v !== undefined && v !== null && Number(v) > 0 ? Number(v) : null);
  return { weightKg: clean(weightKg), lengthCm: clean(lengthCm), widthCm: clean(widthCm), heightCm: clean(heightCm) };
}

// The real, mandatory checks for FINISHING a draft (migration 023's
// PATCH /me/products/:id/complete) -- unlike the lenient bulk-import
// matching above, every one of these is now required, matching the
// exact same real bar the original single-item endpoint always held
// products to before they could enter real moderation.
function validateCompleteFields({ category, part, position, weightKg, lengthCm, widthCm, heightCm, images }) {
  const missing = [];
  if (!category) missing.push('category');
  if (!part) missing.push('part');
  if (!position) missing.push('position');
  if (weightKg === undefined || weightKg === null) missing.push('weightKg');
  if (lengthCm === undefined || lengthCm === null) missing.push('lengthCm');
  if (widthCm === undefined || widthCm === null) missing.push('widthCm');
  if (heightCm === undefined || heightCm === null) missing.push('heightCm');
  if (missing.length > 0) {
    return { valid: false, error: `Missing required field(s): ${missing.join(', ')}` };
  }
  if (!ALLOWED_POSITIONS.includes(position)) {
    return { valid: false, error: `position must be one of: ${ALLOWED_POSITIONS.join(', ')}` };
  }
  for (const [field, value] of [['weightKg', weightKg], ['lengthCm', lengthCm], ['widthCm', widthCm], ['heightCm', heightCm]]) {
    if (value <= 0) return { valid: false, error: `${field} must be a positive number` };
  }
  const MIN_PRODUCT_PHOTOS = 3;
  if (!Array.isArray(images) || images.length < MIN_PRODUCT_PHOTOS) {
    return { valid: false, error: `At least ${MIN_PRODUCT_PHOTOS} product photos are required (got ${Array.isArray(images) ? images.length : 0})` };
  }
  return { valid: true };
}

module.exports = { ALLOWED_POSITIONS, validateFitment, tryMatchCategoryAndPart, tryMatchPosition, tryMatchDimensions, validateCompleteFields };
