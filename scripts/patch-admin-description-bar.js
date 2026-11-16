#!/usr/bin/env node
/**
 * Admin > Products > a product > Names & descriptions: the descriptions get the same length bar as the names. A description must be 100 to 150
 * characters (the API's own limits): the bar marks the minimum, says "N more characters needed" or "N characters left", and turns amber near the
 * limit. The language card says "Description too short / too long", and the section badge counts the descriptions too. Admin only (no API change).
 * Needs patch-admin-product-names first.
 *   node scripts/patch-admin-description-bar.js            dry run
 *   node scripts/patch-admin-description-bar.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/admin-dashboard/src/App.jsx", "what": "Names & descriptions: one length bar for names and descriptions (the minimum marked, how many are needed or left); Names & descriptions: the name uses the shared bar; Names & descriptions: the description gets the same bar (100 to 150 characters); Names & descriptions: the description limits; Names ", "done": "                // patch-admin-description-bar: a description must be 100 to 150 characters (the API refuses a changed one outside that)", "pairs": [["                const descLen = l.desc.trim().length;\n                const words = descLen ? l.desc.trim().split(/\\s+/).length : 0;\n                const status = short ? { t: len === 0 ? \"No name\" : \"Name too short\", c: C.red, bg: C.redBg } : descLen === 0 ? { t: \"No description\", c: C.amber, bg: C.amberBg } : { t: \"Ready\", c: C.gauge, bg: C.gaugeBg };", "                const descLen = l.desc.trim().length;\n                const words = descLen ? l.desc.trim().split(/\\s+/).length : 0;\n                // patch-admin-description-bar: a description must be 100 to 150 characters (the API refuses a changed one outside that)\n                const descShort = descLen > 0 && descLen < DESC_MIN; const descLong = descLen > DESC_MAX;\n                const status = short ? { t: len === 0 ? \"No name\" : \"Name too short\", c: C.red, bg: C.redBg }\n                  : descLen === 0 ? { t: \"No description\", c: C.amber, bg: C.amberBg }\n                  : descShort ? { t: \"Description too short\", c: C.red, bg: C.redBg }\n                  : descLong ? { t: \"Description too long\", c: C.red, bg: C.redBg }\n                  : { t: \"Ready\", c: C.gauge, bg: C.gaugeBg };\n                // the bar: fills up to the limit, a mark at the minimum; red until the minimum, green after it, amber in the last 10%\n                const lengthBar = (n, min, max, extra = null) => {\n                  const under = n < min; const over = n > max;\n                  const left = max - n;\n                  return (\n                    <>\n                      <div style={{ position: \"relative\", height: 5, borderRadius: 3, background: \"#E8EBEF\", marginTop: 7 }}>\n                        <div style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: 0, top: 0, bottom: 0, width: `${Math.min(100, (n / max) * 100)}%`, borderRadius: 3, background: under || over ? C.red : left <= max * 0.1 ? C.amber : C.gauge, transition: \"width 0.15s\" }} />\n                        <div title={`Minimum ${min}`} style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: `${(min / max) * 100}%`, top: -3, width: 2, height: 11, background: C.ink, opacity: 0.45, borderRadius: 1 }} />\n                      </div>\n                      <div style={{ ...body, display: \"flex\", justifyContent: \"space-between\", gap: 8, fontSize: 10.5, marginTop: 4, color: under || over ? C.red : C.muted }}>\n                        <span style={{ fontWeight: 700, color: under || over ? C.red : left <= max * 0.1 ? C.amberInk : C.gaugeInk }}>\n                          {under ? `${min - n} more ${min - n === 1 ? \"character\" : \"characters\"} needed` : over ? `${n - max} too many` : `${left} ${left === 1 ? \"character\" : \"characters\"} left`}\n                        </span>\n                        <span style={mono}>{n}/{max} · min {min}{extra}</span>\n                      </div>\n                    </>\n                  );\n                };", false], ["                        <div style={{ position: \"relative\", height: 4, borderRadius: 2, background: \"#E8EBEF\", marginTop: 7 }}>\n                          <div style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: 0, top: 0, bottom: 0, width: `${Math.min(100, l.name.length)}%`, borderRadius: 2, background: short ? C.red : l.name.length > 90 ? C.amber : C.gauge }} />\n                          <div title={`Minimum ${l.min}`} style={{ position: \"absolute\", [l.rtl ? \"right\" : \"left\"]: `${Math.min(100, l.min)}%`, top: -3, width: 2, height: 10, background: C.ink, opacity: 0.45, borderRadius: 1 }} />\n                        </div>\n                        <div style={{ ...body, display: \"flex\", justifyContent: \"space-between\", fontSize: 10.5, marginTop: 4, color: short ? C.red : C.muted }}>\n                          <span>{short ? `${l.min - len} more ${l.min - len === 1 ? \"character\" : \"characters\"} needed` : \"Long enough\"}</span>\n                          <span style={mono}>{l.name.length}/100 · min {l.min}</span>\n                        </div>", "                        {lengthBar(len, l.min, 100)}", false], ["                        <textarea aria-label={`Description (${l.code === \"EN\" ? \"English\" : \"Arabic\"})`} dir={l.rtl ? \"rtl\" : \"ltr\"} style={{ ...inputStyle, minHeight: 130, resize: \"vertical\", lineHeight: 1.5 }} value={l.desc} onChange={(e) => l.setDesc(e.target.value)} placeholder={l.rtl ? \"وصف القطعة للمشتري…\" : \"What the buyer should know about this part…\"} />\n                        <div style={{ ...body, display: \"flex\", justifyContent: \"flex-end\", fontSize: 10.5, color: C.muted, marginTop: 4 }}>\n                          <span style={mono}>{descLen} characters · {words} {words === 1 ? \"word\" : \"words\"}</span>\n                        </div>", "                        <textarea aria-label={`Description (${l.code === \"EN\" ? \"English\" : \"Arabic\"})`} dir={l.rtl ? \"rtl\" : \"ltr\"} style={{ ...inputStyle, minHeight: 130, resize: \"vertical\", lineHeight: 1.5, borderColor: descShort || descLong ? C.red : undefined }} value={l.desc} onChange={(e) => l.setDesc(e.target.value)} maxLength={DESC_MAX + 50} placeholder={l.rtl ? \"وصف القطعة للمشتري…\" : \"What the buyer should know about this part…\"} />\n                        {lengthBar(descLen, DESC_MIN, DESC_MAX, ` · ${words} ${words === 1 ? \"word\" : \"words\"}`)}", false], ["  const isDirty = savedSnapshot !== null && editSnapshot !== savedSnapshot;\n", "  const isDirty = savedSnapshot !== null && editSnapshot !== savedSnapshot;\n  const DESC_MIN = 100; const DESC_MAX = 150;      // patch-admin-description-bar: the same limits as the API (productValidation.js)\n", false], ["              const ready = [nameEn, nameAr].every((n, i) => n.trim().length >= (i ? nameMins.ar : nameMins.en));\n              return pill(ready ? \"Both names ready\" : \"A name is too short\", ready ? C.gauge : C.red, ready ? C.gaugeBg : C.redBg);", "              const namesOk = [nameEn, nameAr].every((n, i) => n.trim().length >= (i ? nameMins.ar : nameMins.en));\n              const descsOk = [descriptionEn, descriptionAr].every((d) => { const n = d.trim().length; return n === 0 || (n >= DESC_MIN && n <= DESC_MAX); });      // patch-admin-description-bar\n              const ready = namesOk && descsOk;\n              return pill(ready ? \"All ready\" : !namesOk ? \"A name is too short\" : \"A description needs fixing\", ready ? C.gauge : C.red, ready ? C.gaugeBg : C.redBg);", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-description-bar`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Refresh the admin with Ctrl+F5 (no API restart needed).");
