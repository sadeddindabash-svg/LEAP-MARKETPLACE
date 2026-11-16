#!/usr/bin/env node
/**
 * Website home page "Shop by brand" (PC, tablet, phone; confirmed with the person via mockup): no white ring around the brand circles,
 * one thin dark border (gold on hover); the circle has the page colour and a logo's white background takes that colour too.
 *
 *   node scripts/patch-web-brand-ring.js            dry run
 *   node scripts/patch-web-brand-ring.js --write    applies it (each changed file is saved as <file>.before-patch-web-brand-ring first)
 * Then: website Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/components/BrandTile.tsx", "what": "website, \"Shop by brand\": no white ring, one thin dark border (gold on hover), the circle and the logo's white take the page colour", "done": "border-ink bg-chalk", "pairs": [["/** A brand on the home page (\"Shop by brand\"): a round photo with a fine ring and the name under it, no card around it.", "/** A brand on the home page (\"Shop by brand\"): a round photo with one thin dark border (gold on hover) and the name under it, no card around it.\n *  No white ring: the circle has the page colour, and the logo picture is \"multiplied\" onto it, so a logo's white background takes the page colour too (confirmed with the person via mockup).", false], ["className=\"relative grid size-[60px] place-items-center overflow-hidden rounded-full bg-[#e6edf2] text-[#8696a2] shadow-[0_0_0_3px_#fff,0_0_0_4px_#d3dae0] transition-shadow group-hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#fab219] min-[400px]:size-[68px] md:size-24\"", "className=\"relative grid size-[60px] place-items-center overflow-hidden rounded-full border-[1.5px] border-ink bg-chalk text-[#8696a2] transition-colors group-hover:border-signal min-[400px]:size-[68px] md:size-24\"", false], ["fill sizes=\"96px\" className=\"object-cover\" unoptimized />", "fill sizes=\"96px\" className=\"object-cover mix-blend-multiply\" unoptimized />", false]]}, {"file": "apps/web-storefront/components/BrandTile.test.tsx", "what": "website test: the brand circle's new border and colour", "done": "border-[1.5px]", "pairs": [["for (const k of [\"rounded-full\", \"size-[60px]\", \"md:size-24\", \"overflow-hidden\", \"bg-[#e6edf2]\"]) expect(c.className.split(\" \"), k).toContain(k); expect(c.className).toContain(\"shadow-[0_0_0_3px_#fff,0_0_0_4px_#d3dae0]\");", "for (const k of [\"rounded-full\", \"size-[60px]\", \"md:size-24\", \"overflow-hidden\", \"bg-chalk\", \"border-[1.5px]\", \"border-ink\"]) expect(c.className.split(\" \"), k).toContain(k); expect(c.className).not.toContain(\"#fff\"); expect(screen.getByTestId(\"photo\").className).toContain(\"mix-blend-multiply\");", false], ["it(\"the ring turns gold when the tile is hovered\", () => { show(); expect(screen.getByTestId(\"brand-tile-photo\").className).toContain(\"group-hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#fab219]\");", "it(\"the border turns gold when the tile is hovered\", () => { show(); expect(screen.getByTestId(\"brand-tile-photo\").className).toContain(\"group-hover:border-signal\");", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-brand-ring`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
