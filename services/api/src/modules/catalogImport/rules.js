// The checks on every row of the sheet, with no database: what each row must contain, the NAMING RULES (a main category is ONE word, a sub-category 1 to 3 words, a part name
// 1 to 5 words), that the three languages are filled, that the positions and sizes are sensible, and that the same code, or the same name, is not used for two things.
// Returns, for each row, whether it is usable and a list of plain-words messages. The same rules are applied again when an admin edits a category or a part (details.js).
const { COLUMNS, POSITIONS } = require('./columns');
const { asText } = require('./parser');

const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u3400-\u9fff]/;
const MAIN_CODE = /^[A-Za-z]{2,5}$/;
const PART_CODE = /^([A-Za-z]{2,5})-\d{3,4}$/;
const MAX_SIDE_CM = 400, MAX_WEIGHT_KG = 1000;

/** Words as people count them: separated by spaces; "Front-Left" is one word; a " - " separator is not a word. */
const wordsOf = (text) => String(text || '').replace(/\s+-\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
const key = (text) => asText(text).toLowerCase();
const num = (v) => { if (v === '' || v === null || v === undefined) return null; const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const pad = (a, b) => (a && b ? `${a} ${b}` : a);

/** The naming rules, shared with the editing screens. Returns a list of plain-words problems (empty when the names obey them). */
function namingProblems({ mainEn, subEn, partNameEn }) {
  const problems = [];
  if (mainEn !== undefined && wordsOf(mainEn).length !== 1) problems.push(`The main category "${mainEn}" must be exactly one word (it has ${wordsOf(mainEn).length})`);
  if (subEn !== undefined && (wordsOf(subEn).length < 1 || wordsOf(subEn).length > 3)) problems.push(`The sub-category "${subEn}" must be 1 to 3 words (it has ${wordsOf(subEn).length})`);
  if (partNameEn !== undefined && (wordsOf(partNameEn).length < 1 || wordsOf(partNameEn).length > 5)) problems.push(`The part name "${partNameEn}" must be 1 to 5 words (it has ${wordsOf(partNameEn).length})`);
  return problems;
}

/** "Front; Rear" -> ['Front', 'Rear'] with the official spelling, or { error }. */
function parsePositions(text) {
  const parts = asText(text).split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { error: 'Allowed Positions is empty' };
  const out = [];
  for (const p of parts) {
    const official = POSITIONS.find((x) => x.toLowerCase() === p.toLowerCase());
    if (!official) return { error: `Position "${p}" is not accepted (accepted: ${POSITIONS.join(', ')})` };
    if (!out.includes(official)) out.push(official);
  }
  return { positions: out };
}

function validateRows(rows) {
  const items = rows.map((row) => {
    const messages = [];
    const err = (text) => messages.push({ level: 'error', text });
    const warn = (text) => messages.push({ level: 'warning', text });
    const t = {};
    for (const [k, def] of Object.entries(COLUMNS)) {
      t[k] = asText(row.values[k]);
      if (def.required && t[k] === '' && !['positions', 'length', 'width', 'height', 'weight', 'basis'].includes(k)) err(`${def.header} is empty`);
      if (def.max && t[k].length > def.max) err(`${def.header} is longer than ${def.max} characters`);
    }

    // codes
    if (t.mainCode && !MAIN_CODE.test(t.mainCode)) err(`Main Category Code "${t.mainCode}" must be 2 to 5 letters`);
    const pm = PART_CODE.exec(t.partCode);
    if (t.partCode && !pm) err(`Part Code "${t.partCode}" must look like BRK-001 (letters, a dash, then 3 or 4 digits)`);
    else if (pm && t.mainCode && pm[1].toLowerCase() !== t.mainCode.toLowerCase()) err(`Part Code "${t.partCode}" does not start with its Main Category Code "${t.mainCode}"`);

    // names: the naming rules (English), the same name in all three languages
    const partNameEn = t.varEn ? pad(t.subEn, t.varEn) : t.subEn;
    const partNameAr = t.varAr ? pad(t.subAr, t.varAr) : t.subAr;
    const partNameZh = t.varZh ? pad(t.subZh, t.varZh) : t.subZh;
    if (t.mainEn || t.subEn) for (const p of namingProblems({ mainEn: t.mainEn || undefined, subEn: t.subEn || undefined, partNameEn: partNameEn || undefined })) err(p);
    if (t.varEn && (!t.varAr || !t.varZh)) err('A Variant is given in English, so it is needed in Arabic and Chinese too');
    if (!t.varEn && (t.varAr || t.varZh)) err('A Variant is given in Arabic or Chinese but not in English');
    const noArabic = [['Main Category', t.mainAr], ['Sub Category', t.subAr]].filter(([, v]) => v && !ARABIC.test(v)).map(([n]) => n);
    const noChinese = [['Main Category', t.mainZh], ['Sub Category', t.subZh]].filter(([, v]) => v && !CJK.test(v)).map(([n]) => n);
    if (noArabic.length) warn(`The Arabic text of ${noArabic.join(' and ')} has no Arabic letters (columns mixed up?)`);
    if (noChinese.length) warn(`The Chinese text of ${noChinese.join(' and ')} has no Chinese characters (columns mixed up?)`);

    // positions
    let positions = [];
    const pp = parsePositions(t.positions);
    if (pp.error) err(pp.error); else positions = pp.positions;
    if (t.varEn && positions.length && !(positions.length === 1 && positions[0] === 'Universal')) err('A part with a Variant (a pack size or type) can only have the position Universal');

    // size and weight
    const sz = { lengthCm: num(row.values.length), widthCm: num(row.values.width), heightCm: num(row.values.height), weightKg: num(row.values.weight) };
    for (const [k, label, limit, unit] of [['lengthCm', 'Length', MAX_SIDE_CM, 'cm'], ['widthCm', 'Width', MAX_SIDE_CM, 'cm'], ['heightCm', 'Height', MAX_SIDE_CM, 'cm'], ['weightKg', 'Weight', MAX_WEIGHT_KG, 'kg']]) {
      if (sz[k] === null) err(`${label} is empty or not a number`);
      else if (sz[k] <= 0) err(`${label} must be more than zero`);
      else if (sz[k] > limit) err(`${label} ${sz[k]} ${unit} is above ${limit} ${unit}: probably a typing mistake`);
    }
    let basis = null;
    if (/^estimate/i.test(t.basis)) basis = 'estimate'; else if (/^measured/i.test(t.basis)) basis = 'measured';
    else err(t.basis ? `Size Basis "${t.basis}" must start with Estimate or Measured` : 'Size Basis is empty');

    const data = {
      main: { code: t.mainCode.toUpperCase(), en: t.mainEn, ar: t.mainAr, zh: t.mainZh },
      part: {
        code: t.partCode.toUpperCase(), nameEn: partNameEn, nameAr: partNameAr, nameZh: partNameZh,
        sub: { en: t.subEn, ar: t.subAr, zh: t.subZh }, variant: { en: t.varEn, ar: t.varAr, zh: t.varZh }, positions,
        placement: { en: t.placeEn, ar: t.placeAr, zh: t.placeZh }, size: sz, sizeBasis: basis, appliesTo: t.applies, special: t.special,
        keywords: { en: t.kwEn, ar: t.kwAr, zh: t.kwZh },
      },
    };
    return { rowNumber: row.rowNumber, ok: !messages.some((m) => m.level === 'error'), data, messages };
  });

  // the file as a whole: one code, one meaning
  const mainByCode = new Map(), mainByName = new Map(), partCodes = new Map(), names = { en: new Map(), ar: new Map(), zh: new Map() };
  for (const item of items) {
    const { main, part } = item.data;
    const bad = (text) => { item.messages.push({ level: 'error', text }); item.ok = false; };
    if (main.code && main.en) {
      const m = mainByCode.get(main.code.toLowerCase());
      if (!m) mainByCode.set(main.code.toLowerCase(), { row: item.rowNumber, ...main });
      else for (const [lang, label] of [['en', 'English'], ['ar', 'Arabic'], ['zh', 'Chinese']]) {
        if (key(main[lang]) !== key(m[lang])) bad(`Main category ${main.code} has a different ${label} name here than in row ${m.row} ("${main[lang]}" and "${m[lang]}")`);
      }
      const other = mainByName.get(key(main.en));
      if (!other) mainByName.set(key(main.en), { code: main.code, row: item.rowNumber });
      else if (other.code.toLowerCase() !== main.code.toLowerCase()) bad(`The main category name "${main.en}" is used for two codes: ${other.code} (row ${other.row}) and ${main.code}`);
    }
    if (part.code) {
      if (partCodes.has(part.code.toLowerCase())) bad(`The part code ${part.code} is already used in row ${partCodes.get(part.code.toLowerCase())}`);
      else partCodes.set(part.code.toLowerCase(), item.rowNumber);
    }
    for (const [lang, label, value] of [['en', 'English', part.nameEn], ['ar', 'Arabic', part.nameAr], ['zh', 'Chinese', part.nameZh]]) {
      if (!value || !main.code) continue;
      const k = `${main.code.toLowerCase()}|${key(value)}`;
      if (names[lang].has(k)) bad(`The ${label} part name "${value}" is already used in this category by row ${names[lang].get(k)}`);
      else names[lang].set(k, item.rowNumber);
    }
  }
  return items;
}

module.exports = { validateRows, namingProblems, parsePositions, wordsOf, MAX_SIDE_CM, MAX_WEIGHT_KG };
