#!/usr/bin/env node
// Applies the mobile-app part of leap_garage_versions.zip to YOUR files, as a handful of small edits, instead of replacing your files with mine:
//   node scripts\patch-mobile-versions.js            (shows what it would do; changes nothing)
//   node scripts\patch-mobile-versions.js --write    (does it; the original of each changed file is kept as <file>.before-garage-versions.bak)
//
// Why this exists: a file replaced as a whole loses anything your copy has that mine did not. This only touches the lines it needs: for every edit it looks for the
// exact lines it was made for. A file in which an edit cannot be placed (your file differs there) is left completely untouched and reported, never half-changed.
const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, 'patch-data', 'mobile-versions.json');

const countOf = (text, part) => (part.length === 0 ? 0 : text.split(part).length - 1);

/** Plans (and optionally writes) the edits for the files under `root`. Returns one entry per file. */
function patch({ root = DEFAULT_ROOT, write = false, data = JSON.parse(fs.readFileSync(DATA, 'utf8')) } = {}) {
  const results = [];
  for (const [rel, hunks] of Object.entries(data.files)) {
    const file = path.join(root, rel);
    const result = { file: rel, edits: hunks.length, applied: 0, already: 0, failed: [], written: false };
    results.push(result);
    if (!fs.existsSync(file)) { result.failed.push({ index: 0, reason: 'the file does not exist here' }); continue; }
    const original = fs.readFileSync(file, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';                          // a file saved on Windows may use CRLF line ends
    const fit = (s) => (eol === '\r\n' ? s.replace(/\n/g, '\r\n') : s);
    let text = original;
    hunks.forEach((h, i) => {
      const oldText = fit(h.old), newText = fit(h.new);
      if (text.includes(newText)) { result.already++; return; }
      const n = countOf(text, oldText);
      if (n === 1) { text = text.replace(oldText, () => newText); result.applied++; return; }
      result.failed.push({ index: i + 1, reason: n === 0 ? 'the lines this edit belongs to were not found (your file differs here)' : `the lines this edit belongs to appear ${n} times`, around: h.old.split('\n').find((l) => l.trim()) });
    });
    if (result.failed.length === 0 && text !== original) {
      if (write) {
        const backup = `${file}.before-garage-versions.bak`;
        if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
        fs.writeFileSync(file, text);
        result.written = true;
      }
    }
  }
  return results;
}

function report(results, write) {
  let bad = 0, todo = 0;
  for (const r of results) {
    const status = r.failed.length ? 'CANNOT BE PATCHED (left untouched)' : r.applied === 0 ? 'already up to date' : write ? 'patched' : 'would be patched';
    console.log(`  ${r.file}\n      ${r.edits} edit(s): ${r.applied} ${write ? 'applied' : 'to apply'}, ${r.already} already in place, ${r.failed.length} failed   -> ${status}`);
    for (const f of r.failed) console.log(`      edit ${f.index}: ${f.reason}${f.around ? `\n          near: ${f.around.trim().slice(0, 100)}` : ''}`);
    bad += r.failed.length; if (r.applied) todo++;
  }
  console.log('');
  if (bad) console.log('Some files could not be patched: send those files (and this output) so the edits can be made for YOUR version of them.');
  else if (!write && todo) console.log('This was a dry run: nothing was changed. Add --write to apply.');
  else if (write && todo) console.log('Done. Originals are kept next to each changed file as *.before-garage-versions.bak. Next: scripts\\check-mobile.cmd');
  else console.log('Nothing to do: every edit is already in place.');
  return bad;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const rootArg = args.indexOf('--root');
  const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : DEFAULT_ROOT;
  console.log(`${write ? 'Patching' : 'Checking'} the mobile app in ${root}\n`);
  process.exit(report(patch({ root, write }), write) ? 1 : 0);
}

module.exports = { patch };
