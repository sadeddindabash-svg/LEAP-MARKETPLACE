#!/usr/bin/env node
/**
 * Makes SEATS part of what makes a vehicle version "the same". A 5-seat and a 7-seat "May Day" of the same model, year and engine are two vehicles; until now the vehicle import called the
 * second one a duplicate (a "Problem" row). Together with migration 109 (the database rule), this changes four small places in files that already exist in your project:
 *
 *   1. services/api/src/modules/vehicleImport/rules.js      two rows are "the same version" only if the seats are the same too
 *   2. services/api/src/modules/vehicleImport/plan.js       an existing version is matched by name, engine AND seats
 *   3. services/api/src/modules/vehicleImport/template.js   the text of the template that explains "same version"
 *   4. services/api/src/modules/fitment/routes.js           the message when a version is added or edited by hand and already exists
 *
 *   node scripts/patch-vehicle-seats.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-vehicle-seats.js --write    applies it (each file is saved as <file>.before-vehicle-seats first)
 *
 * It refuses to change a file whose text is not exactly what it expects (so it can never half-apply), and says "already applied" when it was done before.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');

const once = (s, a) => s.split(a).length === 2;
const edits = [
  { file: 'services/api/src/modules/vehicleImport/rules.js', what: 'two rows are the same version only when the seats are the same too',
    done: (s) => s.includes("${nameKey(d.engine.en)}|${d.seats ?? ''}"),
    apply: (s) => {
      const a = "const vkey = `${mkey}|${d.year}|${nameKey(d.version.en)}|${nameKey(d.engine.en)}`;", m = '(same brand, model, year, version name and engine)';
      if (!once(s, a) || !once(s, m)) return null;
      return s.replace(a, "const vkey = `${mkey}|${d.year}|${nameKey(d.version.en)}|${nameKey(d.engine.en)}|${d.seats ?? ''}`;").replace(m, '(same brand, model, year, version name, engine and seats)');
    } },
  { file: 'services/api/src/modules/vehicleImport/plan.js', what: 'an existing version is matched by name, engine and seats',
    done: (s) => s.includes('${nameKey(r.engine)}|${r.seats}'),
    apply: (s) => {
      const a = 'versionsOf.set(year.id, new Map(found.map((r) => [`${nameKey(r.name)}|${nameKey(r.engine)}`, r])));';
      const b = 'existing = versionsOf.get(year.id).get(`${nameKey(d.version.en)}|${nameKey(d.engine.en)}`) || null;';
      if (!once(s, a) || !once(s, b)) return null;
      return s.replace(a, 'versionsOf.set(year.id, new Map(found.map((r) => [`${nameKey(r.name)}|${nameKey(r.engine)}|${r.seats}`, r])));')
        .replace(b, 'existing = versionsOf.get(year.id).get(`${nameKey(d.version.en)}|${nameKey(d.engine.en)}|${d.seats}`) || null;');
    } },
  { file: 'services/api/src/modules/vehicleImport/template.js', what: 'the template text that explains "same version"',
    done: (s) => s.includes('version name, engine and seats are the same version'),
    apply: (s) => { const a = 'version name and engine are the same version'; return once(s, a) ? s.replace(a, 'version name, engine and seats are the same version') : null; } },
  { file: 'services/api/src/modules/fitment/routes.js', what: 'the message when a version that already exists is added or edited by hand',
    done: (s) => s.includes('This version with this engine and number of seats already exists for this year'),
    apply: (s) => {
      const a = "'This version with this engine already exists for this year'";
      if (s.split(a).length < 2) return null;
      return s.split(a).join("'This version with this engine and number of seats already exists for this year'");
    } },
];

let problems = 0;
for (const e of edits) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (e.done(s)) { console.log(`already   ${e.file}: ${e.what} (nothing to do)`); continue; }
  const out = e.apply(s);
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.`); problems++; continue; }
  if (write) { fs.writeFileSync(`${p}.before-vehicle-seats`, s); fs.writeFileSync(p, out); console.log(`patched   ${e.file}: ${e.what}`); }
  else console.log(`would     ${e.file}: ${e.what}`);
}
if (!write && problems === 0) console.log('\nDry run only. Add --write to apply. Then run the migration: cd services\\api && npm run migrate');
process.exit(problems ? 1 : 0);
