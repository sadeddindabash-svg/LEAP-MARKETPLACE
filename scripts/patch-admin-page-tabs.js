#!/usr/bin/env node
/**
 * Admin portal redesign, step 8: the tabs and switches INSIDE pages restyled as one segmented control
 * (a grey track; the chosen one a raised white segment with navy text).
 * Categories' tabs, Orders > Refused (Needs you / Working on it / Done automatically / Handled by you), Pricing > Discounts (Discount rules / Rules),
 * Profits and Shipping costs (period), Settings > Legal pages (the six pages), Products (Live / Hidden).
 * The tabs on the navy page header stay as they are. Run AFTER patch-admin-tables. No API change.
 *   node scripts/patch-admin-page-tabs.js            dry run
 *   node scripts/patch-admin-page-tabs.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "Admin: tabs and switches inside pages as a segmented control (Orders > Refused views, Pricing > Discounts)", "done": "patch-admin-page-tabs", "pairs": [["[data-leap-page] tbody td button svg,", "/* tabs and switches inside a page (patch-admin-page-tabs): a grey track, the chosen one a raised white segment */\n[data-leap-page] [data-leap-segments] { display: inline-flex !important; flex-wrap: wrap; align-items: center; gap: 2px !important; padding: 4px !important; background: #EEF1F4 !important; border: 1px solid ${C.line} !important; border-radius: 12px !important; box-shadow: inset 0 1px 2px rgba(11,49,70,0.05) !important; width: fit-content; max-width: 100%; }\n[data-leap-page] [data-leap-segments] > button { display: inline-flex !important; align-items: center; gap: 6px; height: 34px !important; border: none !important; background: transparent !important; padding: 0 16px !important; margin: 0 !important; border-radius: 9px !important; font-family: 'Manrope', sans-serif !important; font-size: 13px !important; font-weight: 700 !important; box-shadow: none !important; cursor: pointer; white-space: nowrap; }\n[data-leap-page] [data-leap-segments] > button:not([aria-selected=\"true\"]):not([aria-pressed=\"true\"]) { color: #5B6472; }\n[data-leap-page] [data-leap-segments] > button:hover:not([aria-selected=\"true\"]):not([aria-pressed=\"true\"]) { background: rgba(255,255,255,0.65) !important; color: ${C.ink}; }\n[data-leap-page] [data-leap-segments] > button[aria-selected=\"true\"], [data-leap-page] [data-leap-segments] > button[aria-pressed=\"true\"] { background: #fff !important; color: ${C.navy} !important; box-shadow: 0 1px 2px rgba(11,49,70,0.14), 0 3px 8px rgba(11,49,70,0.08) !important; }\n[data-leap-page] tbody td button svg,", false], ["          <div style={{ display: \"flex\", gap: 8, marginBottom: 10 }}>\n            {[[\"open\", \"⚠ Needs you\"]", "          <div data-leap-segments=\"\" style={{ display: \"flex\", gap: 8, marginBottom: 12 }}>\n            {[[\"open\", \"⚠ Needs you\"]", false], ["<button key={k} data-testid={`refused-filter-${k}`} onClick={() => setFilter(k)}", "<button key={k} type=\"button\" aria-pressed={filter === k} data-testid={`refused-filter-${k}`} onClick={() => setFilter(k)}", false], ["<div style={{ display: \"flex\", gap: 6, marginTop: 20 }} data-testid=\"discount-tabs\">", "<div data-leap-segments=\"\" style={{ display: \"flex\", gap: 6, marginTop: 20, marginBottom: 4 }} data-testid=\"discount-tabs\">", false], ["    <button type=\"button\" onClick={() => setTab(id)} style={{ ...body, fontSize: 12.5, fontWeight: 700, borderRadius: 999,", "    <button type=\"button\" aria-pressed={tab === id} onClick={() => setTab(id)} style={{ ...body, fontSize: 12.5, fontWeight: 700, borderRadius: 999,", false]]}, {"file": "apps/admin-dashboard/src/components/PageChrome.jsx", "what": "Admin: tabs inside a page (Categories and others) as a segmented control", "done": "data-leap-segments={dark ? undefined : \"\"}", "pairs": [["      ? { position: \"relative\", display: \"flex\", alignItems: \"flex-end\", gap: 4, padding: \"18px 0 0\", background: \"transparent\", borderBottom: \"none\", flexWrap: \"wrap\" }\n      : { display: \"flex\", alignItems: \"flex-end\", gap: 2, padding: \"14px 28px 0\", background: C.card, borderBottom: `1px solid ${C.line}`, flexWrap: \"wrap\" }}>\n      <div ref={listRef} role=\"tablist\" aria-label={label} style={{ display: \"flex\", alignItems: \"flex-end\", gap: 2, flexWrap: \"wrap\", position: \"relative\" }}>", "      ? { position: \"relative\", display: \"flex\", alignItems: \"flex-end\", gap: 4, padding: \"18px 0 0\", background: \"transparent\", borderBottom: \"none\", flexWrap: \"wrap\" }\n      : { display: \"flex\", alignItems: \"center\", gap: 8, padding: \"18px 24px 2px\", background: \"transparent\", borderBottom: \"none\", flexWrap: \"wrap\" }}>\n      <div ref={listRef} role=\"tablist\" aria-label={label} data-leap-segments={dark ? undefined : \"\"} style={{ display: \"flex\", alignItems: \"flex-end\", gap: 2, flexWrap: \"wrap\", position: \"relative\" }}>", false], ["        {mark && (\n          <span aria-hidden=\"true\" data-testid=\"tab-highlight\"", "        {mark && dark && (\n          <span aria-hidden=\"true\" data-testid=\"tab-highlight\"", false], ["marked={Boolean(mark && mark.w)} dark={dark} />)}", "marked={Boolean(dark && mark && mark.w)} dark={dark} />)}", false]]}, {"file": "apps/admin-dashboard/src/ProfitsPanel.jsx", "what": "Admin Profits: the period switch as a segmented control", "done": "aria-label=\"Period\" data-leap-segments=\"\"", "pairs": [["<div role=\"group\" aria-label=\"Period\" style={{", "<div role=\"group\" aria-label=\"Period\" data-leap-segments=\"\" style={{", false]]}, {"file": "apps/admin-dashboard/src/ShippingCostsPanel.jsx", "what": "Admin Shipping costs: the period switch as a segmented control", "done": "aria-label=\"Period\" data-leap-segments=\"\"", "pairs": [["<div role=\"group\" aria-label=\"Period\" style={{", "<div role=\"group\" aria-label=\"Period\" data-leap-segments=\"\" style={{", false]]}, {"file": "apps/admin-dashboard/src/LegalPagesSection.jsx", "what": "Admin Settings > Legal pages: the six pages as a segmented control", "done": "role=\"tablist\" data-leap-segments=\"\"", "pairs": [["<div role=\"tablist\" style={{ display: \"flex\", flexWrap: \"wrap\", gap: 6, marginBottom: 12 }}>", "<div role=\"tablist\" data-leap-segments=\"\" style={{ display: \"flex\", flexWrap: \"wrap\", gap: 6, marginBottom: 14 }}>", false]]}, {"file": "apps/admin-dashboard/src/ProductDeleteDialog.jsx", "what": "Admin Products: Live / Hidden as a segmented control", "done": "aria-label=\"Which products\" data-leap-segments=\"\"", "pairs": [["<div role=\"group\" aria-label=\"Which products\" style={{ display: \"flex\", gap: 8, marginBottom: 12 }}>", "<div role=\"group\" aria-label=\"Which products\" data-leap-segments=\"\" style={{ display: \"flex\", gap: 8, marginBottom: 14 }}>", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-page-tabs`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then refresh the admin portal with Ctrl+F5 (no API restart needed).');
