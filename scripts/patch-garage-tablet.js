#!/usr/bin/env node
/**
 * My garage on a TABLET looks the same as on the phone (confirmed with the person via mockup), from 768 to 1023 px wide:
 *  - the title box is half as high, the title smaller, no description line (My garage only; the other account pages stay as they are);
 *  - only the small "2/5" ring, without "2 of 5 · cars saved" beside it;
 *  - each car: the small photo (130 px) with the details beside it, the buttons underneath across the width.
 * The computer (1024 px and wider) stays as it is.
 *
 *   node scripts/patch-garage-tablet.js            dry run
 *   node scripts/patch-garage-tablet.js --write    applies it (each changed file is saved as <file>.before-garage-tablet first)
 * Then: Ctrl+F5 on the website.   (No server change, no app change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "account title box: on a tablet My garage gets the phone's small title box", "done": "max-lg:px-3.5! max-lg:py-2!", "pairs": [["            <header data-testid=\"account-page-header\" className=\"relative flex flex-wrap items-center gap-x-5 gap-y-3 overflow-hidden rounded-[16px] bg-gradient-to-br from-navy to-[#173f57] px-6 py-5 text-white max-md:flex-nowrap max-md:gap-x-3 max-md:rounded-[14px] max-md:px-3.5 max-md:py-2 sm:px-7\">\n", "            <header data-testid=\"account-page-header\" className={`relative flex flex-wrap items-center gap-x-5 gap-y-3 overflow-hidden rounded-[16px] bg-gradient-to-br from-navy to-[#173f57] px-6 py-5 text-white max-md:flex-nowrap max-md:gap-x-3 max-md:rounded-[14px] max-md:px-3.5 max-md:py-2 sm:px-7${item[0] === \"/garage\" ? \" max-lg:flex-nowrap max-lg:gap-x-3 max-lg:rounded-[14px] max-lg:px-3.5! max-lg:py-2!\" : \"\"}`}>\n", false], ["              <span aria-hidden=\"true\" className=\"grid size-14 flex-none place-items-center rounded-full bg-white text-navy ring-4 ring-signal max-md:size-8 max-md:ring-[3px] [&>svg]:max-md:size-4\"><Icon href={item[0]} size={26} /></span>\n", "              <span aria-hidden=\"true\" className={`grid size-14 flex-none place-items-center rounded-full bg-white text-navy ring-4 ring-signal max-md:size-8 max-md:ring-[3px] [&>svg]:max-md:size-4${item[0] === \"/garage\" ? \" max-lg:size-8 max-lg:ring-[3px] [&>svg]:max-lg:size-4\" : \"\"}`}><Icon href={item[0]} size={26} /></span>\n", false], ["                <h1 className=\"text-[26px] font-extrabold leading-tight tracking-tight text-white max-md:text-[18px]\">{t(item[1])}</h1>\n", "                <h1 className={`text-[26px] font-extrabold leading-tight tracking-tight text-white max-md:text-[18px]${item[0] === \"/garage\" ? \" max-lg:text-[18px]\" : \"\"}`}>{t(item[1])}</h1>\n", false], ["                <p className=\"mt-1 text-[15px] font-semibold text-signal max-md:hidden\">{t(item[2])}</p>\n", "                <p className={`mt-1 text-[15px] font-semibold text-signal max-md:hidden${item[0] === \"/garage\" ? \" max-lg:hidden\" : \"\"}`}>{t(item[2])}</p>\n", false]]}, {"file": "apps/web-storefront/components/GarageMeter.tsx", "what": "My garage ring: on a tablet only the small ring, like the phone", "done": "max-lg:size-11", "pairs": [], "region": {"from": "export default function GarageMeter", "to": "\n  );\n}", "find": "max-md:", "repl": "max-lg:"}}, {"file": "apps/web-storefront/app/garage/page.tsx", "what": "My garage cars: on a tablet the phone's card (small photo, buttons underneath)", "done": "lg:grid-cols-[250px_minmax(0,1fr)]", "pairs": [["(min-width: 640px) 250px, 130px", "(min-width: 1024px) 250px, 130px", "maybe"], ["from 640 px: a 250 x 250 photo", "from 1024 px: a 250 x 250 photo", "maybe"]], "region": {"from": "function CarCard(", "to": "export default function GaragePage(", "find": "(^|[\\s\"`(])sm:", "repl": "$1lg:", "must": "sm:grid-cols-[250px_minmax(0,1fr)]"}}, {"file": "apps/web-storefront/app/stage1b-pages.test.tsx", "what": "website test: the big car photo starts at 1024 px now", "optional": true, "done": "expect(frame.className).toContain(\"lg:size-[250px]\");", "pairs": [["expect(frame.className).toContain(\"sm:size-[250px]\");", "expect(frame.className).toContain(\"lg:size-[250px]\");", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-garage-tablet`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the website (on the tablet too)');
