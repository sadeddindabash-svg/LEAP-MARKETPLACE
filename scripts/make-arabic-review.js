#!/usr/bin/env node
// Builds the workbook a native Arabic speaker reviews:  node scripts\make-arabic-review.js [output.xlsx] [--update-baseline]
//
// It reads the CURRENT texts (website dictionary, server messages, app texts), so it is always up to date. Texts written for the website or added since the last
// review are on the sheets to review (new ones first and highlighted); texts that are identical to ones in the Leap mobile app (written by the Leap team) are listed
// separately. The reviewer fills "Approved?" (Yes / No / Unsure) and, for No, the corrected Arabic; apply-arabic-review.js then puts the corrections into the code.
//
// --update-baseline : after a review has been APPLIED, remember every current text as reviewed, so the next workbook marks only newer texts as NEW.
const fs = require('fs');
const path = require('path');
const L = require('./arabic-lib');

const NEW_APP_KEYS = ['garage_limit_note', 'garage_no_version', 'garage_choose_version', 'choose_version_title'];   // app texts written recently (the rest of the app is the Leap team's own)
const GLOSSARY_TERMS = ['Add to cart', 'Cart', 'Wishlist', 'My garage', 'Add a car', 'Your cars', 'Version', 'Seats', 'My orders', 'Orders', 'Returns', 'Support', 'Sign in', 'Sign out', 'Create account',
  'Search', 'Price', 'In stock', 'Out of stock', 'Delivery', 'Shipping', 'Checkout', 'Place order', 'Address', 'Addresses', 'Notifications', 'Account', 'Home', 'Products', 'Brand', 'Model', 'Year',
  'Remove', 'Save', 'Cancel', 'Delete', 'Try again', 'Contact us', 'Loyalty', 'Referrals', 'Saved searches', 'Quote requests', 'Track order', 'Refund', 'Reviews', 'Warranty'];
// words the site must use ONE way: the check shows how many texts use each form so the reviewer can choose
const CONSISTENCY = [
  { name: 'car / vehicle', forms: { 'سيارة (car)': /سيار/, 'مركبة (vehicle)': /مركب/ } },
  { name: 'version / class / edition', forms: { 'الفئة': /الفئة|فئة/, 'النسخة': /النسخة|نسخة/, 'الطراز': /الطراز|طراز/ } },
];

function build(root = L.DEFAULT_ROOT, ExcelJS = L.loadExcel(root)) {
  const p = L.paths(root);
  const { EN, AR } = L.readDictionaries(p.i18n);
  const server = L.readServerMessagesTs(p.serverTs);
  const app = L.readAppStrings(p.appStrings);
  const baseline = fs.existsSync(p.baseline) ? JSON.parse(L.read(p.baseline)) : { dictionary: [], serverMessages: [] };
  const knownDictionary = new Set(baseline.dictionary), knownServer = new Set(baseline.serverMessages);

  const appArabic = new Set(Object.values(app).map((a) => a.ar));
  const keys = Object.keys(EN);
  const usage = L.usageMap(p.webSource, keys);
  const rows = keys.map((key) => ({ key, en: EN[key], ar: AR[key], fromApp: appArabic.has(AR[key]), isNew: !knownDictionary.has(key), where: usage[key], ph: L.placeholders(EN[key]).join(' ') }));
  const review = rows.filter((r) => !r.fromApp).sort((a, b) => (Number(b.isNew) - Number(a.isNew)) || a.where.localeCompare(b.where) || a.key.localeCompare(b.key));
  const matched = rows.filter((r) => r.fromApp).sort((a, b) => a.where.localeCompare(b.where) || a.key.localeCompare(b.key));
  const serverRows = server.map((e) => ({ ...e, isNew: !knownServer.has(e.en) })).sort((a, b) => Number(b.isNew) - Number(a.isNew));
  const appNew = NEW_APP_KEYS.filter((k) => app[k]).map((k) => ({ key: k, ...app[k] }));
  const lowerEn = new Map(Object.entries(EN).map(([k, v]) => [v.toLowerCase(), k]));
  const glossary = GLOSSARY_TERMS.filter((t) => lowerEn.has(t.toLowerCase())).map((t) => ({ term: t, key: lowerEn.get(t.toLowerCase()), ar: AR[lowerEn.get(t.toLowerCase())] }));

  // the automatic checks
  const problems = { placeholders: [], spaces: [], punctuation: [], digits: [], untranslated: [] };
  for (const key of keys) {
    const en = EN[key], ar = AR[key];
    if (L.placeholders(en).join() !== L.placeholders(ar).join()) problems.placeholders.push(key);
    if (ar !== ar.trim() || /  /.test(ar)) problems.spaces.push(key);
    if (L.hasArabicLetters(ar) && /[?,]/.test(ar)) problems.punctuation.push(key);
    if (/[\u0660-\u0669]/.test(ar)) problems.digits.push(key);
    if (ar === en && /[A-Za-z]{3,}/.test(en) && !/^\{\w+\}[\s(){}\w]*$/.test(en)) problems.untranslated.push(key);
  }
  for (const e of server) if (L.placeholders(e.en).join() !== L.placeholders(e.ar).join()) problems.placeholders.push(`server: ${e.en}`);
  const consistency = CONSISTENCY.map((group) => ({
    name: group.name,
    forms: Object.entries(group.forms).map(([label, re]) => {
      const hits = [...rows.map((r) => ({ id: r.key, ar: r.ar })), ...server.map((e) => ({ id: `server: ${e.en}`, ar: e.ar }))].filter((x) => re.test(x.ar));
      return { label, count: hits.length, examples: hits.slice(0, 6).map((h) => h.id) };
    }),
  }));
  return { rows, review, matched, serverRows, appNew, glossary, problems, consistency, counts: { dictionary: keys.length, server: server.length, app: Object.keys(app).length }, dictionaryKeys: keys, serverKeys: server.map((e) => e.en) };
}

async function write(file, root = L.DEFAULT_ROOT, ExcelJS = L.loadExcel(root)) {
  const data = build(root, ExcelJS);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leap Auto Parts';
  const NAVY = 'FF0B3146', NEWFILL = 'FFFFF4D6';
  const font = (o = {}) => ({ name: 'Arial', size: 10, ...o });
  const sheet = (name, headers, widths) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(headers);
    ws.getRow(1).height = 26;
    ws.getRow(1).eachCell((c) => { c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } }); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', wrapText: true }; });
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    return ws;
  };
  const approvedValidation = (ws, col, count) => { for (let r = 2; r <= count + 1; r++) ws.getCell(r, col).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No,Unsure"'] }; };
  const styleRows = (ws, arabicCols, newCol, keyCol) => ws.eachRow((row, n) => {
    if (n === 1) return;
    row.eachCell({ includeEmpty: true }, (c) => { c.font = font(); c.alignment = { vertical: 'top', wrapText: true }; });
    for (const col of arabicCols) { const c = row.getCell(col); c.font = font({ size: 12 }); c.alignment = { horizontal: 'right', vertical: 'top', wrapText: true, readingOrder: 'rtl' }; }
    if (newCol && row.getCell(newCol).value === 'NEW') row.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEWFILL } }; });
    if (keyCol) row.getCell(keyCol).font = font({ size: 9, color: { argb: 'FF6B7785' } });
  });

  // ---- Read me
  const guide = wb.addWorksheet('Read me');
  guide.getColumn(1).width = 120;
  const newCount = data.review.filter((r) => r.isNew).length + data.serverRows.filter((r) => r.isNew).length + data.appNew.length;
  const lines = [
    ["Leap Auto Parts: Arabic review of the website's, the server's and the app's texts", 'title'],
    ['', ''],
    ['What this is', 'h'],
    [`The website shows ${data.counts.dictionary} texts in Arabic. ${data.matched.length} of them are identical to texts in the mobile app (they came from the Leap team: sheet "Matches your app"). The other ${data.review.length} were written for the website and have not been read by a native speaker: sheet "To review". On top of those, ${data.serverRows.length} error messages the server sends ("Server messages", shown to buyers in the website AND the app) and ${data.appNew.length} recently written app texts ("App texts (new)") are included. ${newCount} of all these are new since the last review and come first, highlighted.`, ''],
    ['', ''],
    ['What to do', 'h'],
    ['1. Read the sheet "Glossary" first: these words repeat everywhere. Then read the "Automatic checks" sheet: at the bottom it shows words the site writes in two different ways (for example both سيارة and مركبة for "car"): please decide which one to use and tell us, so the whole site agrees.', ''],
    ['2. On each sheet, for every row read the English and the Arabic. In "Approved?" choose Yes, No or Unsure. If No, write the correct Arabic in "Corrected Arabic" (a short reason in "Notes" helps). Rows you leave empty are treated as fine.', ''],
    ['3. Keep the placeholders exactly as they are, in curly brackets, for example {n} or {max}: the website puts a number or a name there. Only their place in the sentence may move.', ''],
    ['4. Tone: clear Modern Standard Arabic that an ordinary buyer understands; short; polite; the same word for the same thing. Numbers are written with English digits (1, 2, 3) everywhere on the site.', ''],
    ['5. Send the file back. Only the rows with a correction change anything; the Leap team applies them with one command, which refuses a correction whose placeholders do not match.', ''],
    ['', ''],
    ['What was already checked automatically (sheet "Automatic checks")', 'h'],
    ['Placeholders match between English and Arabic; no Arabic text uses the Latin ? or , ; no stray spaces; no Arabic-Indic digits; no text left in English. What is left for you is wording, tone and consistency.', ''],
  ];
  lines.forEach(([text, kind], i) => { const c = guide.getCell(i + 1, 1); c.value = text; c.font = font({ size: kind === 'title' ? 14 : 11, bold: kind === 'title' || kind === 'h' }); c.alignment = { wrapText: true, vertical: 'top' }; });

  // ---- Glossary
  const g = sheet('Glossary', ['English term', 'Arabic used on the website', 'Key', 'Approved?', 'Corrected Arabic'], [28, 34, 26, 14, 34]);
  data.glossary.forEach((x) => g.addRow([x.term, x.ar, x.key, null, null]));
  styleRows(g, [2, 5], null, 3); approvedValidation(g, 4, data.glossary.length);

  // ---- To review
  const r = sheet('To review', ['#', 'Priority', 'Where it appears', 'English', 'Arabic (current)', 'Keep these placeholders', 'Approved?', 'Corrected Arabic', 'Notes', 'Key'], [5, 11, 30, 46, 46, 14, 12, 46, 30, 24]);
  data.review.forEach((x, i) => r.addRow([i + 1, x.isNew ? 'NEW' : '', x.where, x.en, x.ar, x.ph, null, null, null, x.key]));
  styleRows(r, [5, 8], 2, 10); approvedValidation(r, 7, data.review.length); r.autoFilter = { from: 'A1', to: `J${data.review.length + 1}` };

  // ---- Server messages
  const s = sheet('Server messages', ['Priority', 'English message (shown to the buyer, by the server)', 'Arabic (current)', 'Approved?', 'Corrected Arabic', 'Notes'], [11, 56, 56, 12, 56, 30]);
  data.serverRows.forEach((x) => s.addRow([x.isNew ? 'NEW' : '', x.en, x.ar, null, null, null]));
  styleRows(s, [3, 5], 1, null); approvedValidation(s, 4, data.serverRows.length);

  // ---- App texts (new)
  const a = sheet('App texts (new)', ['Key', 'English', 'Arabic (current)', 'Approved?', 'Corrected Arabic', 'Notes'], [26, 40, 46, 12, 46, 30]);
  data.appNew.forEach((x) => a.addRow([x.key, x.en, x.ar, null, null, null]));
  styleRows(a, [3, 5], null, 1); approvedValidation(a, 4, data.appNew.length);

  // ---- Matches the app
  const m = sheet('Matches your app', ['#', 'Where it appears', 'English', 'Arabic (same as the app)', 'Key'], [5, 30, 46, 46, 24]);
  data.matched.forEach((x, i) => m.addRow([i + 1, x.where, x.en, x.ar, x.key]));
  styleRows(m, [4], null, 5);

  // ---- Automatic checks
  const c = sheet('Automatic checks', ['Check', 'Result'], [78, 80]);
  const total = data.counts.dictionary;
  c.addRow(['Every placeholder such as {n} is in both the English and the Arabic text', data.problems.placeholders.length ? `PROBLEMS: ${data.problems.placeholders.join(', ')}` : `Passed for all ${total} texts and ${data.counts.server} server messages`]);
  c.addRow(['No leading, trailing or double spaces', data.problems.spaces.length ? `PROBLEMS: ${data.problems.spaces.join(', ')}` : `Passed for all ${total} texts`]);
  c.addRow(['No Arabic text uses the Latin question mark ? or comma ,', data.problems.punctuation.length ? `PROBLEMS: ${data.problems.punctuation.join(', ')}` : `Passed for all ${total} texts`]);
  c.addRow(['No Arabic-Indic digits (the site uses English digits)', data.problems.digits.length ? `PROBLEMS: ${data.problems.digits.join(', ')}` : `Passed for all ${total} texts`]);
  c.addRow(['No Arabic text that is just the English text left untranslated', data.problems.untranslated.length ? `PROBLEMS: ${data.problems.untranslated.join(', ')}` : `Passed for all ${total} texts`]);
  c.addRow(['', '']);
  const head = c.addRow(['WORDING CONSISTENCY (for you to decide: the site should use one form)', 'How many texts use each form (examples: keys)']);
  head.eachCell((cell) => { cell.font = font({ bold: true }); });
  for (const group of data.consistency) {
    const hasMany = group.forms.filter((f) => f.count > 0).length > 1;
    c.addRow([`${group.name}${hasMany ? '   <-- used in more than one form' : ''}`, group.forms.map((f) => `${f.label}: ${f.count} texts${f.count ? ` (${f.examples.join(', ')})` : ''}`).join('\n')]);
  }
  styleRows(c, [], null, null);
  c.eachRow((row, n) => { if (n > 1) { row.getCell(2).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }; } });

  await wb.xlsx.writeFile(file);
  return data;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes('--update-baseline');
  const out = args.find((a) => !a.startsWith('--')) || path.join(L.DEFAULT_ROOT, 'Leap_Arabic_Review.xlsx');
  write(out).then((data) => {
    const newCount = data.review.filter((r) => r.isNew).length + data.serverRows.filter((r) => r.isNew).length + data.appNew.length;
    console.log(`Written: ${out}`);
    console.log(`  to review: ${data.review.length} website texts, ${data.serverRows.length} server messages, ${data.appNew.length} app texts  (${newCount} new)  | matches the app: ${data.matched.length}`);
    for (const g of data.consistency) { const used = g.forms.filter((f) => f.count > 0); if (used.length > 1) console.log(`  wording to decide - ${g.name}: ${used.map((f) => `${f.label} ${f.count}`).join('  vs  ')}`); }
    if (updateBaseline) {
      const p = L.paths();
      fs.writeFileSync(p.baseline, JSON.stringify({ note: 'Texts that have been through an Arabic review. make-arabic-review.js marks everything else NEW.', dictionary: data.dictionaryKeys, serverMessages: data.serverKeys }, null, 1));
      console.log('  baseline updated: every current text now counts as reviewed');
    }
  }).catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
}

module.exports = { build, write };
