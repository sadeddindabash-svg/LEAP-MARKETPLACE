#!/usr/bin/env node
/**
 * Storefront home page: "Countries" shows 146 (set in services/api/src/modules/siteStats/stats.js, SHOWN_COUNTRIES), instead of the
 * launch markets counted from config/markets.js (39). The launch markets list itself is not changed.
 *
 *   node scripts/patch-countries-146.js            dry run
 *   node scripts/patch-countries-146.js --write    applies it (stats.js is saved as stats.js.before-countries-146 first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"services/api/src/modules/siteStats/stats.js","what":"the home page shows 146 countries","done":"const SHOWN_COUNTRIES = 146;","pairs":[["  const countries = LAUNCH_MARKETS.filter((m) => !COMPLIANCE_HOLD_COUNTRY_CODES.has(m.countryCode)).length;","  // The countries number on the storefront's home page: set by Leap (146), not counted from the launch markets list.\n  const countries = SHOWN_COUNTRIES;"],["const count = async (q, sql) => Number((await q.query(sql)).rows[0].n);","const count = async (q, sql) => Number((await q.query(sql)).rows[0].n);\n// What the home page shows for \"Countries\" (change this number to change it).\nconst SHOWN_COUNTRIES = 146;"]]}],"created":[]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-countries-146`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Restart the API (scripts\\start-all.cmd); the website shows it within a minute (Ctrl+F5).');
