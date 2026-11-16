#!/usr/bin/env node
/**
 * Admin portal redesign, step 7: every table restyled (all 26 tables in the admin: orders, suppliers, returns, tickets, reviews, promo codes,
 * payouts, pricing, profits, shipping costs, hubs, vehicle data, categories, imports, settings...).
 * Light header band with small bold capitals, roomier rows, soft stripes, a gold row under the mouse, the chosen row in gold,
 * bold first column, an empty table shows an icon and its message centred, and a wide table scrolls sideways inside its card.
 * Run AFTER patch-admin-header-band. No API change.
 *   node scripts/patch-admin-tables.js            dry run
 *   node scripts/patch-admin-tables.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "Admin: one table style on every page (header band, roomy rows, stripes, gold hover, empty state with an icon)", "done": "patch-admin-tables", "pairs": [["[data-leap-page] ::-webkit-scrollbar-thumb { background: #C9D1DA; border-radius: 999px; border: 2px solid ${C.canvas}; }\n`;", "[data-leap-page] ::-webkit-scrollbar-thumb { background: #C9D1DA; border-radius: 999px; border: 2px solid ${C.canvas}; }\n/* every table (patch-admin-tables): light header band, roomy rows, soft stripes, gold hover, a clear empty state */\n[data-leap-page] table { border-collapse: separate !important; border-spacing: 0 !important; font-family: 'Manrope', sans-serif; }\n[data-leap-page] th { background: #F6F8FA !important; color: #5B6472 !important; font-family: 'Manrope', sans-serif !important; font-size: 11px !important; font-weight: 800 !important; letter-spacing: 0.08em !important; text-transform: uppercase !important; padding: 13px 18px !important; border-bottom: 1px solid ${C.line} !important; white-space: nowrap; vertical-align: middle; }\n[data-leap-page] thead tr:first-child th:first-child { border-top-left-radius: 0; }\n[data-leap-page] tbody td { padding: 15px 18px !important; border-bottom: 1px solid #EEF0F3 !important; vertical-align: middle !important; line-height: 1.45; }\n[data-leap-page] tbody tr:last-child > td { border-bottom: none !important; }\n[data-leap-page] tbody tr:nth-child(even):not([style*=\"background\"]) > td { background: #FBFCFD; }\n[data-leap-page] tbody tr[style*=\"background\"] > td { background: transparent; }\n[data-leap-page] tbody tr:hover > td { background: #FDF6E3 !important; }\n[data-leap-page] tbody tr[aria-selected=\"true\"] > td { background: ${C.goldTint} !important; }\n[data-leap-page] tbody tr > td:first-child { font-weight: 700; }\n[data-leap-page] tbody tr > td:first-child:has(> input[type=checkbox]) { width: 44px; }\n[data-leap-page] tbody td[colspan]:only-child:not(:has(*)) { padding: 48px 18px 44px !important; text-align: center !important; color: ${C.muted} !important; font-size: 13.5px !important; font-weight: 600 !important; background: #fff !important; }\n[data-leap-page] tbody td[colspan]:only-child:not(:has(*))::before { content: \"\"; display: block; width: 44px; height: 44px; margin: 0 auto 12px; border-radius: 12px; background: #F1F4F7 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23636B78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 12h-6l-2 3h-4l-2-3H2'/%3E%3Cpath d='M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'/%3E%3C/svg%3E\") center / 20px no-repeat; }\n[data-leap-page] tbody td[style*=\"text-align: right\"], [data-leap-page] th[style*=\"text-align: right\"] { white-space: nowrap; }\n[data-leap-page] tbody td button svg, [data-leap-page] tbody td a svg { vertical-align: middle; }\n`;", false]]}, {"file": "apps/admin-dashboard/src/components/ui.jsx", "what": "Admin: a wide table scrolls sideways inside its card; order number chips stay on one line", "done": "overflow: \"auto\", boxShadow: SHADOW.card", "pairs": [["borderRadius: 14, overflow: \"hidden\", boxShadow: SHADOW.card, ...style }}>", "borderRadius: 14, overflow: \"auto\", boxShadow: SHADOW.card, ...style }}>", false], ["padding: small ? \"2px 7px\" : \"4px 10px\", borderRadius: 6,", "whiteSpace: \"nowrap\", padding: small ? \"2px 7px\" : \"4px 10px\", borderRadius: 6,", false]]}]};
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
    for (const [re, rep, min] of e.regex || []) { const r = new RegExp(re, 'g'); const n = (out.match(r) || []).length; if (n < min) return { why: `this part was not found: "${re.replace(/\\/g, '').slice(0, 70)}"` }; out = out.replace(r, rep); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-tables`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then refresh the admin portal with Ctrl+F5 (no API restart needed).');
