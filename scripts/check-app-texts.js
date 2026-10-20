#!/usr/bin/env node
// Finds texts the mobile app ASKS for that app_strings.dart does not HAVE:   node scripts\check-app-texts.js
// (flutter analyze cannot see this: a missing text key only shows at run time, as the raw key instead of a sentence.) It looks at every  tr(context, 'key')  and
// trRead(context, 'key')  in apps\mobile\lib, and every key must have an English and an Arabic text in app_strings.dart. Exit code 0 = nothing missing.
const fs = require('fs');
const path = require('path');
const L = require('./arabic-lib');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out); else if (e.name.endsWith('.dart')) out.push(full);
  }
  return out;
}

function check(root = L.DEFAULT_ROOT) {
  const p = L.paths(root);
  const have = L.readAppStrings(p.appStrings);
  const used = new Map();                                                                 // key -> [file:line]
  const libDir = path.join(root, 'apps', 'mobile', 'lib');
  for (const file of walk(libDir)) {
    if (path.resolve(file) === path.resolve(p.appStrings)) continue;
    const rel = path.relative(root, file).split(path.sep).join('/');
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\btr(?:Read)?\(\s*[\w.]+\s*,\s*['"](\w+)['"]/g)) {
        if (!used.has(m[1])) used.set(m[1], []);
        used.get(m[1]).push(`${rel}:${i + 1}`);
      }
    });
  }
  const missing = [...used.keys()].filter((k) => !have[k]).sort();
  const incomplete = [...used.keys()].filter((k) => have[k] && (!have[k].en.trim() || !have[k].ar.trim())).sort();
  return { used, have, missing: missing.map((k) => ({ key: k, where: used.get(k) })), incomplete };
}

if (require.main === module) {
  const r = check();
  console.log(`The app asks for ${r.used.size} different texts; app_strings.dart has ${Object.keys(r.have).length}.`);
  if (r.missing.length === 0 && r.incomplete.length === 0) { console.log('Nothing is missing: every text the app asks for exists in English and Arabic.'); process.exit(0); }
  for (const m of r.missing) console.log(`  MISSING  ${m.key}   (used at ${m.where.slice(0, 3).join(', ')}${m.where.length > 3 ? ', ...' : ''})`);
  for (const k of r.incomplete) console.log(`  EMPTY    ${k}   (the English or the Arabic text is empty)`);
  console.log('\nA missing text appears in the app as its raw key. If the texts were lost when a file was replaced, they can be restored from your git history or an earlier copy of app_strings.dart.');
  process.exit(1);
}

module.exports = { check };
