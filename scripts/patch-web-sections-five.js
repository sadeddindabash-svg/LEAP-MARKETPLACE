#!/usr/bin/env node
/**
 * Website home page "Shop by section" on a computer (confirmed with the person via mockup): 5 per row instead of 4, smaller tiles
 * (84 px high, 15 px name, smaller picture icon); the "More sections" tile matches. Tablet (3 per row) and phone (sliding) stay as they are.
 *   node scripts/patch-web-sections-five.js            dry run
 *   node scripts/patch-web-sections-five.js --write    applies it
 * Then: website Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/page.tsx", "what": "website home, \"Shop by section\": 5 per row on a computer (tablet 3 and phone as before)", "done": "lg:grid-cols-5\" moreLabel={t(lang, \"more_sections\")}", "pairs": [["<TileRow phoneSlide variant=\"wide\" defaultColumns={4} gridClassName=\"grid grid-cols-4 gap-x-2 gap-y-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4\" moreLabel={t(lang, \"more_sections\")}", "<TileRow phoneSlide variant=\"wide\" defaultColumns={5} gridClassName=\"grid grid-cols-4 gap-x-2 gap-y-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5\" moreLabel={t(lang, \"more_sections\")}", false]]}, {"file": "apps/web-storefront/components/SectionTile.tsx", "what": "website, section tile on a computer: 84 px high, 15 px name, smaller picture icon", "done": "lg:h-[84px]", "pairs": [[" * On a phone (under 768 px): a square photo", " * On a computer (1024 px and up): smaller, 84 px high with a 15 px name, 5 per line (confirmed with the person via mockup).\n * On a phone (under 768 px): a square photo", false], ["md:h-[104px] md:flex-row", "md:h-[104px] lg:h-[84px] md:flex-row", false], ["md:px-5 md:text-[17px]\">{name}", "md:px-5 md:text-[17px] lg:px-3.5 lg:text-[15px]\">{name}", false], ["<svg aria-hidden=\"true\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\"", "<svg aria-hidden=\"true\" width=\"32\" height=\"32\" className=\"lg:size-[26px]\" viewBox=\"0 0 24 24\"", false]]}, {"file": "apps/web-storefront/components/TileRow.tsx", "what": "website, the \"More sections\" tile: same 84 px height as the sections on a computer", "done": "md:h-[104px] lg:h-[84px] md:flex-row md:justify-center", "pairs": [["md:h-[104px] md:flex-row md:justify-center md:rounded-[14px] md:border md:border-dashed md:border-[#8696a2] md:px-3 md:text-[17px]", "md:h-[104px] lg:h-[84px] md:flex-row md:justify-center md:rounded-[14px] md:border md:border-dashed md:border-[#8696a2] md:px-3 md:text-[17px] lg:text-[15px]", false]]}, {"file": "apps/web-storefront/app/homeTiles.test.tsx", "what": "website test: 5 sections per row on a computer", "done": "\"lg:grid-cols-5\"]) expect(ul.className.split", "pairs": [["4 on a computer, each a link to the section", "5 on a computer, each a link to the section", false], ["for (const c of [\"grid-cols-4\", \"md:grid-cols-3\", \"lg:grid-cols-4\"]) expect(ul.className.split(\" \"), c).toContain(c);", "for (const c of [\"grid-cols-4\", \"md:grid-cols-3\", \"lg:grid-cols-5\"]) expect(ul.className.split(\" \"), c).toContain(c);", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-sections-five`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
