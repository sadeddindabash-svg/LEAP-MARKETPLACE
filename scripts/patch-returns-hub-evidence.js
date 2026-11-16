#!/usr/bin/env node
/**
 * Returns: the supplier also sees what the HUB found. Run AFTER patch-returns-supplier-answer.
 * A return the hub opened at inspection (flagged parcel) now shows the supplier the hub's photos, the kind of problem and the inspector's note,
 * so the supplier can check before answering Accept / Don't accept.
 *   node scripts/patch-returns-hub-evidence.js            dry run
 *   node scripts/patch-returns-hub-evidence.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/returns/routes.js", "what": "returns: the supplier also sees what the hub found (its photos and note) when the hub flagged the parcel; returns: the hub's evidence in the supplier's case", "done": "     FROM order_line_items oli LEFT JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = rc.sub_order_id) AS item_list,", "pairs": [["     FROM order_line_items oli LEFT JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = rc.sub_order_id) AS item_list`;", "     FROM order_line_items oli LEFT JOIN products p ON p.id = oli.product_id WHERE oli.sub_order_id = rc.sub_order_id) AS item_list,\n  (SELECT json_build_object('notes', e.notes, 'damageType', e.damage_type, 'at', e.created_at,\n            'photos', (SELECT json_agg(ph.url ORDER BY ph.sort_order) FROM hub_shipment_photos ph WHERE ph.event_id = e.id))\n     FROM hub_shipment_events e JOIN hub_shipments hs ON hs.id = e.shipment_id\n     WHERE hs.sub_order_id = rc.sub_order_id AND e.step = 'flagged' ORDER BY e.created_at DESC LIMIT 1) AS hub_flag`;      // patch-returns-hub-evidence", false], ["    receivedCondition: row.received_condition || null,\n  };\n}\n// The parts and the buyer's photos", "    receivedCondition: row.received_condition || null,\n    // patch-returns-hub-evidence: the hub flagged the parcel at inspection: its note, the kind of problem and its photos\n    hubEvidence: row.hub_flag ? { notes: row.hub_flag.notes || null, damageType: row.hub_flag.damageType || null, at: row.hub_flag.at, photos: row.hub_flag.photos || [] } : null,\n  };\n}\n// The parts and the buyer's photos", false]]}, {"file": "apps/supplier-portal/src/App.jsx", "what": "supplier Returns: words for the hub's evidence (Chinese); supplier Returns: words for the hub's evidence (English); supplier Returns: the reason of a hub-found problem; supplier Returns: the hub's photos and note; supplier Returns: 'reason' (not 'buyer's reason') for a hub-found problem", "done": "    hubTitle: \"质检中心发现的问题\", hubReason: \"质检中心检验时发现质量问题\", hubNote: \"质检备注\", hubNoPhotos: \"质检中心没有上传照片。\",", "pairs": [["    empty: \"暂无售后案例\", loading: \"加载中…\", needAnswer: (n) => `${n} 个退货等待您的答复`,", "    empty: \"暂无售后案例\", loading: \"加载中…\", needAnswer: (n) => `${n} 个退货等待您的答复`,\n    hubTitle: \"质检中心发现的问题\", hubReason: \"质检中心检验时发现质量问题\", hubNote: \"质检备注\", hubNoPhotos: \"质检中心没有上传照片。\",\n    damage: { physical_damage: \"外观损坏\", water_damage: \"进水/受潮\", missing_parts: \"缺少零件\", wrong_item: \"发错商品\", other: \"其他问题\" },", false], ["    empty: \"No return cases.\", loading: \"Loading…\", needAnswer: (n) => `${n} ${n === 1 ? \"return waits\" : \"returns wait\"} for your answer`,", "    empty: \"No return cases.\", loading: \"Loading…\", needAnswer: (n) => `${n} ${n === 1 ? \"return waits\" : \"returns wait\"} for your answer`,\n    hubTitle: \"What the hub found\", hubReason: \"Quality issue found at hub inspection\", hubNote: \"Inspector's note\", hubNoPhotos: \"The hub did not attach photos.\",\n    damage: { physical_damage: \"Physical damage\", water_damage: \"Water damage\", missing_parts: \"Missing parts\", wrong_item: \"Wrong item\", other: \"Other problem\" },", false], ["{c.reasonCode ? x.reasons[c.reasonCode] : c.reason}", "{c.reasonCode ? x.reasons[c.reasonCode] : c.hubEvidence ? x.hubReason : c.reason}", false], ["                  <div>\n                    <div style={label}>{x.photos}</div>\n                    {photos.length === 0 ? <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{x.noPhotos}</div> : (", "                  <div>\n                    {c.hubEvidence && (\n                      <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 12, padding: 12, marginBottom: photos.length > 0 ? 14 : 0 }}>\n                        <div style={{ ...label, color: C.redInk }}>{x.hubTitle}{c.hubEvidence.damageType ? ` · ${x.damage[c.hubEvidence.damageType] || c.hubEvidence.damageType}` : \"\"}</div>\n                        {c.hubEvidence.photos.length === 0 ? <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{x.hubNoPhotos}</div> : (\n                          <div style={{ display: \"flex\", gap: 10, flexWrap: \"wrap\" }}>\n                            {c.hubEvidence.photos.map((url, i) => (\n                              <button key={i} type=\"button\" onClick={() => setBigPhoto(photoSrc(url))} aria-label={`${x.hubTitle} ${i + 1}`} style={{ padding: 0, border: `1px solid ${C.line}`, borderRadius: 10, overflow: \"hidden\", width: 104, height: 104, cursor: \"zoom-in\", background: \"#fff\" }}>\n                                <img src={photoSrc(url)} alt=\"\" onError={(e) => { e.currentTarget.style.visibility = \"hidden\"; }} style={{ width: \"100%\", height: \"100%\", objectFit: \"cover\", display: \"block\" }} />\n                              </button>\n                            ))}\n                          </div>\n                        )}\n                        {c.hubEvidence.notes && <div style={{ ...font, fontSize: 12.5, color: C.ink, marginTop: 10, whiteSpace: \"pre-line\" }}><b>{x.hubNote}{lang === \"zh\" ? \"：\" : \": \"}</b>{c.hubEvidence.notes}</div>}\n                        {c.hubEvidence.photos.length > 0 && <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 6 }}>{x.photoHint}</div>}\n                      </div>\n                    )}\n                    {(photos.length > 0 || !c.hubEvidence) && <div style={label}>{x.photos}</div>}\n                    {photos.length === 0 ? (c.hubEvidence ? null : <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{x.noPhotos}</div>) : (", false], ["<div style={{ ...label, marginTop: 14 }}>{x.reason}</div>", "<div style={{ ...label, marginTop: 14 }}>{c.hubEvidence && !c.reasonCode ? (lang === \"zh\" ? \"原因\" : \"Reason\") : x.reason}</div>", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-returns-hub-evidence`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Then: cd services\\api ; npm run dev   (one API window). Refresh the supplier portal with Ctrl+F5.");
