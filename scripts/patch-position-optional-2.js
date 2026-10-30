/**
 * Position is not required any more: removes the "Missing required field(s): position" check from the server,
 * whatever the version of the file. Looks in every productValidation.js and the supplier/catalog routes of services/api.
 *
 *   node scripts/patch-position-optional-2.js            dry run (shows what it would change)
 *   node scripts/patch-position-optional-2.js --write    applies it (each file is saved as <file>.before-position-optional-2 first)
 */
const fs = require('fs');
const path = require('path');
const WRITE = process.argv.includes('--write');
const root = path.resolve(__dirname, '..');
const files = [
  'services/api/src/modules/supplier/productValidation.js',
  'services/api/src/modules/shared/productValidation.js',
  'services/api/src/modules/supplier/routes.js',
  'services/api/src/modules/catalog/routes.js',
];
const rules = [
  // the "missing" list: position is not required
  { re: /^[ \t]*if \(!position\) missing\.push\((['"])position\1\);[ \t]*\r?\n/gm, to: '', what: "position no longer in the required fields" },
  { re: /^[ \t]*if \(!row\.position\) missing\.push\((['"])position\1\);[ \t]*(\r?\n)/gm, to: (m, q, nl) => m.match(/^[ \t]*/)[0] + '// position: not required any more' + nl, what: 'drafts: position no longer listed as missing' },
  // the allowed-values check: only when a position is given
  { re: /if \(!ALLOWED_POSITIONS\.includes\(position\)\)/g, to: 'if (position && !ALLOWED_POSITIONS.includes(position))', what: 'position checked only when one is given' },
];
let changed = 0;
for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  const did = [];
  for (const r of rules) {
    const n = (s.match(r.re) || []).length;
    if (n > 0) { s = s.replace(r.re, r.to); did.push(`${r.what} (${n})`); }
  }
  if (s === before) { console.log(`ok        ${rel}: nothing requires position`); continue; }
  changed++;
  console.log(`${WRITE ? 'changed' : 'would'}   ${rel}: ${did.join('; ')}`);
  if (WRITE) {
    const backup = file + '.before-position-optional-2';
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, before);
    fs.writeFileSync(file, s);
  }
}
// what is still left that mentions a required position (to send to Claude if the message still shows)
for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const s = WRITE ? fs.readFileSync(file, 'utf8') : '';
  if (WRITE) s.split(/\r?\n/).forEach((line, i) => { if (/missing\.push\(['"]position['"]\)/.test(line)) console.log(`still     ${rel}:${i + 1}: ${line.trim()}`); });
}
if (!WRITE) console.log(changed ? '\nDry run only. Add --write to apply.' : '\nNothing to change.');
else console.log('\nDone. Restart the API (close the start-all window and run start-all again), then submit the draft again.');
