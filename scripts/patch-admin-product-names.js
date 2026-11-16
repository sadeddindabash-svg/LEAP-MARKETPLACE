#!/usr/bin/env node
/**
 * Admin > Products > a product > Names & descriptions, redesigned: one card per language (English, Arabic) with its status (Ready / Name too short /
 * No description), a length bar under the name with the minimum marked and "N more characters needed", and a character and word count for the
 * description. When the supplier wrote one, its original Chinese name and description are shown (read only) to check the translation.
 * The API's product detail also sends nameZh and descriptionZh. Needs patch-admin-product-redesign first.
 *   node scripts/patch-admin-product-names.js            dry run
 *   node scripts/patch-admin-product-names.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/catalog/routes.js", "what": "product detail: also send the supplier's original Chinese name and description", "done": "      nameZh: row.name_zh || null, descriptionZh: row.description_zh || null,      // patch-admin-product-names: the supplier's original, read only", "pairs": [["      nameAr: row.name_ar,\n      description: row.description,\n      descriptionAr: row.description_ar,\n      category: row.category,", "      nameAr: row.name_ar,\n      description: row.description,\n      descriptionAr: row.description_ar,\n      nameZh: row.name_zh || null, descriptionZh: row.description_zh || null,      // patch-admin-product-names: the supplier's original, read only\n      category: row.category,", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "product page: Names & descriptions redesigned (a card per language, length bar, status, the supplier's Chinese original)", "done": "          <div style={panel} data-testid=\"names-card\">", "pairs": [["          <div style={panel}>\n            {sectionTitle(\"Names & descriptions\")}\n            <div style={{ display: \"grid\", gridTemplateColumns: \"1fr 1fr\", gap: 14 }}>\n              <div style={{ ...body, fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: \"0.08em\" }}>ENGLISH</div>\n              <div style={{ ...body, fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: \"0.08em\", textAlign: \"right\" }}>العربية</div>\n              {field(\"Name (English)\", <input style={inputStyle} value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={100} />,\n                <span style={{ ...body, fontSize: 10.5, color: nameEn.length < nameMins.en || nameEn.length > 100 ? C.red : C.muted }}>{nameEn.length}/100 (min {nameMins.en})</span>)}\n              {field(\"Name (Arabic)\", <input style={{ ...inputStyle, direction: \"rtl\" }} value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={100} />,\n                <span style={{ ...body, fontSize: 10.5, color: nameAr.length < nameMins.ar || nameAr.length > 100 ? C.red : C.muted }}>{nameAr.length}/100 (min {nameMins.ar})</span>)}\n              {field(\"Description (English)\", <textarea style={{ ...inputStyle, minHeight: 110, resize: \"vertical\" }} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} />)}\n              {field(\"Description (Arabic)\", <textarea style={{ ...inputStyle, minHeight: 110, resize: \"vertical\", direction: \"rtl\" }} value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} />)}\n            </div>\n          </div>\n\n", "          <div style={panel} data-testid=\"names-card\">\n            {/* patch-admin-product-names: one card per language (English, Arabic) with its own status, a length bar for the name (the minimum marked),\n                a counter for the description; and, when the supplier wrote one, its original Chinese text to check the translation against. */}\n            {sectionTitle(\"Names & descriptions\", (() => {\n              const ready = [nameEn, nameAr].every((n, i) => n.trim().length >= (i ? nameMins.ar : nameMins.en));\n              return pill(ready ? \"Both names ready\" : \"A name is too short\", ready ? C.gauge : C.red, ready ? C.gaugeBg : C.redBg);\n            })())}\n            <div style={{ display: \"grid\", gridTemplateColumns: \"1fr 1fr\", gap: 14 }}>\n              {[\n                { code: \"EN\", title: \"English\", name: nameEn, setName: setNameEn, desc: descriptionEn, setDesc: setDescriptionEn, min: nameMins.en, rtl: false },\n                { code: \"AR\", title: \"العربية\", name: nameAr, setName: setNameAr, desc: descriptionAr, setDesc: setDescriptionAr, min: nameMins.ar, rtl: true },\n              ].map((l) => {\n                const len = l.name.trim().length;\n                const short = len < l.min;\n                const descLen = l.desc.trim().length;\n                const words = descLen ? l.desc.trim().split(/\\s+/).length : 0;\n                const status = short ? { t: len === 0 ? \"No name\" : \"Name too short\", c: C.red, bg: C.redBg } : descLen === 0 ? { t: \"No description\", c: C.amber, bg: C.amberBg } : { t: \"Ready\", c: C.gauge, bg: C.gaugeBg };\n                return (\n                  <div key={l.code} data-testid={`names-${l.code.toLowerCase()}`} style={{ border: `1px solid ${short ? \"#EBC2BD\" : C.line}`, borderRadius: 12, overflow: \"hidden\", background: \"#fff\", minWidth: 0 }}>\n                    <div style={{ display: \"flex\", alignItems: \"center\", gap: 8, padding: \"9px 12px\", background: C.surfaceHigh, borderBottom: `1px solid ${C.line}` }}>\n                      <span style={{ ...mono, fontSize: 10.5, fontWeight: 800, color: \"#fff\", background: C.navy, borderRadius: 5, padding: \"2px 6px\" }}>{l.code}</span>\n                      <span style={{ ...body, fontSize: 13, fontWeight: 800, color: C.ink }}>{l.title}</span>\n                      <span style={{ marginLeft: \"auto\" }}>{pill(status.t, status.c, status.bg)}</span>\n                    </div>\n                    <div style={{ padding: 12, display: \"flex\", flexDirection: \"column\", gap: 12 }}>\n                      <div>\n                        <label style={labelStyle}>Product name</label>\n                        <input aria-label={`Name (${l.code === \"EN\" ? \"English\" : \"Arabic\"})`} dir={l.rtl ? \"rtl\" : \"ltr\"} style={{ ...inputStyle, fontSize: 14, fontWeight: 700 }} value={l.name} onChange={(e) => l.setName(e.target.value)} maxLength={100} />\n                        <div style={{ position: \"relative\", height: 4, borderRadius: 2, background: \"#E8EBEF\", marginTop: 7 }}>\n                          <div style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: 0, top: 0, bottom: 0, width: `${Math.min(100, l.name.length)}%`, borderRadius: 2, background: short ? C.red : l.name.length > 90 ? C.amber : C.gauge }} />\n                          <div title={`Minimum ${l.min}`} style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: `${Math.min(100, l.min)}%`, top: -3, width: 2, height: 10, background: C.ink, opacity: 0.45, borderRadius: 1 }} />\n                        </div>\n                        <div style={{ ...body, display: \"flex\", justifyContent: \"space-between\", fontSize: 10.5, marginTop: 4, color: short ? C.red : C.muted }}>\n                          <span>{short ? `${l.min - len} more ${l.min - len === 1 ? \"character\" : \"characters\"} needed` : \"Long enough\"}</span>\n                          <span style={mono}>{l.name.length}/100 · min {l.min}</span>\n                        </div>\n                      </div>\n                      <div>\n                        <label style={labelStyle}>Description</label>\n                        <textarea aria-label={`Description (${l.code === \"EN\" ? \"English\" : \"Arabic\"})`} dir={l.rtl ? \"rtl\" : \"ltr\"} style={{ ...inputStyle, minHeight: 130, resize: \"vertical\", lineHeight: 1.5 }} value={l.desc} onChange={(e) => l.setDesc(e.target.value)} placeholder={l.rtl ? \"وصف القطعة للمشتري…\" : \"What the buyer should know about this part…\"} />\n                        <div style={{ ...body, display: \"flex\", justifyContent: \"flex-end\", fontSize: 10.5, color: C.muted, marginTop: 4 }}>\n                          <span style={mono}>{descLen} characters · {words} {words === 1 ? \"word\" : \"words\"}</span>\n                        </div>\n                      </div>\n                    </div>\n                  </div>\n                );\n              })}\n            </div>\n            {(product.nameZh || product.descriptionZh) && (\n              <details style={{ marginTop: 12, border: `1px dashed ${C.lineStrong}`, borderRadius: 10, padding: \"8px 12px\", background: C.surfaceHigh }}>\n                <summary style={{ ...body, fontSize: 12.5, fontWeight: 800, color: C.ink, cursor: \"pointer\" }}>\n                  <span style={{ ...mono, fontSize: 10.5, fontWeight: 800, color: C.navy, border: `1px solid ${C.navy}`, borderRadius: 5, padding: \"1px 5px\", marginRight: 6 }}>ZH</span>\n                  The supplier's original (Chinese) — to check the translation\n                </summary>\n                {product.nameZh && <div style={{ ...body, fontSize: 13.5, fontWeight: 700, color: C.ink, marginTop: 8 }}>{product.nameZh}</div>}\n                {product.descriptionZh && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 4, whiteSpace: \"pre-wrap\", lineHeight: 1.5 }}>{product.descriptionZh}</div>}\n              </details>\n            )}\n          </div>\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-product-names`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then restart the API: cd services\\api ; npm run dev   (one API window, no migration). Refresh the admin with Ctrl+F5.");
