#!/usr/bin/env node
/**
 * The receipt PDF (English and Arabic): the real LEAP logo and Arial for Arabic.
 *  - Logo: the round gold LEAP logo straight on the navy band (bigger on page 1, smaller on the next pages), no white tile.
 *    The patch copies the portals' logo apps/admin-dashboard/public/brand/leap-logo.png to services/api/assets/leap-logo-receipt.png
 *    (if it is missing, the receipt uses assets/leap-logo.png as before).
 *  - Arabic font: Arial. The patch copies arial.ttf and arialbd.ttf from Windows (C:\Windows\Fonts) to services/api/assets/.
 *    Arial is used only when the file is there and has the joined Arabic letter shapes; otherwise Noto Sans Arabic, as before.
 *    On a Linux server, copy the two files into services/api/assets/ there too (Arial is not on Linux).
 * API only, no migration. Run from the project root: node scripts/patch-receipt-arial-logo.js [--write], then restart the API.
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/order/routes.js", "what": "Receipt: the LEAP logo (assets/leap-logo-receipt.png) and Arial for Arabic (assets/arial.ttf, arialbd.ttf), Noto Sans Arabic if Arial is missing", "done": "      // patch-receipt-arial-logo: the round LEAP logo (copied from the portals' public/brand/leap-logo.png) and Arial for Arabic text;", "pairs": [["      logoPath: path.join(__dirname, '../../../assets/leap-logo.png'),\n      fonts: {\n        arabicRegular: path.join(__dirname, '../../../assets/noto-sans-arabic-regular.ttf'),\n        arabicBold: path.join(__dirname, '../../../assets/noto-sans-arabic-bold.ttf'),\n      },", "      // patch-receipt-arial-logo: the round LEAP logo (copied from the portals' public/brand/leap-logo.png) and Arial for Arabic text;\n      // each falls back to the file used before when it is missing\n      logoPath: [path.join(__dirname, '../../../assets/leap-logo-receipt.png'), path.join(__dirname, '../../../assets/leap-logo.png')].find((p) => require('fs').existsSync(p)) || null,\n      fonts: {\n        arabicRegular: path.join(__dirname, '../../../assets/arial.ttf'),\n        arabicBold: path.join(__dirname, '../../../assets/arialbd.ttf'),\n        fallbackRegular: path.join(__dirname, '../../../assets/noto-sans-arabic-regular.ttf'),\n        fallbackBold: path.join(__dirname, '../../../assets/noto-sans-arabic-bold.ttf'),\n      },", false]]}, {"file": "services/api/src/modules/order/receiptPdf.js", "what": "Receipt PDF: Arial for Arabic when its file is there and has the Arabic letters, else Noto Sans Arabic; Receipt PDF: the round LEAP logo straight on the navy band (no white tile); Receipt PDF: the logo a little bigger on page 1; Receipt PDF: brand text centred on the bigger logo; Receipt PDF: the or", "done": "  // patch-receipt-arial-logo: Arial for Arabic. It is used only when its file is there AND it has the joined Arabic letter shapes", "pairs": [["  doc.registerFont('Ar', data.fonts.arabicRegular);\n  doc.registerFont('Ar-Bold', data.fonts.arabicBold);\n", "  // patch-receipt-arial-logo: Arial for Arabic. It is used only when its file is there AND it has the joined Arabic letter shapes\n  // (drawArabic needs them); otherwise the fallback font (Noto Sans Arabic) is used, so a missing or old Arial never breaks a receipt.\n  const usable = (src, tag) => {\n    if (!src || (typeof src === 'string' && !fs.existsSync(src))) return false;\n    try {\n      doc.registerFont(tag, src);\n      doc.font(tag);\n      const f = doc._font && doc._font.font;\n      return !f || typeof f.hasGlyphForCodePoint !== 'function' || [0x0627, 0xFE8E, 0xFEDF, 0xFEE0, 0xFEFB].every((c) => f.hasGlyphForCodePoint(c));\n    } catch { return false; }\n  };\n  const pickFont = (main, fallback, tag) => (usable(main, `${tag}-try`) ? main : fallback || main);\n  doc.registerFont('Ar', pickFont(data.fonts.arabicRegular, data.fonts.fallbackRegular, 'ArR'));\n  doc.registerFont('Ar-Bold', pickFont(data.fonts.arabicBold, data.fonts.fallbackBold, 'ArB'));\n", false], ["  function logo(x, y, size) {\n    // the logo on a white rounded tile, so a logo with its own background or a transparent one both look right on navy\n    doc.roundedRect(x, y, size, size, size * 0.22).fill('#FFFFFF');\n    if (data.logoPath && (typeof data.logoPath !== 'string' || data.logoPath.startsWith('data:') || fs.existsSync(data.logoPath))) {\n      const p = size * 0.1;\n      doc.save();\n      doc.roundedRect(x + p, y + p, size - 2 * p, size - 2 * p, size * 0.16).clip();\n      doc.image(data.logoPath, x + p, y + p, { width: size - 2 * p, height: size - 2 * p });\n      doc.restore();\n    }\n  }", "  function logo(x, y, size) {\n    // the round gold LEAP logo, straight on the navy band (patch-receipt-arial-logo)\n    if (data.logoPath && (typeof data.logoPath !== 'string' || data.logoPath.startsWith('data:') || fs.existsSync(data.logoPath))) {\n      doc.image(data.logoPath, x, y, { width: size, height: size });\n    }\n  }", false], ["    const size = 36;\n    const ly = 26;", "    const size = 48;\n    const ly = 19;", false], ["    put(T.brand, X(size + 10, textW), ly + 1, { w: textW, size: 16, bold: true, color: C.onNavy });\n    put(data.title || T.title, X(size + 10, textW), ly + 22, { w: textW, size: 9.5, color: C.onNavyMuted });", "    put(T.brand, X(size + 12, textW), ly + 7, { w: textW, size: 16, bold: true, color: C.onNavy });\n    put(data.title || T.title, X(size + 12, textW), ly + 28, { w: textW, size: 9.5, color: C.onNavyMuted });", false], ["    put(upper(T.orderLabel), X(width - ow, ow), ly + 1, { w: ow, size: 7.5, bold: true, color: C.gold, align: end });\n    put(data.orderId, X(width - ow, ow), ly + 12, { w: ow, size: 16, bold: true, color: C.onNavy, align: end });", "    put(upper(T.orderLabel), X(width - ow, ow), ly + 7, { w: ow, size: 7.5, bold: true, color: C.gold, align: end });\n    put(data.orderId, X(width - ow, ow), ly + 18, { w: ow, size: 16, bold: true, color: C.onNavy, align: end });", false], ["    const size = 22;\n    logo(X(0, size), 10, size);", "    const size = 30;\n    logo(X(0, size), 6, size);", false], ["    put(T.brand, X(size + 8, width / 2), 14, { w: width / 2, size: 11, bold: true, color: C.onNavy });", "    put(T.brand, X(size + 9, width / 2), 14, { w: width / 2, size: 11, bold: true, color: C.onNavy });", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-receipt-arial-logo`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}

// ---- the files the receipt uses: the LEAP logo and Arial (copied, never overwritten if already there)
{
  const assets = path.join(root, 'services/api/assets');
  const winFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const logos = ['apps/admin-dashboard/public/brand/leap-logo.png', 'apps/supplier-portal/public/brand/leap-logo.png', 'apps/hub-portal/public/brand/leap-logo.png'].map((f) => path.join(root, f));
  const jobs = [
    { to: 'leap-logo-receipt.png', from: logos, what: 'the LEAP logo', missing: 'put the LEAP logo (PNG) at services/api/assets/leap-logo-receipt.png' },
    { to: 'arial.ttf', from: [path.join(winFonts, 'arial.ttf')], what: 'Arial', missing: 'copy arial.ttf from C:\\Windows\\Fonts to services/api/assets/' },
    { to: 'arialbd.ttf', from: [path.join(winFonts, 'arialbd.ttf')], what: 'Arial Bold', missing: 'copy arialbd.ttf from C:\\Windows\\Fonts to services/api/assets/' },
  ];
  console.log('');
  for (const j of jobs) {
    const dest = path.join(assets, j.to);
    if (fs.existsSync(dest)) { console.log(`already   services/api/assets/${j.to} (${j.what})`); continue; }
    const src = j.from.find((f) => fs.existsSync(f));
    if (!src) { console.log(`missing   ${j.what}: not found; ${j.missing} (until then the receipt uses the file it used before)`); continue; }
    if (!write) { console.log(`would copy ${src} -> services/api/assets/${j.to}`); continue; }
    fs.mkdirSync(assets, { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`copied    ${src} -> services/api/assets/${j.to}`);
  }
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. Restart the API (npm run dev in services\\api), then download a receipt again.");
