// What to do with every row, decided against the database. ONE function serves both the preview (apply = false: reads only, nothing is written) and the real import
// (apply = true, inside one transaction), so the preview can never promise something the import then does differently.
//
//   category  matched by its CODE, else by its English name (ignoring capitals and extra spaces). Created when missing. A NEW category is refused when its name equals an
//             existing category's name or id, because the supplier import finds a category by "id or name" and would then not know which one is meant.
//   part      matched by its CODE, else by its English name inside the category. Created when missing, with a placeholder photo; when it exists it is SKIPPED, or (mode "update")
//             brought up to date. Its English name is never changed (products refer to a part by its name). A MEASURED size is never overwritten by an estimate.
//   nothing existing is ever deleted or renamed.
const crypto = require('crypto');
const { isPlaceholder } = require('./placeholders');

const key = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
const newBatchId = () => `cimp_${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
const SIZE_COLUMNS = ['weight_kg', 'length_cm', 'width_cm', 'height_cm'];

const singular = (w) => (/ies$/.test(w) ? w.replace(/ies$/, 'y') : /(ss|us|is)$/.test(w) ? w : /(ches|shes|xes|ses)$/.test(w) ? w.replace(/es$/, '') : w.replace(/s$/, ''));

/** The words that matter in a category name, singular, without filler: "Brake System" and "Brakes" both give { brake }. */
function stems(name) {
  const filler = new Set(['system', 'systems', 'parts', 'part', 'and', 'the', 'of', 'control', 'equipment']);
  return new Set(key(name).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !filler.has(w)).map(singular).filter(Boolean));
}
/** Two names that look like the same thing: equal sets of words, or one is a single word the other contains. */
function similar(a, b) {
  const x = stems(a), y = stems(b);
  if (x.size === 0 || y.size === 0) return false;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size === big.size) return [...small].every((w) => big.has(w));
  return small.size === 1 && big.has([...small][0]);
}
const sameNumber = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);

async function runImport(q, items, mode, { apply = false, batchId = null, placeholders = { category: null, part: null } } = {}) {
  const counts = { newCategories: 0, existingCategories: 0, updatedCategories: 0, newParts: 0, existingParts: 0, updatedParts: 0, placeholdersUsed: 0, productsAffected: 0, estimatedParts: 0, keptMeasuredSizes: 0 };
  const notes = [], nearDuplicates = [], rows = [], noted = new Set();
  const note = (k, text) => { if (!noted.has(k)) { noted.add(k); notes.push(text); } };

  const { rows: cats } = await q.query('SELECT id, name_en, name_ar, name_zh, code, sort_order FROM product_categories');
  const byCode = new Map(cats.filter((c) => c.code).map((c) => [key(c.code), c]));
  const byName = new Map(cats.map((c) => [key(c.name_en), c]));
  const byId = new Map(cats.map((c) => [key(c.id), c]));
  const idsTaken = new Set(cats.map((c) => key(c.id)));
  let nextCategoryOrder = cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
  const state = new Map();                                                            // main code -> { id, isNew, row, error }

  const okItems = items.filter((i) => i.ok);
  // ---- categories, in the order they first appear
  for (const item of okItems) {
    const m = item.data.main, ck = key(m.code);
    if (state.has(ck)) continue;
    const byC = byCode.get(ck), byN = byName.get(key(m.en)), byI = byId.get(key(m.en));
    if (byC && byN && byC.id !== byN.id) { state.set(ck, { error: `Category code ${m.code} belongs to "${byC.name_en}", but the name "${m.en}" belongs to another category ("${byN.name_en}")` }); continue; }
    // a name that is the ID of one category and the NAME of another is ambiguous (the supplier import looks a category up by id or name): refused. A name that is only the id of an existing category
    // IS that category, as far as the supplier import is concerned, so it is used (and keeps its own name), never refused and never duplicated.
    if (byN && byI && byN.id !== byI.id) { state.set(ck, { error: `The name "${m.en}" is the id of the category "${byI.name_en}" and the name of another category: a supplier file could not tell them apart. Rename one of them first.` }); continue; }
    const existing = byC || byN || byI || null;
    if (existing) {
      if (!byC && !byN) note(`id:${existing.id}`, `Category "${m.en}" matched the existing category "${existing.name_en}" by its id "${existing.id}" (the supplier import would pick it too). It keeps its name; the new parts are added to it.`);
      if (existing.code && key(existing.code) !== ck) { state.set(ck, { error: `A category called "${existing.name_en}" already exists with the code ${existing.code}, not ${m.code}` }); continue; }
      const blank = (v) => v === null || v === undefined || String(v).trim() === '';
      const fill = {};
      if (blank(existing.code)) fill.code = m.code;
      if (blank(existing.name_zh)) fill.name_zh = m.zh;
      if (blank(existing.name_ar)) fill.name_ar = m.ar;
      const differs = key(existing.name_ar) !== key(m.ar) || key(existing.name_zh) !== key(m.zh);
      const set = mode === 'update' && differs ? { name_ar: m.ar, name_zh: m.zh, ...(blank(existing.code) ? { code: m.code } : {}) } : fill;
      if (Object.keys(set).length) {
        if (apply) { const cols = Object.keys(set); await q.query(`UPDATE product_categories SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`, [...cols.map((c) => set[c]), existing.id]); }
        counts.updatedCategories++;
        note(`cu:${existing.id}`, mode === 'update' && differs ? `Category "${existing.name_en}": its Arabic and Chinese names and its code will be updated from the file.` : `Category "${existing.name_en}" already exists: only its empty fields (${Object.keys(set).join(', ')}) will be filled from the file. Nothing that has a value is changed.`);
      } else {
        counts.existingCategories++;
        if (differs) note(`cs:${existing.id}`, `Category "${existing.name_en}" already exists and its saved Arabic or Chinese name is not the file's: it was left as it is (choose "Update existing" to change it).`);
      }
      state.set(ck, { id: existing.id, isNew: false, row: existing, name: existing.name_en });
      continue;
    }
    if (idsTaken.has(key(m.en))) { state.set(ck, { error: `(safety net: it cannot happen while ids are matched above) The new category name "${m.en}" is the same as the id of an existing category: a supplier file naming it could not tell them apart. Rename one of them first.` }); continue; }
    let id = `cat_${m.code.toLowerCase()}`; for (let n = 2; idsTaken.has(key(id)); n++) id = `cat_${m.code.toLowerCase()}_${n}`;
    idsTaken.add(key(id));
    nextCategoryOrder += 10;
    if (apply) await q.query('INSERT INTO product_categories (id, name_en, name_ar, name_zh, code, sort_order, photo_url, import_batch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, m.en, m.ar, m.zh, m.code, nextCategoryOrder, placeholders.category, batchId]);
    counts.newCategories++; counts.placeholdersUsed++;
    state.set(ck, { id, isNew: true, name: m.en });
    for (const c of cats) if (similar(m.en, c.name_en) && !byC) nearDuplicates.push({ newName: m.en, existingName: c.name_en, existingId: c.id });
  }

  // ---- parts
  const matchedIds = [...state.values()].filter((s) => s.id && !s.isNew).map((s) => s.id);
  const { rows: parts } = await q.query('SELECT * FROM category_parts WHERE category_id = ANY($1) OR code IS NOT NULL', [matchedIds]);
  const partByCode = new Map(parts.filter((p) => p.code).map((p) => [key(p.code), p]));
  const partByName = new Map(parts.map((p) => [`${p.category_id}|${key(p.name_en)}`, p]));
  const partIds = new Set((await q.query('SELECT id FROM category_parts')).rows.map((r) => key(r.id)));
  const partOrder = new Map();
  const keepPartIds = new Set();                                                       // every part the sheet matches or creates: "in the sheet" (used when the catalog is replaced)
  const nextPartOrder = async (categoryId, isNew) => {
    if (!partOrder.has(categoryId)) partOrder.set(categoryId, isNew ? 0 : (await q.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM category_parts WHERE category_id = $1', [categoryId])).rows[0].m);
    partOrder.set(categoryId, partOrder.get(categoryId) + 10);
    return partOrder.get(categoryId);
  };

  for (const item of items) {
    const { main, part } = item.data;
    const summary = { rowNumber: item.rowNumber, category: main.en, code: part.code, part: part.nameEn, positions: part.positions.join(', '), size: part.size, sizeBasis: part.sizeBasis };
    const messages = [...item.messages];
    if (!item.ok) { rows.push({ ...summary, status: 'error', messages }); continue; }
    const cat = state.get(key(main.code));
    if (cat.error) { messages.push({ level: 'error', text: cat.error }); rows.push({ ...summary, status: 'error', messages }); continue; }

    const byC = partByCode.get(key(part.code));
    const existing = byC || (cat.isNew ? null : partByName.get(`${cat.id}|${key(part.nameEn)}`)) || null;
    if (existing && existing.category_id !== cat.id) { messages.push({ level: 'error', text: `The part code ${part.code} already belongs to a part in another category` }); rows.push({ ...summary, status: 'error', messages }); continue; }

    const values = {
      weight_kg: part.size.weightKg, length_cm: part.size.lengthCm, width_cm: part.size.widthCm, height_cm: part.size.heightCm,
      name_zh: part.nameZh, subcategory_en: part.sub.en, subcategory_ar: part.sub.ar, subcategory_zh: part.sub.zh, placement_en: part.placement.en || null, placement_ar: part.placement.ar || null, placement_zh: part.placement.zh || null,
      allowed_positions: part.positions.join('; '), applies_to: part.appliesTo || null, special_shipping: part.special || null, keywords_en: part.keywords.en || null, keywords_ar: part.keywords.ar || null, keywords_zh: part.keywords.zh || null,
    };
    if (existing) {
      keepPartIds.add(existing.id);
      const blank = (v) => v === null || v === undefined || String(v).trim() === '';
      const fill = {}, diff = {};
      for (const [col, val] of Object.entries(values)) {
        if (SIZE_COLUMNS.includes(col)) continue;
        if (blank(existing[col]) && !blank(val)) fill[col] = val;
        if (String(existing[col] ?? '') !== String(val ?? '')) diff[col] = val;
      }
      if (blank(existing.code)) { fill.code = part.code; diff.code = part.code; }
      const noSize = SIZE_COLUMNS.every((c) => blank(existing[c]));
      const incomplete = SIZE_COLUMNS.some((c) => blank(existing[c]));
      const sizeDiffers = !SIZE_COLUMNS.every((c) => sameNumber(existing[c], values[c]));
      if (noSize) { for (const c of SIZE_COLUMNS) { fill[c] = values[c]; diff[c] = values[c]; } fill.size_basis = part.sizeBasis; diff.size_basis = part.sizeBasis; }
      else if (sizeDiffers && (existing.size_basis === 'estimate' || incomplete)) { for (const c of SIZE_COLUMNS) diff[c] = values[c]; diff.size_basis = part.sizeBasis; }
      else if (sizeDiffers && mode === 'update') { counts.keptMeasuredSizes++; messages.push({ level: 'info', text: 'Its size and weight were set by a person, so they were kept' }); }
      const set = mode === 'update' ? diff : fill;
      if (Object.keys(set).length > 0) {
        if (set.weight_kg !== undefined) {
          const { rows: [n] } = await q.query(`SELECT count(*)::int AS n FROM products WHERE category = $1 AND lower(btrim(part)) = lower(btrim($2)) AND NOT (weight_kg IS NOT NULL AND length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL)`, [cat.id, existing.name_en]);
          if (n.n > 0) { counts.productsAffected += n.n; messages.push({ level: 'warning', text: `Its size or weight changes: the shipping of ${n.n} product(s) that rely on the part's size will change` }); }
        }
        if (apply) {
          const cols = Object.keys(set);
          await q.query(`UPDATE category_parts SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`, [...cols.map((c) => set[c]), existing.id]);
        }
        counts.updatedParts++;
        messages.push({ level: 'info', text: mode === 'update' ? 'Already exists: will be updated' : `Already exists: only its empty fields (${Object.keys(set).filter((c) => !SIZE_COLUMNS.includes(c)).join(', ') || 'size'}) will be filled. Nothing that has a value is changed` });
        rows.push({ ...summary, status: 'update', messages });
      } else {
        counts.existingParts++;
        messages.push({ level: 'info', text: mode === 'update' ? 'Already exists and nothing changed' : 'Already exists: skipped' });
        rows.push({ ...summary, status: 'exists', messages: messages.filter((m) => m.level !== 'warning') });
      }
      continue;
    }
    let id = `part_${part.code.toLowerCase().replace(/-/g, '_')}`; for (let n = 2; partIds.has(key(id)); n++) id = `part_${part.code.toLowerCase().replace(/-/g, '_')}_${n}`;
    partIds.add(key(id));
    keepPartIds.add(id);
    const order = await nextPartOrder(cat.id, cat.isNew);
    if (apply) {
      await q.query(
        `INSERT INTO category_parts (id, category_id, name_en, name_ar, name_zh, code, sort_order, photo_url, weight_kg, length_cm, width_cm, height_cm, subcategory_en, subcategory_ar, subcategory_zh,
           placement_en, placement_ar, placement_zh, allowed_positions, applies_to, special_shipping, keywords_en, keywords_ar, keywords_zh, size_basis, import_batch_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [id, cat.id, part.nameEn, part.nameAr, part.nameZh, part.code, order, placeholders.part, values.weight_kg, values.length_cm, values.width_cm, values.height_cm, values.subcategory_en, values.subcategory_ar, values.subcategory_zh,
          values.placement_en, values.placement_ar, values.placement_zh, values.allowed_positions, values.applies_to, values.special_shipping, values.keywords_en, values.keywords_ar, values.keywords_zh, part.sizeBasis, batchId]);
    }
    counts.newParts++; counts.placeholdersUsed++; if (part.sizeBasis === 'estimate') counts.estimatedParts++;
    rows.push({ ...summary, status: 'new', messages });
  }
  return { rows, counts, notes, nearDuplicates, savedCategories: [...state.values()].filter((s) => s.isNew).length,
    keep: { categoryIds: new Set([...state.values()].filter((s) => s.id).map((s) => s.id)), partIds: keepPartIds } };
}

module.exports = { runImport, newBatchId, similar, stems, key, isPlaceholder };
