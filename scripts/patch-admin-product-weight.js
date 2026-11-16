#!/usr/bin/env node
/**
 * Admin > Products > a product > Weight & dimensions, redesigned: edit the actual weight (kg) and the package length x width x height (cm), and see
 * the weight the shipping fee is charged on -- the actual weight or the size weight (L x W x H / the Delivery Rules divisor), whichever is greater,
 * marked USED. While all four are empty the part's numbers are shown and used; a half-filled set is flagged. The API's product detail also sends the divisor.
 * Needs patch-admin-product-redesign (and patch-admin-fitment-versions) first.
 *   node scripts/patch-admin-product-weight.js            dry run
 *   node scripts/patch-admin-product-weight.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/catalog/routes.js", "what": "product detail: read the size-weight divisor (Delivery Rules); product detail: send the size-weight divisor", "done": "const { getDeliverySettings: getDivisorSettings } = require('../deliveryEstimate/settings');      // patch-admin-product-weight", "pairs": [["const { resolveDestinationIsoCode, estimateDelivery } = require('../deliveryEstimate/engine');", "const { resolveDestinationIsoCode, estimateDelivery } = require('../deliveryEstimate/engine');\nconst { getDeliverySettings: getDivisorSettings } = require('../deliveryEstimate/settings');      // patch-admin-product-weight", false], ["      videoUrl: row.video_url,\n      status: row.status,", "      videoUrl: row.video_url,\n      volumetricDivisor: await getDivisorSettings().then((s) => Number(s.volumetricDivisor) || 5000).catch(() => 5000),      // patch-admin-product-weight: L x W x H / this = the size weight\n      status: row.status,", false]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "product page: work out the fee weight; product page: the Weight & dimensions card redesigned (edit the four numbers, see the fee weight)", "done": "  // patch-admin-product-weight: the fee weight = the greater of the actual weight and L x W x H / divisor (the divisor is the Delivery Rules setting).", "pairs": [["  const usesPartSize = eff.source && eff.source !== \"product\";\n", "  const usesPartSize = eff.source && eff.source !== \"product\";\n  // patch-admin-product-weight: the fee weight = the greater of the actual weight and L x W x H / divisor (the divisor is the Delivery Rules setting).\n  // While all four boxes are empty the product uses its part's numbers (as the API does); a half-filled set is shown as missing until it is complete.\n  const divisor = Number(product.volumetricDivisor) || 5000;\n  const numOrNull = (v) => (v === \"\" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));\n  const ownVals = [weightKg, lengthCm, widthCm, heightCm].map(numOrNull);\n  const hasOwnAny = [weightKg, lengthCm, widthCm, heightCm].some((v) => v !== \"\");\n  const ownComplete = ownVals.every((v) => v !== null && v > 0);\n  const ownPartial = hasOwnAny && !ownComplete;\n  const partVals = eff.source === \"part\" ? [eff.weightKg, eff.lengthCm, eff.widthCm, eff.heightCm].map(numOrNull) : [null, null, null, null];\n  const feeSource = ownComplete ? \"product\" : !hasOwnAny && partVals.every((v) => v !== null) ? \"part\" : \"missing\";\n  const [feeActual, feeL, feeW, feeH] = feeSource === \"product\" ? ownVals : feeSource === \"part\" ? partVals : [null, null, null, null];\n  const feeSize = feeL === null ? null : (feeL * feeW * feeH) / divisor;\n  const feeKg = feeActual === null || feeSize === null ? null : Math.max(feeActual, feeSize);\n  const feeUsed = feeKg === null ? null : feeSize > feeActual ? \"size\" : \"actual\";\n  const fmtKg = (n) => (Math.round(n * 100) / 100).toFixed(2);\n  const fmtNum = (n) => String(Math.round(n * 10) / 10);\n", false], ["          <div style={panel}>\n            {sectionTitle(\"Weight & dimensions\")}\n            <div style={{ display: \"grid\", gridTemplateColumns: \"1fr 1fr\", gap: 12 }}>\n              {field(\"Weight (kg)\", <input type=\"number\" style={inputStyle} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />)}\n              {field(\"Length (cm)\", <input type=\"number\" style={inputStyle} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />)}\n              {field(\"Width (cm)\", <input type=\"number\" style={inputStyle} value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />)}\n              {field(\"Height (cm)\", <input type=\"number\" style={inputStyle} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />)}\n            </div>\n            <div style={{ display: \"grid\", gridTemplateColumns: \"1fr 1fr\", gap: 10, marginTop: 14 }}>\n              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.line}`, borderRadius: 10, padding: \"8px 12px\" }}>\n                <div style={{ ...body, fontSize: 10.5, fontWeight: 800, color: C.muted, letterSpacing: \"0.06em\", textTransform: \"uppercase\" }}>Volume</div>\n                <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.ink }}>{volumeL === null ? \"—\" : `${volumeL.toFixed(2)} L`}</div>\n              </div>\n              <div style={{ background: C.surfaceHigh, border: `1px solid ${C.line}`, borderRadius: 10, padding: \"8px 12px\" }}>\n                <div style={{ ...body, fontSize: 10.5, fontWeight: 800, color: C.muted, letterSpacing: \"0.06em\", textTransform: \"uppercase\" }}>Size weight</div>\n                <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.ink }}>{volWeight === null ? \"—\" : `${volWeight.toFixed(2)} kg`}</div>\n              </div>\n            </div>\n            {usesPartSize && (\n              <div style={{ ...body, fontSize: 12, color: C.amberInk, background: C.amberBg, borderRadius: 10, padding: \"8px 12px\", marginTop: 10, lineHeight: 1.45 }}>\n                Shipping uses the part's size now: {eff.weightKg ?? \"—\"} kg · {eff.lengthCm ?? \"—\"}×{eff.widthCm ?? \"—\"}×{eff.heightCm ?? \"—\"} cm. Fill these in to use this product's own.\n              </div>\n            )}\n          </div>\n", "          <div style={panel} data-testid=\"weight-card\">\n            {/* patch-admin-product-weight: the four numbers are edited here, and the card shows the weight the shipping fee is charged on:\n                the actual weight or the size weight (L x W x H / divisor), whichever is greater. */}\n            {sectionTitle(\"Weight & dimensions\", pill(\n              feeSource === \"product\" ? \"This product's size\" : feeSource === \"part\" ? \"Using the part's size\" : \"Size missing\",\n              feeSource === \"product\" ? C.gauge : feeSource === \"part\" ? C.amber : C.red,\n              feeSource === \"product\" ? C.gaugeBg : feeSource === \"part\" ? C.amberBg : C.redBg))}\n            {field(\"Actual weight\", (\n              <div style={{ position: \"relative\" }}>\n                <input type=\"number\" min=\"0\" step=\"0.01\" aria-label=\"Weight (kg)\" style={{ ...inputStyle, ...mono, fontSize: 15, fontWeight: 700, paddingRight: 40 }} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder={eff.source === \"part\" ? String(eff.weightKg ?? \"\") : \"\"} />\n                <span style={{ ...body, position: \"absolute\", right: 12, top: \"50%\", transform: \"translateY(-50%)\", fontSize: 12, fontWeight: 700, color: C.muted, pointerEvents: \"none\" }}>kg</span>\n              </div>\n            ))}\n            <div style={{ marginTop: 12 }}>\n              <label style={labelStyle}>Package size (length × width × height)</label>\n              <div style={{ display: \"grid\", gridTemplateColumns: \"1fr auto 1fr auto 1fr\", gap: 6, alignItems: \"center\" }}>\n                {[[\"Length (cm)\", \"L\", lengthCm, setLengthCm, eff.lengthCm], [\"Width (cm)\", \"W\", widthCm, setWidthCm, eff.widthCm], [\"Height (cm)\", \"H\", heightCm, setHeightCm, eff.heightCm]].map(([aria, short, value, set, partValue], i) => (\n                  <React.Fragment key={short}>\n                    {i > 0 && <span style={{ ...body, fontSize: 14, fontWeight: 800, color: C.muted }}>×</span>}\n                    <div style={{ position: \"relative\" }}>\n                      <span style={{ ...body, position: \"absolute\", left: 10, top: \"50%\", transform: \"translateY(-50%)\", fontSize: 11, fontWeight: 800, color: C.muted, pointerEvents: \"none\" }}>{short}</span>\n                      <input type=\"number\" min=\"0\" step=\"0.1\" aria-label={aria} style={{ ...inputStyle, ...mono, fontSize: 14, fontWeight: 700, paddingLeft: 26, paddingRight: 30 }} value={value} onChange={(e) => set(e.target.value)} placeholder={eff.source === \"part\" ? String(partValue ?? \"\") : \"\"} />\n                      <span style={{ ...body, position: \"absolute\", right: 9, top: \"50%\", transform: \"translateY(-50%)\", fontSize: 11, fontWeight: 700, color: C.muted, pointerEvents: \"none\" }}>cm</span>\n                    </div>\n                  </React.Fragment>\n                ))}\n              </div>\n            </div>\n            {ownPartial && (\n              <div role=\"alert\" style={{ ...body, fontSize: 12, color: C.redInk, background: C.redBg, borderRadius: 8, padding: \"7px 12px\", marginTop: 10 }}>\n                Fill in all four (weight, length, width and height), or empty all four to use the part's size.\n              </div>\n            )}\n\n            {/* the weight the fee is charged on */}\n            <div style={{ marginTop: 14, borderRadius: 12, overflow: \"hidden\", border: `1px solid ${C.line}` }}>\n              <div style={{ display: \"grid\", gridTemplateColumns: \"1fr 1fr\" }}>\n                {[[\"actual\", \"Actual weight\", feeActual, feeActual === null ? \"—\" : \"on the scale\"],\n                  [\"size\", \"Size weight\", feeSize, feeL === null ? \"—\" : `${fmtNum(feeL)}×${fmtNum(feeW)}×${fmtNum(feeH)} ÷ ${divisor}`]].map(([key, title, value, sub], i) => {\n                  const used = feeUsed === key;\n                  return (\n                    <div key={key} style={{ padding: \"10px 12px\", background: used ? C.goldTint : C.surfaceHigh, borderLeft: i ? `1px solid ${C.line}` : \"none\", boxShadow: used ? `inset 0 -3px 0 ${C.signal}` : \"none\" }}>\n                      <div style={{ display: \"flex\", alignItems: \"center\", gap: 6 }}>\n                        <span style={{ ...body, fontSize: 10.5, fontWeight: 800, color: C.muted, letterSpacing: \"0.06em\", textTransform: \"uppercase\" }}>{title}</span>\n                        {used && <span style={{ ...body, fontSize: 9.5, fontWeight: 800, color: C.onSignal, background: C.signal, borderRadius: 999, padding: \"1px 6px\" }}>USED</span>}\n                      </div>\n                      <div style={{ ...mono, fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 2 }}>{value === null ? \"—\" : `${fmtKg(value)} kg`}</div>\n                      <div style={{ ...mono, fontSize: 10.5, color: C.muted, marginTop: 1 }}>{sub}</div>\n                    </div>\n                  );\n                })}\n              </div>\n              <div style={{ display: \"flex\", alignItems: \"center\", justifyContent: \"space-between\", gap: 10, padding: \"12px 14px\", background: `linear-gradient(120deg, ${C.navyDeep}, ${C.navy} 60%, ${C.navySoft} 140%)` }}>\n                <div>\n                  <div style={{ ...body, fontSize: 10.5, fontWeight: 800, color: C.onNavyMuted, letterSpacing: \"0.08em\", textTransform: \"uppercase\" }}>Fee weight</div>\n                  <div style={{ ...body, fontSize: 11, color: C.onNavyMuted, marginTop: 2 }}>\n                    {feeUsed === \"size\" ? \"The size weight is greater, so the fee uses it.\" : feeUsed === \"actual\" ? \"The actual weight is greater, so the fee uses it.\" : \"Enter the weight and size to see it.\"}\n                  </div>\n                </div>\n                <div style={{ ...mono, fontSize: 22, fontWeight: 800, color: C.signal, whiteSpace: \"nowrap\" }}>{feeKg === null ? \"—\" : `${fmtKg(feeKg)} kg`}</div>\n              </div>\n            </div>\n            <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>\n              {feeSource === \"part\"\n                ? <>These are the part's numbers ({part || \"its part\"}): leave the boxes empty to keep using them, or fill in all four for this product's own.</>\n                : feeSource === \"product\"\n                  ? <>Volume {volumeL === null ? \"—\" : `${volumeL.toFixed(2)} L`}. Size weight = L × W × H ÷ {divisor} (set in Delivery Rules).</>\n                  : ownPartial ? <>The fee weight shows once all four are filled in.</> : <>This product and its part have no size yet, so the shipping fee can't be worked out.</>}\n              {feeSource === \"product\" && hasOwnAny && (\n                <button type=\"button\" onClick={() => { setWeightKg(\"\"); setLengthCm(\"\"); setWidthCm(\"\"); setHeightCm(\"\"); }} style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.torque, background: \"none\", border: \"none\", padding: 0, marginLeft: 6, cursor: \"pointer\", textDecoration: \"underline\" }}>Empty all four</button>\n              )}\n            </div>\n          </div>\n", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-admin-product-weight`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then restart the API: cd services\\api ; npm run dev   (one API window, no migration). Refresh the admin with Ctrl+F5.");
