/**
 * Finds the app's "Sort & price" sheet and collects what is needed to wire in the currency-aware price boxes and fix dark mode, into ONE text file to send back: sheet-report.txt (in the project folder).
 * It only READS files; it changes nothing.
 *
 *   node scripts/find-sort-price-sheet.js
 *
 * It reports: the file(s) that show "Sort & price" (the lines around the title, every line that mentions a dollar sign, minPrice/maxPrice, a text field, a fixed colour or the theme), the app's theme file (the colours of light and dark mode)
 * and the app's currency file (how a price is converted and written).
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const lib = process.env.APP_LIB || path.join(root, 'apps', 'mobile', 'lib');
const out = process.env.REPORT_FILE || path.join(root, 'sheet-report.txt');
const report = [];
const say = (s = '') => report.push(s);

function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.dart') ? [path.join(dir, e.name)] : [])); }
const rel = (p) => path.relative(lib, p).split(path.sep).join('/');
function numbered(lines, from, to) { return lines.slice(Math.max(from, 0), to).map((l, i) => `${String(Math.max(from, 0) + i + 1).padStart(4)}| ${l}`).join('\n'); }

if (!fs.existsSync(lib)) { console.log('Could not find ' + lib + '. Run this from the project folder (D:\\LEAP-MARKETPLACE).'); process.exit(1); }
const files = walk(lib);
say('SORT & PRICE SHEET REPORT');
const sheets = files.filter((f) => path.basename(f) !== 'app_strings.dart' && fs.readFileSync(f, 'utf8').includes('sort_and_price_title'));      // (app_strings.dart only holds the wording)
say(`files that show the "Sort & price" title: ${sheets.length ? sheets.map(rel).join(', ') : 'NONE FOUND'}`);
const interesting = /\$|minPrice|maxPrice|min_field|max_field|price_range_label|TextField|TextFormField|InputDecoration|prefix|Colors\.|Color\(|color:|Brightness|isDark|palette|LeapPalette|searchProducts|currency|formatPrice/;
for (const f of sheets) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  say(); say('=== ' + rel(f) + ` (${lines.length} lines) ===`); say('--- imports ---'); say(lines.filter((l) => l.startsWith('import')).join('\n'));
  const at = lines.findIndex((l) => l.includes('sort_and_price_title')); say(`--- around the title (line ${at + 1}) ---`); say(numbered(lines, at - 12, at + 70));
  say('--- every line that matters for prices, text fields and colours ---');
  say(lines.map((l, i) => (interesting.test(l) ? `${String(i + 1).padStart(4)}| ${l}` : null)).filter(Boolean).join('\n'));
}
function include(name, filter) {
  const f = files.find((x) => rel(x) === name);
  say(); say(`=== ${name} ===`);
  if (!f) { say('NOT FOUND'); return; }
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  if (lines.length <= 260) { say(numbered(lines, 0, lines.length)); return; }
  say(`(${lines.length} lines: only the useful ones)`); say(lines.map((l, i) => (filter.test(l) ? `${String(i + 1).padStart(4)}| ${l}` : null)).filter(Boolean).join('\n'));
}
include('core/theme.dart', /dark|light|Brightness|LeapPalette|class |static |ink|card|line|muted|signal|chalk|gauge|inputDecorationTheme|fillColor|textTheme/);
include('core/currency_state.dart', /class |get |^\s*(static |Future|void|String|double|bool|Map|List)|formatPrice|convert|rate|symbol|code/);
say();
fs.writeFileSync(out, report.join('\n') + '\n');
console.log('Wrote ' + out + ' (' + report.length + ' lines). Please send me that file.');
if (!sheets.length) console.log('The "Sort & price" title was not found in any file under ' + lib + ': tell me which screen has the sort and price boxes.');
