/**
 * Finds what still makes the server answer "Missing required field(s): position".
 * Reads every .js file of services/api (not node_modules) and prints each line that requires a position. Changes nothing.
 *
 *   node scripts/find-position-check.js
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'services', 'api');
const hits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|cjs|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) {
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const l = line.toLowerCase();
        if (l.includes('position') && (l.includes('missing') || l.includes('required') || /!\s*\w*position\b/.test(l) || l.includes('allowed_positions.includes'))) {
          hits.push(`${path.relative(path.resolve(__dirname, '..'), p)}:${i + 1}:  ${line.trim().slice(0, 160)}`);
        }
      });
    }
  }
};
walk(root);
console.log(hits.length ? hits.join('\n') : 'No line in services/api requires a position.');
console.log('\nFiles changed by patch-position-optional / -2:');
for (const f of ['services/api/src/modules/supplier/productValidation.js', 'services/api/src/modules/supplier/routes.js']) {
  const p = path.resolve(__dirname, '..', f);
  if (!fs.existsSync(p)) { console.log(`  missing   ${f}`); continue; }
  const s = fs.readFileSync(p, 'utf8');
  console.log(`  ${/missing\.push\(['"]position['"]\)/.test(s) ? 'NOT fixed' : 'fixed    '} ${f}  (last changed ${fs.statSync(p).mtime.toLocaleString()})`);
}
