// What the catalog has photos for, and what is still waiting: every section and every part (with a code) and whether its picture is real or the "photo coming soon" tile.
const { isPlaceholder } = require('../catalogImport/placeholders');
const { groupKey } = require('./codes');

async function loadCoverage(q) {
  const sections = (await q.query('SELECT id, code, name_en, name_ar, name_zh, sort_order, photo_url FROM product_categories WHERE code IS NOT NULL ORDER BY sort_order ASC, code ASC')).rows;
  const parts = (await q.query(
    `SELECT cp.id, cp.code, cp.category_id, cp.name_en, cp.name_ar, cp.name_zh, cp.subcategory_en, cp.sort_order, cp.photo_url, pc.code AS section_code, pc.sort_order AS section_order,
            (SELECT count(*)::int FROM products p WHERE p.category = cp.category_id AND lower(btrim(p.part)) = lower(btrim(cp.name_en)) AND p.status = 'active') AS products
     FROM category_parts cp JOIN product_categories pc ON pc.id = cp.category_id WHERE cp.code IS NOT NULL ORDER BY pc.sort_order ASC, cp.sort_order ASC, cp.code ASC`)).rows;
  const outParts = parts.map((p) => ({ id: p.id, code: p.code, sectionId: p.category_id, sectionCode: p.section_code, sectionOrder: p.section_order, nameEn: p.name_en, nameAr: p.name_ar, nameZh: p.name_zh, subcategoryEn: p.subcategory_en,
    group: groupKey(p.category_id, p.subcategory_en, p.name_en), hasPhoto: !isPlaceholder(p.photo_url), photoUrl: p.photo_url, products: p.products }));
  const bySection = new Map();
  for (const p of outParts) { const s = bySection.get(p.sectionId) || { parts: 0, withPhoto: 0 }; s.parts += 1; if (p.hasPhoto) s.withPhoto += 1; bySection.set(p.sectionId, s); }
  const outSections = sections.map((s) => ({ id: s.id, code: s.code, nameEn: s.name_en, nameAr: s.name_ar, nameZh: s.name_zh, sortOrder: s.sort_order, hasPhoto: !isPlaceholder(s.photo_url), photoUrl: s.photo_url, parts: (bySection.get(s.id) || {}).parts || 0, partsWithPhoto: (bySection.get(s.id) || {}).withPhoto || 0 }));
  return {
    sections: outSections, parts: outParts,
    totals: { sections: outSections.length, sectionsWithPhoto: outSections.filter((s) => s.hasPhoto).length, parts: outParts.length, partsWithPhoto: outParts.filter((p) => p.hasPhoto).length, pictures: outSections.length + new Set(outParts.map((p) => p.group)).size },
  };
}
module.exports = { loadCoverage };
