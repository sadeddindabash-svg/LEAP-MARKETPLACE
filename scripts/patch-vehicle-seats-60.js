#!/usr/bin/env node
/**
 * Vehicle data: a version may have up to 60 SEATS (was 12) and a version NAME up to 200 characters (was 120), in English, Arabic and Chinese.
 * The JMC import was refused for 18 rows: Fushun / Teshun buses with 15 and 17 seats, and Teshun "Space King" versions whose Arabic name is over 120.
 * Server (the shared rules, the Excel import and its template, migration 142 for the database check) and the admin portal's version form; its tests too.
 *
 *   node scripts/patch-vehicle-seats-60.js            dry run
 *   node scripts/patch-vehicle-seats-60.js --write    applies it (each changed file is saved as <file>.before-patch-vehicle-seats-60 first)
 * Then: API: cd services\\api ; npm run migrate ; npm run dev · admin portal: Ctrl+F5, then check and import the file again
 *
 * A file that is not as this patch expects is NOT changed. Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const DATA = {"created": [{"file": "services/api/db/migrations/142_vehicle_versions_seats_60.sql", "what": "migration 142: a version may have 1 to 60 seats", "text": "-- Migration 142: a vehicle version may have up to 60 seats (it was 12). Buses and minibuses (JMC Fushun / Teshun: 15 and 17 seats) were refused by the import.\n-- The old check is found by what it says (its name may differ), dropped, and replaced. Every existing row (1 to 12) still satisfies the new one. Safe to run again.\nDO $$\nDECLARE c record;\nBEGIN\n  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'vehicle_versions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%seats%' LOOP\n    EXECUTE format('ALTER TABLE vehicle_versions DROP CONSTRAINT %I', c.conname);\n  END LOOP;\nEND $$;\nALTER TABLE vehicle_versions ADD CONSTRAINT vehicle_versions_seats_check CHECK (seats BETWEEN 1 AND 60);\n"}], "anchored": [{"file": "services/api/src/modules/fitment/vehicleRules.js", "what": "server: a version may have up to 60 seats (buses, minibuses) and a name up to 200 characters", "done": "const MAX_SEATS = 60;", "pairs": [["const MAX_NAME_LENGTH = 120;", "const MAX_NAME_LENGTH = 200;            // a version name (long van / truck names, in Arabic too)", false], ["const MAX_SEATS = 12;", "const MAX_SEATS = 60;                   // buses and minibuses have 15, 17, 30... seats", false], ["refuses 5.5, 0, 13, \"five\". */", "refuses 5.5, 0, 61, \"five\". */", false]]}, {"file": "services/api/src/modules/vehicleImport/rules.js", "what": "server, vehicle import: the seats message names the real limit", "done": "is not a whole number from ${MIN_SEATS} to ${MAX_SEATS}", "pairs": [["const { cleanLine, nameKey, parseYear, parseSeats, MAX_NAME_LENGTH } = require('../fitment/vehicleRules');", "const { cleanLine, nameKey, parseYear, parseSeats, MAX_NAME_LENGTH, MIN_SEATS, MAX_SEATS } = require('../fitment/vehicleRules');", false], ["is not a whole number from 1 to 12`", "is not a whole number from ${MIN_SEATS} to ${MAX_SEATS}`", false]]}, {"file": "services/api/src/modules/vehicleImport/columns.js", "what": "server, vehicle import: a version name may be up to 200 characters", "done": "{ key: 'version', label: 'Version', max: 200,", "pairs": [["{ key: 'version', label: 'Version', max: 120,", "{ key: 'version', label: 'Version', max: 200,", false]]}, {"file": "services/api/src/modules/vehicleImport/template.js", "what": "server, vehicle import: the template's help says 1 to 60 seats", "done": "Seats: a whole number from 1 to 60.", "pairs": [["Seats: a whole number from 1 to 12.", "Seats: a whole number from 1 to 60.", false]]}, {"file": "apps/admin-dashboard/src/VersionsPanel.jsx", "what": "admin, add / edit a version by hand: up to 60 seats", "done": "Seats must be a whole number from 1 to 60.", "pairs": [["Number(values.seats) > 12) { setProblem(\"Seats must be a whole number from 1 to 12.\"); return; }", "Number(values.seats) > 60) { setProblem(\"Seats must be a whole number from 1 to 60.\"); return; }", false], ["seats are\n// a number from 1 to 12,", "seats are\n// a number from 1 to 60,", false]]}, {"file": "apps/admin-dashboard/src/vehicleRules.test.js", "what": "test: seats 1 to 60, a version name up to 200", "done": "seats are a whole number from 1 to 60", "pairs": [["seats are a whole number from 1 to 12: text digits and Arabic digits are fine, 0, 13, 5.5 and words are not", "seats are a whole number from 1 to 60: text digits and Arabic digits are fine, 0, 61, 5.5 and words are not", false], ["for (const ok of [1, 5, 12, '5', ' 6 ', '٥'])", "for (const ok of [1, 5, 12, 15, 17, 60, '5', ' 6 ', '٥'])", false], ["for (const bad of [0, 13, 5.5, '5.5', 'five', '', null, undefined, -1, '1e1'])", "for (const bad of [0, 61, 100, 5.5, '5.5', 'five', '', null, undefined, -1, '1e1'])", false], ["rules.validateVersionFields({ ...good, seats: 13 }).field", "rules.validateVersionFields({ ...good, seats: 61 }).field", false], ["rules.validateVersionFields({ ...good, name: 'x'.repeat(121) }).field", "rules.validateVersionFields({ ...good, name: 'x'.repeat(201) }).field", false]], "optional": true}, {"file": "apps/admin-dashboard/src/vehicleImportRules.test.js", "what": "test: the import refuses 61 seats and a 201-character version name", "done": "[0, 61, 'five', 5.5]", "pairs": [["for (const bad of [0, 13, 'five', 5.5]) { const { items } = await check([row({ seats: bad })]);", "for (const bad of [0, 61, 'five', 5.5]) { const { items } = await check([row({ seats: bad })]);", false], ["row({ version: 'x'.repeat(121) })", "row({ version: 'x'.repeat(201) })", false], ["toMatch(/Version \\(English\\) is longer than 120/)", "toMatch(/Version \\(English\\) is longer than 200/)", false]], "optional": true}, {"file": "apps/admin-dashboard/src/VersionsPanel.test.jsx", "what": "test: the form refuses 61 seats", "done": "Seats must be a whole number from 1 to 60.", "pairs": [["expect(await screen.findByText('Seats must be a whole number from 1 to 12.')).toBeInTheDocument();", "expect(await screen.findByText('Seats must be a whole number from 1 to 60.')).toBeInTheDocument();", false], ["for (const bad of ['0', '13', 'five', '5.5']) { fillForm({ ...FULL, seats: bad }); fireEvent.click(addButton()); expect(screen.getByText('Seats must be a whole number from 1 to 12.')).toBeInTheDocument(); }", "for (const bad of ['0', '61', 'five', '5.5']) { fillForm({ ...FULL, seats: bad }); fireEvent.click(addButton()); expect(screen.getByText('Seats must be a whole number from 1 to 60.')).toBeInTheDocument(); }", false]], "optional": true}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-vehicle-seats-60`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then:\n  API:   cd services\\api ; npm run migrate ; npm run dev   (migration 142)\n  admin: reload the admin portal (Ctrl+F5), then check and import the Excel file again');
