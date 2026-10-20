// Shared by make-arabic-review.js and apply-arabic-review.js: reads the Arabic texts of the website, the server messages (website and app) and the app,
// and changes ONE Arabic text in a file without touching anything else in it.
const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');

function paths(root = DEFAULT_ROOT) {
  return {
    i18n: path.join(root, 'apps', 'web-storefront', 'lib', 'i18n.ts'),
    serverTs: path.join(root, 'apps', 'web-storefront', 'lib', 'serverMessages.ts'),
    serverDart: path.join(root, 'apps', 'mobile', 'lib', 'core', 'server_messages.dart'),
    appStrings: path.join(root, 'apps', 'mobile', 'lib', 'core', 'app_strings.dart'),
    webSource: path.join(root, 'apps', 'web-storefront'),
    baseline: path.join(root, 'docs', 'arabic-review-baseline.json'),
  };
}

/** exceljs comes from the backend's packages (npm install exceljs in services\api), or from wherever it can be found. */
function loadExcel(root = DEFAULT_ROOT) {
  const tries = [path.join(root, 'services', 'api', 'node_modules', 'exceljs'), path.join(root, 'apps', 'admin-dashboard', 'node_modules', 'exceljs'), 'exceljs'];
  for (const t of tries) { try { return require(t); } catch { /* try the next */ } }
  throw new Error('exceljs is not installed. In services\\api run:  npm install exceljs jszip');
}

const read = (file) => fs.readFileSync(file, 'utf8');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The {placeholders} of a text, sorted and unique: they must be the same in the English and the Arabic text. */
const placeholders = (text) => [...new Set((String(text).match(/\{(\w+)\}/g) || []))].sort();
const hasArabicLetters = (text) => /[\u0600-\u06FF]/.test(text);

// ------------------------------------------------------------------------------------------------ the website dictionary (lib/i18n.ts)
function objectBetween(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) throw new Error(`"${startMarker}" was not found in i18n.ts`);
  const b = src.indexOf(endMarker, a);
  if (b < 0) throw new Error(`"${endMarker}" was not found in i18n.ts`);
  // the text between the markers is a plain object of string texts: evaluate it as one (no outside names are used in it)
  return new Function(`return (${src.slice(a + startMarker.length - 1, b + 1)});`)();
}
const AR_START = 'const AR: Record<DictKey, string> = {';
function readDictionaries(file) {
  const src = read(file);
  return { EN: objectBetween(src, 'const EN = {', '} as const;'), AR: objectBetween(src, AR_START, '};') };
}
/** Replaces the Arabic text of ONE key of the website dictionary. Returns the new file text, or throws when the key cannot be found on a single line. */
function replaceDictionaryArabic(src, key, text) {
  if (!/^\w+$/.test(key)) throw new Error(`"${key}" is not a valid key`);
  const start = src.indexOf(AR_START);
  if (start < 0) throw new Error('the Arabic block was not found in i18n.ts');
  const block = src.slice(start);
  const re = new RegExp(`^(\\s*)${key}:\\s*"(?:[^"\\\\]|\\\\.)*",[ \\t]*$`, 'm');
  const all = block.match(new RegExp(re.source, 'gm')) || [];
  if (all.length !== 1) throw new Error(all.length === 0 ? `the key "${key}" was not found on a single line of the Arabic block` : `the key "${key}" appears ${all.length} times in the Arabic block`);
  return src.slice(0, start) + block.replace(re, (_m, indent) => `${indent}${key}: ${JSON.stringify(text)},`);
}

// ------------------------------------------------------------------------------------------------ server messages
// website (lib/serverMessages.ts):   "English text": "Arabic text",
function readServerMessagesTs(file) {
  const src = read(file);
  const start = src.indexOf('SERVER_MESSAGES_AR');
  const end = src.indexOf('\n};', start);
  const out = [];
  for (const line of src.slice(start, end).split('\n')) {
    const m = line.match(/^\s*("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*"),?\s*$/);
    if (m) out.push({ en: JSON.parse(m[1]), ar: JSON.parse(m[2]) });
  }
  return out;
}
function replaceServerArabicTs(src, english, text) {
  const key = JSON.stringify(english);
  const re = new RegExp(`^(\\s*${escapeRe(key)}:\\s*)"(?:[^"\\\\]|\\\\.)*"(,?[ \\t]*)$`, 'gm');
  const found = src.match(re) || [];
  if (found.length !== 1) throw new Error(found.length === 0 ? `the message "${english}" was not found in serverMessages.ts` : `the message "${english}" appears ${found.length} times in serverMessages.ts`);
  return src.replace(re, (_m, head, tail) => `${head}${JSON.stringify(text)}${tail}`);
}

// app (lib/core/server_messages.dart):   'English text': 'Arabic text',   (a text with an apostrophe may use "..." instead)
const DART_LITERAL = `'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"`;
function parseDartString(literal) {
  const body = literal.slice(1, -1);
  return body.replace(/\\(.)/g, (_m, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}
/** A Dart single-quoted string literal for any text (the apostrophe, the backslash and the dollar sign are escaped). */
function dartQuote(text) {
  return `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
}
function replaceServerArabicDart(src, english, text) {
  const re = new RegExp(`^(\\s*)(${DART_LITERAL}):\\s*(${DART_LITERAL})(,?[ \\t]*)$`, 'gm');
  let count = 0;
  const out = src.replace(re, (whole, indent, keyLiteral, _value, tail) => {
    if (parseDartString(keyLiteral) !== english) return whole;
    count++;
    return `${indent}${keyLiteral}: ${dartQuote(text)}${tail}`;
  });
  if (count !== 1) throw new Error(count === 0 ? `the message "${english}" was not found in server_messages.dart` : `the message "${english}" appears ${count} times in server_messages.dart`);
  return out;
}

// ------------------------------------------------------------------------------------------------ the app's own texts (lib/core/app_strings.dart):   'key': {'en': '...', 'ar': '...'},
function readAppStrings(file) {
  const src = read(file);
  const re = new RegExp(`^\\s*'(\\w+)':\\s*\\{'en':\\s*(${DART_LITERAL}),\\s*'ar':\\s*(${DART_LITERAL})\\s*\\}`, 'gm');
  const out = {};
  let m;
  while ((m = re.exec(src))) out[m[1]] = { en: parseDartString(m[2]), ar: parseDartString(m[3]) };
  return out;
}
function replaceAppStringArabic(src, key, text) {
  if (!/^\w+$/.test(key)) throw new Error(`"${key}" is not a valid key`);
  const re = new RegExp(`^(\\s*'${key}':\\s*\\{'en':\\s*(?:${DART_LITERAL}),\\s*'ar':\\s*)(?:${DART_LITERAL})(\\s*\\}.*)$`, 'gm');
  const found = src.match(re) || [];
  if (found.length !== 1) throw new Error(found.length === 0 ? `the app text "${key}" was not found in app_strings.dart` : `the app text "${key}" appears ${found.length} times in app_strings.dart`);
  return src.replace(re, (_m, head, tail) => `${head}${dartQuote(text)}${tail}`);
}

// ------------------------------------------------------------------------------------------------ where the website uses each text
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files); else files.push(full);
  }
  return files;
}
function screenName(rel) {
  const page = rel.match(/^app\/(.+)\/page\.tsx$/);
  if (page) return `Page /${page[1]}`;
  if (rel === 'app/page.tsx') return 'Home page';
  if (rel.startsWith('components/')) return `Component ${path.basename(rel).replace(/\.\w+$/, '')}`;
  return path.basename(rel);
}
/** key -> a short description of where the website uses it (found by looking for the key in the source files). */
function usageMap(webSource, keys) {
  const wanted = new Set(keys);
  const used = new Map();
  for (const base of ['app', 'components', 'lib']) {
    const dir = path.join(webSource, base);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(file) || /\.test\.|integration/.test(file) || path.basename(file) === 'i18n.ts') continue;
      const text = read(file);
      const rel = path.relative(webSource, file).split(path.sep).join('/');
      for (const m of text.matchAll(/["'`]([a-z][a-z0-9_]+)["'`]/g)) {
        if (!wanted.has(m[1])) continue;
        if (!used.has(m[1])) used.set(m[1], new Set());
        used.get(m[1]).add(screenName(rel));
      }
    }
  }
  const out = {};
  for (const key of keys) out[key] = used.has(key) ? [...used.get(key)].sort().join('; ').slice(0, 140) : '(not found in the code: may be built dynamically)';
  return out;
}

module.exports = {
  DEFAULT_ROOT, paths, loadExcel, read, escapeRe, placeholders, hasArabicLetters,
  readDictionaries, replaceDictionaryArabic, readServerMessagesTs, replaceServerArabicTs, replaceServerArabicDart, parseDartString, dartQuote,
  readAppStrings, replaceAppStringArabic, usageMap,
};
