#!/usr/bin/env node
/**
 * Fix: Settings > Receipt footer said "Failed to load receipt footer (404)".
 * The admin page (and the receipt PDF) use GET/PATCH /platform-settings/receipt-footer, but the API never had those two routes.
 * This adds them: English and Arabic note, up to 500 characters each, empty = no note; saved in platform_settings
 * (receipt_footer_note_en / receipt_footer_note_ar, the same keys the receipt PDF already reads); each save is written to the audit log.
 * API only, no migration. Run from the project root: node scripts/patch-receipt-footer-api.js [--write], then restart the API.
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/platform-settings/routes.js", "what": "GET/PATCH /platform-settings/receipt-footer (the admin page and the receipt already used it, the API never had it)", "done": "// patch-receipt-footer-api: the note printed at the bottom of every receipt PDF, in English and Arabic (keys receipt_footer_note_en / _ar,", "pairs": [["// CONFIRMED SCOPE (migration 025): whether a review requires a real", "// patch-receipt-footer-api: the note printed at the bottom of every receipt PDF, in English and Arabic (keys receipt_footer_note_en / _ar,\n// read by GET /order/:id/receipt). Empty = no note in that language. Admin only.\nconst RECEIPT_FOOTER_MAX = 500;\nrouter.get('/receipt-footer', requireAuth, requireRole('admin'), async (req, res, next) => {\n  try {\n    const { rows } = await db.query(\"SELECT key, value FROM platform_settings WHERE key IN ('receipt_footer_note_en', 'receipt_footer_note_ar')\");\n    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));\n    res.json({ footerNoteEn: byKey.receipt_footer_note_en || '', footerNoteAr: byKey.receipt_footer_note_ar || '' });\n  } catch (err) {\n    next(err);\n  }\n});\n\nrouter.patch('/receipt-footer', requireAuth, requireRole('admin'), async (req, res, next) => {\n  try {\n    const { footerNoteEn, footerNoteAr } = req.body || {};\n    const clean = {};\n    for (const [name, v] of [['footerNoteEn', footerNoteEn], ['footerNoteAr', footerNoteAr]]) {\n      if (v != null && typeof v !== 'string') return res.status(400).json({ error: `${name} must be text` });\n      const t = String(v ?? '').trim();\n      if (t.length > RECEIPT_FOOTER_MAX) return res.status(400).json({ error: `${name} can be at most ${RECEIPT_FOOTER_MAX} characters` });\n      clean[name] = t;\n    }\n    for (const [key, value] of [['receipt_footer_note_en', clean.footerNoteEn], ['receipt_footer_note_ar', clean.footerNoteAr]]) {\n      await db.query(\n        `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now())\n         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,\n        [key, value]\n      );\n    }\n    await logAdminAction(req, 'receipt_footer_changed', 'platform_setting', 'receipt_footer', { en: clean.footerNoteEn.length, ar: clean.footerNoteAr.length });\n    res.json(clean);\n  } catch (err) {\n    next(err);\n  }\n});\n\n// CONFIRMED SCOPE (migration 025): whether a review requires a real", false]]}]};
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
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version this patch expects (send this file)' }));
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-receipt-footer-api`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Restart the API (npm run dev in services\\api), then Ctrl+F5 in the admin.");
