// Tests of make-arabic-review.js and apply-arabic-review.js. Run:  node --test scripts\
// They work on a throwaway COPY of the real files (never the real ones), build a real review workbook, fill it in the way a reviewer would and check that exactly the
// right lines change and nothing else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./arabic-lib');
const { build, write } = require('./make-arabic-review');
const { applyReview } = require('./apply-arabic-review');

const REPO = L.DEFAULT_ROOT;
const ExcelJS = L.loadExcel(REPO);

/** A throwaway project with the four real text files copied in; returns its root. */
function copyOfProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leap-arabic-'));
  const real = L.paths(REPO), tmp = L.paths(root);
  for (const key of ['i18n', 'serverTs', 'serverDart', 'appStrings']) { fs.mkdirSync(path.dirname(tmp[key]), { recursive: true }); fs.copyFileSync(real[key], tmp[key]); }
  return root;
}
const linesOf = (file) => fs.readFileSync(file, 'utf8').split('\n');
const changedLines = (a, b) => { const x = linesOf(a), y = linesOf(b); return x.length !== y.length ? -1 : x.filter((l, i) => l !== y[i]).length; };

/** Makes a workbook from the current texts of `root`, lets `edit(sheets)` fill it in, saves it, and returns its path. */
async function reviewed(root, edit) {
  const file = path.join(root, 'review.xlsx');
  await write(file, REPO, ExcelJS);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheets = {};
  for (const ws of wb.worksheets) {
    const col = {};
    ws.getRow(1).eachCell((c, n) => { col[String(c.text).trim()] = n; });
    sheets[ws.name] = {
      find: (header, value) => { let hit = null; ws.eachRow((row, n) => { if (n > 1 && !hit && String(row.getCell(col[header]).text) === value) hit = n; }); return hit; },
      set: (rowNumber, header, value) => { ws.getRow(rowNumber).getCell(col[header]).value = value; },
      get: (rowNumber, header) => String(ws.getRow(rowNumber).getCell(col[header]).text),
    };
  }
  edit(sheets);
  await wb.xlsx.writeFile(file);
  return file;
}

test('quoting: Dart text with an apostrophe, a backslash or a dollar sign survives a round trip', () => {
  for (const text of ["You can't do that", 'a\\b', 'costs $5', "it's \\ $x"]) assert.equal(L.parseDartString(L.dartQuote(text)), text);
  assert.equal(L.dartQuote("can't"), "'can\\'t'");
});

test('one dictionary line changes: the key, nothing else; a missing key is an error', () => {
  const src = fs.readFileSync(L.paths(REPO).i18n, 'utf8');
  const { AR } = L.readDictionaries(L.paths(REPO).i18n);
  const key = Object.keys(AR)[10];
  const out = L.replaceDictionaryArabic(src, key, 'نص جديد');
  const a = src.split('\n'), b = out.split('\n');
  assert.equal(a.length, b.length);
  assert.equal(a.filter((l, i) => l !== b[i]).length, 1);
  assert.match(b.find((l, i) => l !== a[i]), new RegExp(`^\\s*${key}: "نص جديد",$`));
  assert.throws(() => L.replaceDictionaryArabic(src, 'no_such_key_at_all', 'x'), /was not found/);
  assert.throws(() => L.replaceDictionaryArabic(src, 'bad key!', 'x'), /not a valid key/);
});

test('server messages: the website file and the app file are changed together, including a text with an apostrophe', () => {
  const ts = 'export const SERVER_MESSAGES_AR: Record<string, string> = {\n  "You can\'t go": "قديم",\n  "Other": "آخر",\n};\n';
  const dart = "const Map<String, String> kServerMessagesAr = {\n  \"You can't go\": 'قديم',\n  'Other': 'آخر',\n};\n";
  assert.equal(L.replaceServerArabicTs(ts, "You can't go", 'جديد'), ts.replace('قديم', 'جديد'));
  assert.equal(L.replaceServerArabicDart(dart, "You can't go", 'جديد'), dart.replace('قديم', 'جديد'));
  const dartEscaped = "const Map<String, String> kServerMessagesAr = {\n  'You can\\'t go': 'قديم',\n};\n";
  assert.match(L.replaceServerArabicDart(dartEscaped, "You can't go", 'جديد'), /: 'جديد',/);
  assert.throws(() => L.replaceServerArabicTs(ts, 'Missing', 'x'), /was not found/);
});

test('the review workbook: all the sheets, every key once, glossary keys real, new texts first', async () => {
  const data = build(REPO, ExcelJS);
  assert.equal(data.review.length + data.matched.length, data.counts.dictionary);
  assert.equal(new Set(data.review.map((r) => r.key)).size, data.review.length);
  const { EN } = L.readDictionaries(L.paths(REPO).i18n);
  for (const g of data.glossary) assert.ok(g.key in EN, g.key);
  const firstOld = data.review.findIndex((r) => !r.isNew);
  assert.ok(data.review.slice(firstOld).every((r) => !r.isNew), 'new texts come first');
  assert.equal(data.serverRows.length, 90);
  assert.ok(data.serverRows.some((r) => r.isNew && /Choose the version of this car/.test(r.en)));
  assert.deepEqual(data.problems.placeholders, []);                                              // the placeholders of the real texts all match
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leap-arabic-')), 'r.xlsx');
  await write(file, REPO, ExcelJS);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Read me', 'Glossary', 'To review', 'Server messages', 'App texts (new)', 'Matches your app', 'Automatic checks']);
});

test('CRITICAL: a dry run changes nothing; --write changes exactly the corrected texts; a second run finds nothing left to do', async () => {
  const root = copyOfProject(), p = L.paths(root);
  const { EN, AR } = L.readDictionaries(p.i18n);
  const plainKey = Object.keys(AR).find((k) => !/\{\w+\}/.test(EN[k]) && build(REPO, ExcelJS).review.some((r) => r.key === k));
  const file = await reviewed(root, (s) => { const row = s['To review'].find('Key', plainKey); s['To review'].set(row, 'Approved?', 'No'); s['To review'].set(row, 'Corrected Arabic', 'نص مصحح من المراجع'); });
  const before = { i18n: fs.readFileSync(p.i18n), ts: fs.readFileSync(p.serverTs), dart: fs.readFileSync(p.serverDart), app: fs.readFileSync(p.appStrings) };
  const dry = await applyReview({ file, root, write: false, ExcelJS });
  assert.equal(dry.changes.length, 1); assert.equal(dry.problems.length, 0);
  assert.ok(fs.readFileSync(p.i18n).equals(before.i18n), 'a dry run must not touch the files');
  const done = await applyReview({ file, root, write: true, ExcelJS });
  assert.deepEqual(done.touched.map((f) => f.split(path.sep).join('/')), ['apps/web-storefront/lib/i18n.ts']);
  assert.ok(fs.readFileSync(p.serverTs).equals(before.ts) && fs.readFileSync(p.serverDart).equals(before.dart) && fs.readFileSync(p.appStrings).equals(before.app));
  const after = L.readDictionaries(p.i18n);
  assert.equal(after.AR[plainKey], 'نص مصحح من المراجع');
  assert.deepEqual(Object.keys(after.AR), Object.keys(AR));                                       // the same keys, in the same order
  for (const k of Object.keys(AR)) if (k !== plainKey) assert.equal(after.AR[k], AR[k], k);       // every other text is exactly as it was
  assert.deepEqual(after.EN, EN);                                                                 // the English is untouched
  const again = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(again.changes.length, 0);                                                          // already in place
});

test('CRITICAL: a correction whose {placeholders} differ from the English is REFUSED, and nothing is written for it', async () => {
  const root = copyOfProject(), p = L.paths(root);
  const withPlaceholder = build(REPO, ExcelJS).review.find((r) => r.ph.includes('{'));
  const file = await reviewed(root, (s) => { const row = s['To review'].find('Key', withPlaceholder.key); s['To review'].set(row, 'Approved?', 'No'); s['To review'].set(row, 'Corrected Arabic', 'نص بلا العنصر النائب'); });
  const before = fs.readFileSync(p.i18n);
  const result = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(result.changes.length, 0);
  assert.match(result.problems[0].text, /REFUSED: the placeholders differ/);
  assert.ok(fs.readFileSync(p.i18n).equals(before));
  const kept = await reviewed(root, (s) => { const row = s['To review'].find('Key', withPlaceholder.key); s['To review'].set(row, 'Approved?', 'No'); s['To review'].set(row, 'Corrected Arabic', `نص ${withPlaceholder.ph.split(' ').join(' ')} صحيح`); });
  const ok = await applyReview({ file: kept, root, write: false, ExcelJS });
  assert.equal(ok.changes.length, 1);                                                             // the same placeholders, moved in the sentence: fine
});

test('Yes with a correction is a conflict, Unsure is listed and not applied, a correction with no Arabic letters or two lines is refused, a blank Approved? still applies', async () => {
  const root = copyOfProject(), p = L.paths(root);
  const rows = build(REPO, ExcelJS).review.filter((r) => !r.ph).slice(0, 5);
  const file = await reviewed(root, (s) => {
    const t = s['To review']; const at = (i) => t.find('Key', rows[i].key);
    t.set(at(0), 'Approved?', 'Yes'); t.set(at(0), 'Corrected Arabic', 'تصحيح متناقض');
    t.set(at(1), 'Approved?', 'Unsure'); t.set(at(1), 'Notes', 'ask the team');
    t.set(at(2), 'Approved?', 'No'); t.set(at(2), 'Corrected Arabic', 'only english letters');
    t.set(at(3), 'Approved?', 'No'); t.set(at(3), 'Corrected Arabic', 'سطر أول\nسطر ثان');
    t.set(at(4), 'Corrected Arabic', 'تصحيح بلا اختيار');
  });
  const result = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(result.changes.length, 1); assert.equal(result.changes[0].id, rows[4].key);
  assert.equal(result.unsure.length, 1);
  assert.equal(result.problems.length, 3);
  assert.match(result.problems.map((x) => x.text).join(' | '), /marked Yes but a correction is written.*no Arabic letters.*more than one line/);
  const after = L.readDictionaries(p.i18n).AR;
  assert.equal(after[rows[4].key], 'تصحيح بلا اختيار');
  for (const i of [0, 1, 2, 3]) assert.equal(after[rows[i].key], rows[i].ar, rows[i].key);
});

test('CRITICAL: a server message correction changes BOTH the website file and the app file, and the two lists stay identical', async () => {
  const root = copyOfProject(), p = L.paths(root);
  const english = 'Choose the version of this car';
  const file = await reviewed(root, (s) => { const row = s['Server messages'].find('English message (shown to the buyer, by the server)', english); s['Server messages'].set(row, 'Approved?', 'No'); s['Server messages'].set(row, 'Corrected Arabic', 'يرجى اختيار فئة المركبة'); });
  const result = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.touched.map((f) => path.basename(f)).sort(), ['serverMessages.ts', 'server_messages.dart']);
  const ts = L.readServerMessagesTs(p.serverTs);
  assert.equal(ts.find((e) => e.en === english).ar, 'يرجى اختيار فئة المركبة');
  const dart = fs.readFileSync(p.serverDart, 'utf8');
  assert.match(dart, /'Choose the version of this car': 'يرجى اختيار فئة المركبة',/);
  assert.equal(ts.length, 90);
  assert.equal(changedLines(L.paths(REPO).serverDart, p.serverDart), 1);                          // exactly one line of the app file differs
  assert.equal(changedLines(L.paths(REPO).serverTs, p.serverTs), 1);
});

test('an app text and a glossary term are corrected in their own files (the glossary by its key)', async () => {
  const root = copyOfProject(), p = L.paths(root);
  const glossary = build(REPO, ExcelJS).glossary[0];
  const file = await reviewed(root, (s) => {
    const a = s['App texts (new)']; const arow = a.find('Key', 'garage_no_version'); a.set(arow, 'Approved?', 'No'); a.set(arow, 'Corrected Arabic', 'لم تُختر الفئة بعد');
    const g = s['Glossary']; const grow = g.find('Key', glossary.key); g.set(grow, 'Approved?', 'No'); g.set(grow, 'Corrected Arabic', 'مصطلح مصحح');
  });
  const result = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(result.changes.length, 2); assert.equal(result.problems.length, 0);
  assert.equal(L.readAppStrings(p.appStrings).garage_no_version.ar, 'لم تُختر الفئة بعد');
  assert.equal(L.readAppStrings(p.appStrings).garage_no_version.en, 'No version chosen');
  assert.equal(L.readDictionaries(p.i18n).AR[glossary.key], 'مصطلح مصحح');
  assert.equal(changedLines(L.paths(REPO).appStrings, p.appStrings), 1);
});

test('a key that does not exist is reported, and a workbook whose header row was changed is refused with a clear message', async () => {
  const root = copyOfProject();
  const file = await reviewed(root, (s) => { const row = 2; s['To review'].set(row, 'Key', 'invented_key'); s['To review'].set(row, 'Approved?', 'No'); s['To review'].set(row, 'Corrected Arabic', 'نص'); });
  const result = await applyReview({ file, root, write: true, ExcelJS });
  assert.equal(result.changes.length, 0);
  assert.match(result.problems[0].text, /does not exist in the dictionary/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  wb.getWorksheet('To review').getRow(1).getCell(8).value = 'Something else';
  await wb.xlsx.writeFile(file);
  await assert.rejects(applyReview({ file, root, write: false, ExcelJS }), /has no column "Corrected Arabic"/);
});
