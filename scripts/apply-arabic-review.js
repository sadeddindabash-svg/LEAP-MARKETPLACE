#!/usr/bin/env node
// Puts a reviewer's corrections into the code:   node scripts\apply-arabic-review.js <Leap_Arabic_Review.xlsx> [--write]
//
// Without --write it only SHOWS what it would change (a dry run). With --write it changes the files:
//   website dictionary   apps\web-storefront\lib\i18n.ts            (sheets "To review" and "Glossary")
//   server messages      apps\web-storefront\lib\serverMessages.ts and apps\mobile\lib\core\server_messages.dart (sheet "Server messages", BOTH files, so they stay identical)
//   app texts            apps\mobile\lib\core\app_strings.dart       (sheet "App texts (new)")
// What counts as a correction: "Corrected Arabic" is filled in and "Approved?" is No or empty. Yes with a correction is a conflict (nothing is changed for that row);
// Unsure is listed, not applied. A correction is REFUSED when its {placeholders} differ from the English text, when it has no Arabic letters, or when it spans lines.
const path = require('path');
const fs = require('fs');
const L = require('./arabic-lib');

const SHEETS = {
  'To review': { kind: 'dictionary', english: 'English', current: 'Arabic (current)', approved: 'Approved?', corrected: 'Corrected Arabic', id: 'Key' },
  'Glossary': { kind: 'dictionary', english: 'English term', current: 'Arabic used on the website', approved: 'Approved?', corrected: 'Corrected Arabic', id: 'Key' },
  'Server messages': { kind: 'server', english: 'English message (shown to the buyer, by the server)', current: 'Arabic (current)', approved: 'Approved?', corrected: 'Corrected Arabic', id: null },
  'App texts (new)': { kind: 'app', english: 'English', current: 'Arabic (current)', approved: 'Approved?', corrected: 'Corrected Arabic', id: 'Key' },
};

async function readReview(file, ExcelJS) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rows = [];
  for (const [sheetName, spec] of Object.entries(SHEETS)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    const col = {};
    ws.getRow(1).eachCell((cell, n) => { col[String(cell.text).trim()] = n; });
    for (const needed of [spec.english, spec.current, spec.approved, spec.corrected]) if (!col[needed]) throw new Error(`The sheet "${sheetName}" has no column "${needed}". Was the header row changed?`);
    if (spec.id && !col[spec.id]) throw new Error(`The sheet "${sheetName}" has no column "${spec.id}". Was the header row changed?`);
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const text = (name) => (name && col[name] ? String(row.getCell(col[name]).text || '').trim() : '');
      rows.push({ sheet: sheetName, row: n, kind: spec.kind, id: text(spec.id), english: text(spec.english), current: text(spec.current), approved: text(spec.approved), corrected: text(spec.corrected) });
    });
  }
  return rows;
}

/** The Arabic text that is in the code RIGHT NOW for a row (not what the workbook's "current" column says: a workbook may be older than the code). */
function actualArabic(r, texts) {
  if (r.kind === 'dictionary') return texts.dictionary.AR[r.id];
  if (r.kind === 'server') { const hit = texts.server.find((e) => e.en === r.english); return hit ? hit.ar : undefined; }
  return texts.app[r.id] ? texts.app[r.id].ar : undefined;
}

/** What to do with each row. Returns { changes, unsure, problems, untouched }. Nothing is written here. */
function plan(rows, dictionary, texts = { dictionary, server: [], app: {} }) {
  const changes = [], unsure = [], problems = [];
  let untouched = 0;
  for (const r of rows) {
    const where = `${r.sheet} row ${r.row}`;
    const answer = r.approved.toLowerCase();
    if (answer === 'unsure') { unsure.push({ where, id: r.id || r.english, english: r.english, current: r.current, note: r.corrected }); continue; }
    if (!r.corrected) { untouched++; continue; }
    if (answer === 'yes') { problems.push({ where, text: `marked Yes but a correction is written: nothing was changed (set Approved? to No if the correction is meant)` }); continue; }
    if (answer && answer !== 'no') { problems.push({ where, text: `"Approved?" says "${r.approved}": use Yes, No or Unsure` }); continue; }
    if (/[\r\n]/.test(r.corrected)) { problems.push({ where, text: 'the correction spans more than one line' }); continue; }
    const actual = actualArabic(r, texts);
    if (actual !== undefined && r.corrected === actual) { untouched++; continue; }                  // already in place in the code (for example this review was applied before)
    if (!L.hasArabicLetters(r.corrected)) { problems.push({ where, text: `the correction "${r.corrected}" has no Arabic letters` }); continue; }
    // the English text the placeholders must match: the sheet's, or for a dictionary key the dictionary's own (the Glossary shows only a term)
    const english = r.kind === 'dictionary' && dictionary.EN[r.id] !== undefined ? dictionary.EN[r.id] : r.english;
    if (r.kind === 'dictionary' && !(r.id in dictionary.EN)) { problems.push({ where, text: `the key "${r.id}" does not exist in the dictionary` }); continue; }
    if (L.placeholders(english).join() !== L.placeholders(r.corrected).join()) {
      problems.push({ where, text: `REFUSED: the placeholders differ. English has [${L.placeholders(english).join(' ') || 'none'}], the correction has [${L.placeholders(r.corrected).join(' ') || 'none'}]` });
      continue;
    }
    const warnings = [];
    if (/[?,]/.test(r.corrected)) warnings.push('uses a Latin ? or , (the Arabic ones are ؟ and ،)');
    if (/[\u0660-\u0669]/.test(r.corrected)) warnings.push('uses Arabic-Indic digits (the site uses English digits)');
    changes.push({ where, kind: r.kind, id: r.id, english: r.english, from: actual !== undefined ? actual : r.current, to: r.corrected, warnings });
  }
  return { changes, unsure, problems, untouched };
}

/** Applies planned changes to the files under root; returns what was done. Stops (changing nothing) if any single change cannot be placed. */
function applyChanges(changes, root, write) {
  const p = L.paths(root);
  const files = { i18n: L.read(p.i18n), serverTs: L.read(p.serverTs), serverDart: L.read(p.serverDart), appStrings: L.read(p.appStrings) };
  const original = { ...files };
  const failures = [];
  for (const c of changes) {
    try {
      if (c.kind === 'dictionary') files.i18n = L.replaceDictionaryArabic(files.i18n, c.id, c.to);
      else if (c.kind === 'server') { files.serverTs = L.replaceServerArabicTs(files.serverTs, c.english, c.to); files.serverDart = L.replaceServerArabicDart(files.serverDart, c.english, c.to); }
      else if (c.kind === 'app') files.appStrings = L.replaceAppStringArabic(files.appStrings, c.id, c.to);
    } catch (e) { failures.push({ where: c.where, text: e.message }); }
  }
  if (failures.length) return { written: false, failures };
  const touched = [];
  if (write) {
    const targets = { i18n: p.i18n, serverTs: p.serverTs, serverDart: p.serverDart, appStrings: p.appStrings };
    for (const k of Object.keys(files)) if (files[k] !== original[k]) { fs.writeFileSync(targets[k], files[k]); touched.push(path.relative(root, targets[k])); }
  }
  return { written: write, failures: [], touched };
}

async function applyReview({ file, root = L.DEFAULT_ROOT, write = false, ExcelJS = L.loadExcel(root) }) {
  const rows = await readReview(file, ExcelJS);
  const p = L.paths(root);
  const dictionary = L.readDictionaries(p.i18n);
  const result = plan(rows, dictionary, { dictionary, server: L.readServerMessagesTs(p.serverTs), app: L.readAppStrings(p.appStrings) });
  const applied = result.changes.length ? applyChanges(result.changes, root, write) : { written: write, failures: [], touched: [] };
  return { ...result, ...applied, rowsRead: rows.length };
}

function report(r, write) {
  const line = (s) => console.log(s);
  line(`Rows read: ${r.rowsRead}   corrections: ${r.changes.length}   unsure: ${r.unsure.length}   problems: ${r.problems.length + r.failures.length}   unchanged: ${r.untouched}`);
  for (const c of r.changes) { line(`\n  ${write ? 'CHANGED' : 'would change'}  ${c.where}  ${c.kind === 'server' ? `"${c.english}"` : c.id}`); line(`      from: ${c.from}`); line(`      to:   ${c.to}`); for (const w of c.warnings) line(`      note: ${w}`); }
  if (r.unsure.length) { line('\n  UNSURE (not applied; for the Leap team to decide):'); for (const u of r.unsure) line(`    ${u.where}  ${u.id}  ${u.current}${u.note ? `   [reviewer note: ${u.note}]` : ''}`); }
  if (r.problems.length || r.failures.length) { line('\n  PROBLEMS (these rows were NOT applied):'); for (const p of [...r.problems, ...r.failures]) line(`    ${p.where}: ${p.text}`); }
  if (r.failures.length) line('\n  A correction could not be placed in the code, so NOTHING was written. Fix the rows above (or edit those texts by hand) and run again.');
  else if (write) line(r.touched.length ? `\nWritten: ${r.touched.join(', ')}\nNext: run the website tests (npm test in apps\\web-storefront), then  node scripts\\make-arabic-review.js --update-baseline  to mark these texts as reviewed.` : '\nNothing needed changing.');
  else if (r.changes.length) line('\nThis was a dry run: nothing was changed. Add --write to apply.');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const write = args.includes('--write');
  if (!file) { console.error('Usage: node scripts\\apply-arabic-review.js <Leap_Arabic_Review.xlsx> [--write]'); process.exit(2); }
  applyReview({ file: path.resolve(file), write }).then((r) => { report(r, write); process.exit(r.failures.length || r.problems.length ? 1 : 0); })
    .catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
}

module.exports = { applyReview, readReview, plan, applyChanges };
