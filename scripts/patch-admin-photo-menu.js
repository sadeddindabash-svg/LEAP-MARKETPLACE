#!/usr/bin/env node
/**
 * Admin > Products > a product > Photos: the three small icons on each thumbnail are replaced by one "..." button. Clicking it opens a menu with
 * Replace, Download and Delete. The menu closes on a click outside it or Escape. Admin only (no API change).
 * Needs patch-admin-product-redesign first.
 *   node scripts/patch-admin-photo-menu.js            dry run
 *   node scripts/patch-admin-photo-menu.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "product page: which photo's menu is open (closes on a click outside or Escape); product page: the photo menu's item style; product page: each photo has one ... button (Replace, Download, Delete) instead of three icons on it", "done": "  // patch-admin-photo-menu: the \"...\" menu of one photo (its index), or null", "pairs": [["  const [photoIndex, setPhotoIndex] = useState(0);\n", "  const [photoIndex, setPhotoIndex] = useState(0);\n  // patch-admin-photo-menu: the \"...\" menu of one photo (its index), or null\n  const [photoMenu, setPhotoMenu] = useState(null);\n  useEffect(() => {\n    if (photoMenu === null) return undefined;\n    const onDown = (e) => { if (!(e.target.closest && e.target.closest(\"[data-photo-menu]\"))) setPhotoMenu(null); };\n    const onKey = (e) => { if (e.key === \"Escape\") setPhotoMenu(null); };\n    document.addEventListener(\"mousedown\", onDown); document.addEventListener(\"keydown\", onKey);\n    return () => { document.removeEventListener(\"mousedown\", onDown); document.removeEventListener(\"keydown\", onKey); };\n  }, [photoMenu]);\n", false], ["  const photoButton = (bg) =>", "  const photoMenuItem = { ...body, display: \"flex\", alignItems: \"center\", gap: 9, width: \"100%\", boxSizing: \"border-box\", padding: \"8px 10px\", borderRadius: 7, border: \"none\", background: \"none\", fontSize: 13, fontWeight: 700, color: C.ink, cursor: \"pointer\", textAlign: \"left\" };      // patch-admin-photo-menu\n  const photoButton = (bg) =>", false], ["                  {images.map((url, i) => (\n                    <div key={i} style={{ position: \"relative\", width: 84, height: 84 }}>\n                      <button type=\"button\" onClick={() => setPhotoIndex(i)} aria-label={`Show photo ${i + 1}`} style={{ padding: 0, width: \"100%\", height: \"100%\", borderRadius: 10, overflow: \"hidden\", border: `2px solid ${i === shownPhoto ? C.signal : C.line}`, cursor: \"pointer\", background: C.canvas }}>\n                        <img src={imgSrc(url)} alt=\"\" style={{ width: \"100%\", height: \"100%\", objectFit: \"cover\", display: \"block\" }} />\n                      </button>\n                      <label title=\"Replace this photo\" style={{ ...photoButton(C.torque), top: -7, left: -7, cursor: isUploadingPhoto ? \"default\" : \"pointer\" }}>\n                        <RotateCcw size={11} />\n                        <input type=\"file\" accept=\"image/*\" onChange={(e) => handleReplacePhoto(i, e)} disabled={isUploadingPhoto} style={{ display: \"none\" }} />\n                      </label>\n                      <button onClick={() => handleRemovePhoto(i)} title=\"Remove this photo\" style={{ ...photoButton(C.red), top: -7, right: -7 }}>×</button>\n                      <button onClick={() => handleDownloadPhoto(url, i)} title=\"Download this photo\" style={{ ...photoButton(C.navy), bottom: -7, right: -7 }}><Download size={11} /></button>\n                    </div>\n                  ))}\n                </div>\n                <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 10 }}>The first photo is the one buyers see first. Blue = replace, red = remove, navy = download.</div>\n", "                  {images.map((url, i) => (\n                    <div key={i} style={{ position: \"relative\", width: 84, height: 84 }}>\n                      <button type=\"button\" onClick={() => setPhotoIndex(i)} aria-label={`Show photo ${i + 1}`} style={{ padding: 0, width: \"100%\", height: \"100%\", borderRadius: 10, overflow: \"hidden\", border: `2px solid ${i === shownPhoto ? C.signal : C.line}`, cursor: \"pointer\", background: C.canvas }}>\n                        <img src={imgSrc(url)} alt=\"\" style={{ width: \"100%\", height: \"100%\", objectFit: \"cover\", display: \"block\" }} />\n                      </button>\n                      {/* patch-admin-photo-menu: one \"...\" button per photo; its menu has Replace, Download and Delete */}\n                      <button type=\"button\" data-photo-menu=\"\" onClick={() => setPhotoMenu(photoMenu === i ? null : i)} aria-label={`Photo ${i + 1} options`} aria-haspopup=\"menu\" aria-expanded={photoMenu === i} title=\"Options\"\n                        style={{ position: \"absolute\", right: 5, bottom: 5, width: 24, height: 24, borderRadius: 7, border: `1px solid ${C.line}`, background: photoMenu === i ? C.navy : \"rgba(255,255,255,0.95)\", color: photoMenu === i ? \"#fff\" : C.ink, cursor: \"pointer\", display: \"flex\", alignItems: \"center\", justifyContent: \"center\", padding: 0, boxShadow: \"0 1px 3px rgba(0,0,0,0.18)\" }}>\n                        <MoreHorizontal size={15} />\n                      </button>\n                      {photoMenu === i && (\n                        <div role=\"menu\" data-photo-menu=\"\" style={{ position: \"absolute\", top: \"calc(100% + 6px)\", left: 0, zIndex: 30, minWidth: 168, background: \"#fff\", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: \"0 10px 28px rgba(7,32,47,0.18)\", padding: 5 }}>\n                          <label role=\"menuitem\" style={{ ...photoMenuItem, cursor: isUploadingPhoto ? \"default\" : \"pointer\", opacity: isUploadingPhoto ? 0.5 : 1 }}>\n                            <RotateCcw size={14} color={C.torque} /> Replace\n                            <input type=\"file\" accept=\"image/*\" onChange={(e) => { setPhotoMenu(null); handleReplacePhoto(i, e); }} disabled={isUploadingPhoto} style={{ display: \"none\" }} />\n                          </label>\n                          <button type=\"button\" role=\"menuitem\" onClick={() => { setPhotoMenu(null); handleDownloadPhoto(url, i); }} style={photoMenuItem}>\n                            <Download size={14} color={C.navy} /> Download\n                          </button>\n                          <div style={{ height: 1, background: C.line, margin: \"4px 2px\" }} />\n                          <button type=\"button\" role=\"menuitem\" onClick={() => { setPhotoMenu(null); handleRemovePhoto(i); if (photoIndex >= i && photoIndex > 0) setPhotoIndex(photoIndex - 1); }} style={{ ...photoMenuItem, color: C.red }}>\n                            <X size={14} color={C.red} /> Delete\n                          </button>\n                        </div>\n                      )}\n                    </div>\n                  ))}\n                </div>\n                <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 10 }}>The first photo is the one buyers see first. Click ⋯ on a photo to replace, download or delete it.</div>\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-photo-menu`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Refresh the admin with Ctrl+F5 (no API restart needed).");
