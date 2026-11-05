#!/usr/bin/env node
/**
 * Storefront on a phone (under 768 px), My tier (confirmed with the person via mockup):
 *  - the tier box shorter and as wide as the phone: the photo smaller (about 56 px) beside the text, the title and the progress text smaller;
 *  - All tiers fits the phone's width (no sideways scroll), about the same height as the box above it; your tier has a gold ring around its photo
 *    (instead of the "You are here" pill on a phone).
 * Tablets and computers are unchanged.
 *
 *   node scripts/patch-phone-my-tier.js            dry run
 *   node scripts/patch-phone-my-tier.js --write    applies it (the file is saved as <file>.before-phone-my-tier first)
 * Then: Ctrl+F5 on the phone. No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/app/account/loyalty/page.tsx", "what": "phone: My tier compact, All tiers fits the phone", "done": "max-md:flex-nowrap max-md:gap-3 max-md:p-3.5", "pairs": [["<section className=\"flex flex-wrap items-center gap-5 rounded-[16px] bg-gradient-to-br from-navy to-[#173f57] p-6 text-white\"", "<section className=\"flex flex-wrap items-center gap-5 rounded-[16px] bg-gradient-to-br from-navy to-[#173f57] p-6 text-white max-md:flex-nowrap max-md:gap-3 max-md:p-3.5\""], ["<span className=\"grid flex-none place-items-center rounded-full bg-white p-1.5 ring-4 ring-signal\">", "<span className=\"grid flex-none place-items-center rounded-full bg-white p-1.5 ring-4 ring-signal max-md:p-1 max-md:ring-[3px] max-md:[&>*]:size-12!\">"], ["<div className=\"min-w-[220px] flex-1\">", "<div className=\"min-w-[220px] flex-1 max-md:min-w-0\">"], ["<p className=\"text-[22px] font-extrabold leading-tight\">", "<p className=\"text-[22px] font-extrabold leading-tight max-md:text-[17px]\">"], ["<p className=\"font-bold text-signal\">", "<p className=\"font-bold text-signal max-md:text-[13px]\">"], ["<div className=\"mt-3 h-2.5 overflow-hidden rounded-full bg-white/15\"", "<div className=\"mt-3 h-2.5 overflow-hidden rounded-full bg-white/15 max-md:mt-2 max-md:h-2\""], ["<p className=\"mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-[#c7d4de]\">", "<p className=\"mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-[#c7d4de] max-md:mt-1 max-md:gap-x-2 max-md:text-[11px]\">"], ["<section aria-labelledby=\"all-tiers\" className=\"rounded-[16px] border border-line bg-white p-5\">", "<section aria-labelledby=\"all-tiers\" className=\"rounded-[16px] border border-line bg-white p-5 max-md:p-3.5\">"], ["<h2 id=\"all-tiers\" className=\"mb-4 text-xs", "<h2 id=\"all-tiers\" className=\"mb-4 max-md:mb-2.5 text-xs"], ["        <div className=\"overflow-x-auto\">\n", "        <div className=\"overflow-x-auto max-md:overflow-visible\">\n"], ["<div className=\"relative\" style={{ minWidth: n * 104 }}>", "<div className=\"relative max-md:min-w-0!\" style={{ minWidth: n * 104 }}>"], ["className=\"absolute top-[23px] h-[3px]", "className=\"absolute top-[23px] h-[3px] max-md:top-[19px]", true], ["className=\"relative flex flex-col items-center px-1 text-center\">", "className=\"relative flex flex-col items-center px-1 text-center max-md:px-0\">"], ["<span className={`rounded-full bg-white p-0.5 ${locked", "<span className={`rounded-full bg-white p-0.5 max-md:[&>*]:size-9! ${isCurrent ? \"max-md:ring-2 max-md:ring-signal \" : \"\"}${locked"], ["<p className={`mt-1.5 font-extrabold ${isCurrent", "<p className={`mt-1.5 font-extrabold max-md:mt-1 max-md:text-[12px] max-md:leading-tight ${isCurrent"], ["<p className=\"text-xs text-muted\">{tier.discountPercentage", "<p className=\"text-xs text-muted max-md:text-[10px] max-md:leading-tight\">{tier.discountPercentage"], ["{isCurrent && <span className=\"mt-1.5 rounded-full bg-signal px-2.5 py-0.5 text-[11.5px] font-extrabold text-navy\">", "{isCurrent && <span className=\"mt-1.5 rounded-full bg-signal px-2.5 py-0.5 text-[11.5px] font-extrabold text-navy max-md:hidden\">"]]}]};
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
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-portal-redesign`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: Ctrl+F5 on the phone.');
