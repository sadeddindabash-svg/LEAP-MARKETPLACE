// Bulk upload: each row's Category and Part class, found from its ITEM NAME, and the catalog for the portal's dropdowns.
// A part matches when its English or Chinese name appears in the item name (spaces and punctuation ignored, any letter case):
// "前刹车盘 300mm" contains "前刹车盘" -> Brakes / Front Brake Disc. The longest matching name wins ("前刹车盘" over "刹车盘");
// two parts tied on the longest match = "many" (the supplier chooses), no part = "none". Nothing is guessed beyond that.
const { getPartShipping } = require('../shared/partShipping');

const POSITION_WORDS = [['front left', 'Front-Left'], ['front right', 'Front-Right'], ['rear left', 'Rear-Left'], ['rear right', 'Rear-Right'], ['front', 'Front'], ['rear', 'Rear'], ['left', 'Left'], ['right', 'Right']];

/** "Front Brake Disc" -> "Front", "Rear Left Lamp" -> "Rear-Left", "Oil Filter" -> null (the part's own English name says where it goes). */
function positionFromPartName(name) {
  const n = String(name || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [word, position] of POSITION_WORDS) if (n === word || n.startsWith(`${word} `)) return position;
  return null;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_/\\.,:;'"，。、：；()（）[\]【】]+/g, '');
const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);
const usableKey = (k) => k.length >= (isAscii(k) ? 4 : 2);      // "灯" or "cap" alone would match far too much

/** parts: [{ categoryId, nameEn, nameZh }]. Returns { state: 'found'|'many'|'none', category, part, candidates }. */
function matchName(itemName, parts) {
  const n = norm(itemName);
  if (!n) return { state: 'none', category: null, part: null, candidates: [] };
  let best = 0;
  let hits = [];
  for (const p of parts) {
    let len = 0;
    for (const key of [norm(p.nameEn), norm(p.nameZh)]) if (key && usableKey(key) && n.includes(key) && key.length > len) len = key.length;
    if (len === 0) continue;
    if (len > best) { best = len; hits = [p]; } else if (len === best) hits.push(p);
  }
  if (hits.length === 1) return { state: 'found', category: hits[0].categoryId, part: hits[0].nameEn, candidates: [] };
  if (hits.length > 1) return { state: 'many', category: null, part: null, candidates: hits.slice(0, 5).map((h) => ({ category: h.categoryId, part: h.nameEn })) };
  return { state: 'none', category: null, part: null, candidates: [] };
}

/** Every category with its parts (and whether the part has its own weight and size, so the portal knows a row needs none). */
async function loadCatalog(client) {
  const { rows: cats } = await client.query('SELECT id, name_en, name_zh FROM product_categories ORDER BY sort_order ASC, name_en ASC');
  const { rows: parts } = await client.query('SELECT category_id, name_en, name_zh FROM category_parts ORDER BY sort_order ASC, name_en ASC');
  const catalog = [];
  for (const c of cats) {
    const own = parts.filter((p) => p.category_id === c.id);
    const withShipping = [];
    for (const p of own) withShipping.push({ nameEn: p.name_en, nameZh: p.name_zh || null, hasShipping: Boolean(await getPartShipping(c.id, p.name_en, client)) });
    catalog.push({ id: c.id, nameEn: c.name_en, nameZh: c.name_zh || null, parts: withShipping });
  }
  const flat = parts.map((p) => ({ categoryId: p.category_id, nameEn: p.name_en, nameZh: p.name_zh }));
  return { catalog, flat };
}

module.exports = { positionFromPartName, matchName, loadCatalog, norm };
