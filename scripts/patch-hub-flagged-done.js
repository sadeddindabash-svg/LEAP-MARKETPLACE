#!/usr/bin/env node
/**
 * Hub portal: a flagged parcel leaves the hub's Flagged list once the hub has sent it back to the supplier or thrown it away.
 * It stays under "All" as "Done by the hub - waiting for Leap" until Leap finishes the case (refund marked, or the replacement delivered).
 * The admin's Flagged shipments page is unchanged: the case stays there until it is finished.
 *   node scripts/patch-hub-flagged-done.js            dry run
 *   node scripts/patch-hub-flagged-done.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/hub-portal/src/HubWorkspace.jsx", "what": "hub menu: Flagged counts only parcels still at the hub; hub board: the same", "done": "    flagged: list.filter((s) => s.status === \"flagged\" && !s.resolvedAt).length,      // returned / thrown away = the hub's part is done (patch-hub-flagged-done)", "pairs": [["    flagged: list.filter((s) => FLAGGED.includes(s.status) && !s.resolvedAt).length,", "    flagged: list.filter((s) => s.status === \"flagged\" && !s.resolvedAt).length,      // returned / thrown away = the hub's part is done (patch-hub-flagged-done)", false], ["  const flagged = list.filter((s) => FLAGGED.includes(s.status) && !s.resolvedAt);", "  const flagged = list.filter((s) => s.status === \"flagged\" && !s.resolvedAt);", false]]}, {"file": "apps/hub-portal/src/App.jsx", "what": "hub Flagged filter: only parcels still at the hub; hub Flagged list: the same; hub: a parcel the hub sent back or threw away, while Leap finishes the case; hub: its colour; hub: its words (Chinese); hub: its words (English)", "done": "id === \"flagged\" ? s.status === \"flagged\" && !s.resolvedAt : s.status === id);      // sent back / thrown away: under \"All\" (patch-hub-flagged-done)", "pairs": [["id === \"flagged\" ? FLAGGED_STATUSES.includes(s.status) && !s.resolvedAt : s.status === id);", "id === \"flagged\" ? s.status === \"flagged\" && !s.resolvedAt : s.status === id);      // sent back / thrown away: under \"All\" (patch-hub-flagged-done)", false], ["    else if (filter === \"flagged\") { if (!FLAGGED_STATUSES.includes(s.status) || s.resolvedAt) return false; }", "    else if (filter === \"flagged\") { if (s.status !== \"flagged\" || s.resolvedAt) return false; }", false], ["const displayStatusOf = (shipment) => (shipment.status === \"flagged\" && shipment.resolvedAt ? \"closed\" : shipment.status);", "const displayStatusOf = (shipment) => (shipment.status === \"flagged\" && shipment.resolvedAt ? \"closed\"\n  : [\"returned_to_supplier\", \"discarded_at_hub\"].includes(shipment.status) && !shipment.resolvedAt ? \"waiting_leap\" : shipment.status);      // patch-hub-flagged-done", false], ["  flagged: [C.red, C.redBg], returned_to_supplier: [C.red, C.redBg], discarded_at_hub: [C.red, C.redBg],", "  flagged: [C.red, C.redBg], returned_to_supplier: [C.red, C.redBg], discarded_at_hub: [C.red, C.redBg], waiting_leap: [C.amber, C.amberBg],", false], ["      closed: { label: \"已关闭\" },", "      closed: { label: \"已关闭\" },\n      waiting_leap: { label: \"质检中心已完成 · 等待平台\" },", false], ["      closed: { label: \"Closed\" },", "      closed: { label: \"Closed\" },\n      waiting_leap: { label: \"Done by the hub · waiting for Leap\" },", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-hub-flagged-done`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Refresh the hub portal with Ctrl+F5 (no API restart needed).");
