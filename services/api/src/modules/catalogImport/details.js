// Editing a category or a part AFTER an import (or any time): the fields the older edit screens never covered (Chinese name, code, sub-category, placement, allowed positions, applies-to,
// special shipping, keywords, size basis), under the SAME naming rules the import applies. Only the fields that are sent change; the rest stay as they are.
//   * a part's English name is how products refer to it, so a rename carries the products of that part along in the same transaction (as the older part edit does);
//   * a name can never become the same as another category's or part's name (a supplier file could not tell them apart);
//   * a person who types a size has confirmed it: the size basis becomes "measured" unless the request says otherwise;
//   * the naming rules bind the rows that belong to the catalog (they have a code); older rows without a code are only checked for the basics.
const { namingProblems, parsePositions, MAX_SIDE_CM, MAX_WEIGHT_KG } = require('./rules');
const { isPlaceholder } = require('./placeholders');

const key = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (t) => String(t === undefined || t === null ? '' : t).replace(/\s+/g, ' ').trim();
const has = (body, name) => body[name] !== undefined;
class EditError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

const categoryDto = (r) => ({ id: r.id, code: r.code, nameEn: r.name_en, nameAr: r.name_ar, nameZh: r.name_zh, sortOrder: r.sort_order, photoUrl: r.photo_url, hasPlaceholderPhoto: isPlaceholder(r.photo_url) });
const partDto = (r) => ({
  id: r.id, categoryId: r.category_id, code: r.code, nameEn: r.name_en, nameAr: r.name_ar, nameZh: r.name_zh, subcategoryEn: r.subcategory_en, subcategoryAr: r.subcategory_ar, subcategoryZh: r.subcategory_zh,
  placementEn: r.placement_en, placementAr: r.placement_ar, placementZh: r.placement_zh, allowedPositions: r.allowed_positions ? r.allowed_positions.split(/;\s*/) : [], appliesTo: r.applies_to, specialShipping: r.special_shipping,
  keywordsEn: r.keywords_en, keywordsAr: r.keywords_ar, keywordsZh: r.keywords_zh, weightKg: r.weight_kg === null ? null : Number(r.weight_kg), lengthCm: r.length_cm === null ? null : Number(r.length_cm),
  widthCm: r.width_cm === null ? null : Number(r.width_cm), heightCm: r.height_cm === null ? null : Number(r.height_cm), sizeBasis: r.size_basis, photoUrl: r.photo_url, hasPlaceholderPhoto: isPlaceholder(r.photo_url),
});

async function updateCategory(client, id, body) {
  const { rows: [own] } = await client.query('SELECT * FROM product_categories WHERE id = $1', [id]);
  if (!own) throw new EditError('Category not found', 404);
  const next = {
    name_en: has(body, 'nameEn') ? clean(body.nameEn) : own.name_en, name_ar: has(body, 'nameAr') ? clean(body.nameAr) : own.name_ar,
    name_zh: has(body, 'nameZh') ? clean(body.nameZh) || null : own.name_zh, code: has(body, 'code') ? clean(body.code).toUpperCase() || null : own.code,
  };
  if (!next.name_en) throw new EditError('The English name is required');
  if (!next.name_ar) throw new EditError('The Arabic name is required');
  if (next.code && !/^[A-Za-z]{2,5}$/.test(next.code)) throw new EditError('The code must be 2 to 5 letters');
  if (next.code) {
    if (!next.name_zh) throw new EditError('The Chinese name is required for a category with a code');
    const problems = namingProblems({ mainEn: next.name_en });
    if (problems.length) throw new EditError(problems[0]);
  }
  const clash = await client.query('SELECT name_en FROM product_categories WHERE id != $1 AND (lower(btrim(name_en)) = $2 OR lower(id) = $2)', [id, key(next.name_en)]);
  if (clash.rows.length) throw new EditError(`Another category already has the name or id "${next.name_en}"`, 409);
  if (next.code) {
    const dup = await client.query('SELECT name_en FROM product_categories WHERE id != $1 AND lower(code) = lower($2)', [id, next.code]);
    if (dup.rows.length) throw new EditError(`The code ${next.code} is already used by "${dup.rows[0].name_en}"`, 409);
  }
  const { rows: [row] } = await client.query('UPDATE product_categories SET name_en = $1, name_ar = $2, name_zh = $3, code = $4 WHERE id = $5 RETURNING *', [next.name_en, next.name_ar, next.name_zh, next.code, id]);
  return { dto: categoryDto(row), changes: { nameEn: next.name_en, code: next.code } };
}

async function updatePart(client, id, body) {
  const { rows: [own] } = await client.query('SELECT * FROM category_parts WHERE id = $1', [id]);
  if (!own) throw new EditError('Part not found', 404);
  const txt = (field, column, max) => { if (!has(body, field)) return own[column]; const v = clean(body[field]); if (v.length > max) throw new EditError(`${field} is longer than ${max} characters`); return v || null; };
  const n = {
    name_en: has(body, 'nameEn') ? clean(body.nameEn) : own.name_en, name_ar: has(body, 'nameAr') ? clean(body.nameAr) : own.name_ar, name_zh: txt('nameZh', 'name_zh', 160),
    subcategory_en: txt('subcategoryEn', 'subcategory_en', 120), subcategory_ar: txt('subcategoryAr', 'subcategory_ar', 160), subcategory_zh: txt('subcategoryZh', 'subcategory_zh', 160),
    placement_en: txt('placementEn', 'placement_en', 80), placement_ar: txt('placementAr', 'placement_ar', 120), placement_zh: txt('placementZh', 'placement_zh', 120),
    applies_to: txt('appliesTo', 'applies_to', 80), special_shipping: txt('specialShipping', 'special_shipping', 300), keywords_en: txt('keywordsEn', 'keywords_en', 500), keywords_ar: txt('keywordsAr', 'keywords_ar', 500), keywords_zh: txt('keywordsZh', 'keywords_zh', 500),
    code: has(body, 'code') ? clean(body.code).toUpperCase() || null : own.code, allowed_positions: own.allowed_positions,
    weight_kg: own.weight_kg, length_cm: own.length_cm, width_cm: own.width_cm, height_cm: own.height_cm, size_basis: own.size_basis,
  };
  if (!n.name_en) throw new EditError('The English name is required');
  if (!n.name_ar) throw new EditError('The Arabic name is required');
  if (has(body, 'allowedPositions')) {
    const list = Array.isArray(body.allowedPositions) ? body.allowedPositions.join('; ') : body.allowedPositions;
    const parsed = parsePositions(list);
    if (parsed.error) throw new EditError(parsed.error);
    n.allowed_positions = parsed.positions.join('; ');
  }
  // size and weight: all four or none, each sensible; a person who types them confirms them
  const sizeFields = [['weightKg', 'weight_kg', MAX_WEIGHT_KG, 'kg'], ['lengthCm', 'length_cm', MAX_SIDE_CM, 'cm'], ['widthCm', 'width_cm', MAX_SIDE_CM, 'cm'], ['heightCm', 'height_cm', MAX_SIDE_CM, 'cm']];
  let sizeChanged = false;
  if (sizeFields.some(([f]) => has(body, f))) {
    if (!sizeFields.every(([f]) => has(body, f))) throw new EditError('Send the weight, length, width and height together');
    for (const [f, col, limit, unit] of sizeFields) {
      const v = Number(body[f]);
      if (!Number.isFinite(v) || v <= 0) throw new EditError(`${f} must be a number above zero`);
      if (v > limit) throw new EditError(`${f} ${v} ${unit} is above ${limit} ${unit}: probably a typing mistake`);
      if (Number(own[col]) !== v) sizeChanged = true;
      n[col] = v;
    }
    n.size_basis = has(body, 'sizeBasis') ? body.sizeBasis : 'measured';
  } else if (has(body, 'sizeBasis')) n.size_basis = body.sizeBasis;
  if (n.size_basis !== null && !['estimate', 'measured'].includes(n.size_basis)) throw new EditError('sizeBasis must be "estimate" or "measured"');

  // the rules that bind a catalog part (one with a code)
  if (n.code && !/^([A-Za-z]{2,5})-\d{3,4}$/.test(n.code)) throw new EditError('The code must look like BRK-001');
  if (n.code) {
    for (const p of namingProblems({ subEn: n.subcategory_en || undefined, partNameEn: n.name_en })) throw new EditError(p);
    if (!n.name_zh) throw new EditError('The Chinese name is required for a part with a code');
    if (!n.subcategory_en || !n.subcategory_ar || !n.subcategory_zh) throw new EditError('The sub-category is required in English, Arabic and Chinese for a part with a code');
    if (!n.name_en.toLowerCase().startsWith(n.subcategory_en.toLowerCase())) throw new EditError(`The part name "${n.name_en}" must start with its sub-category "${n.subcategory_en}"`);
    const pos = (n.allowed_positions || '').split(/;\s*/).filter(Boolean);
    if (pos.length === 0) throw new EditError('A part needs at least one allowed position');
  }
  // names and codes stay unique
  for (const [col, label] of [['name_en', 'English'], ['name_ar', 'Arabic'], ['name_zh', 'Chinese']]) {
    if (!n[col]) continue;
    const taken = await client.query(`SELECT 1 FROM category_parts WHERE category_id = $1 AND lower(btrim(${col})) = lower(btrim($2)) AND id != $3`, [own.category_id, n[col], id]);
    if (taken.rows.length) throw new EditError(`This category already has a part with the ${label} name "${n[col]}"`, 409);
  }
  if (n.code) {
    const dup = await client.query('SELECT name_en FROM category_parts WHERE id != $1 AND lower(code) = lower($2)', [id, n.code]);
    if (dup.rows.length) throw new EditError(`The code ${n.code} is already used by "${dup.rows[0].name_en}"`, 409);
  }

  const cols = Object.keys(n);
  const { rows: [row] } = await client.query(`UPDATE category_parts SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1} RETURNING *`, [...cols.map((c) => n[c]), id]);
  let renamed = 0;
  if (own.name_en.trim() !== n.name_en) {
    renamed = (await client.query('UPDATE products SET part = $1 WHERE category = $2 AND lower(btrim(part)) = lower(btrim($3))', [n.name_en, own.category_id, own.name_en])).rowCount;
  }
  let affected = 0;
  if (sizeChanged) {
    affected = (await client.query(`SELECT count(*)::int AS n FROM products WHERE category = $1 AND lower(btrim(part)) = lower(btrim($2)) AND NOT (weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL)`, [own.category_id, n.name_en])).rows[0].n;
  }
  return { dto: partDto(row), productsRenamed: renamed, productsAffectedBySize: affected, changes: { nameEn: n.name_en, code: n.code, sizeChanged } };
}

/** Marks parts as measured (a person has reviewed the estimate). ids: the parts to mark. Only estimates change. */
async function markReviewed(client, ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new EditError('Send the ids of the parts to mark as reviewed');
  const { rowCount } = await client.query("UPDATE category_parts SET size_basis = 'measured' WHERE id = ANY($1) AND size_basis = 'estimate'", [ids]);
  return { marked: rowCount };
}

/** The numbers an admin needs to see: how complete the catalog is and what still rests on estimates. */
async function health(q) {
  const one = async (sql) => (await q.query(sql)).rows[0];
  const c = await one("SELECT count(*)::int AS total, count(code)::int AS coded, count(*) FILTER (WHERE photo_url IS NULL OR photo_url LIKE '%placeholder-%')::int AS no_photo FROM product_categories");
  const p = await one("SELECT count(*)::int AS total, count(code)::int AS coded, count(*) FILTER (WHERE photo_url IS NULL OR photo_url LIKE '%placeholder-%')::int AS no_photo, count(*) FILTER (WHERE size_basis = 'estimate')::int AS estimates FROM category_parts");
  const pr = await one(`SELECT count(*)::int AS n FROM products pr JOIN category_parts cp ON cp.category_id = pr.category AND lower(btrim(cp.name_en)) = lower(btrim(pr.part))
                        WHERE cp.size_basis = 'estimate' AND NOT (pr.weight_kg IS NOT NULL AND pr.length_cm IS NOT NULL AND pr.width_cm IS NOT NULL AND pr.height_cm IS NOT NULL)`);
  return { categories: { total: c.total, inCatalog: c.coded, withoutRealPhoto: c.no_photo }, parts: { total: p.total, inCatalog: p.coded, withoutRealPhoto: p.no_photo, onEstimatedSize: p.estimates }, productsPricedOnEstimates: pr.n };
}

module.exports = { updateCategory, updatePart, markReviewed, health, EditError, categoryDto, partDto };
