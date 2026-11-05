#!/usr/bin/env node
/**
 * Storefront on a phone (under 768 px), the My account page (confirmed with the person via mockup):
 *  - Vehicles, Orders and Wishlist side by side (one row of 3 small boxes);
 *  - the profile (Welcome back, the name, the email, Change photo) shorter: a smaller photo, smaller text and bell;
 *  - the tier card shorter.
 * Tablets and computers are unchanged.
 *
 *   node scripts/patch-phone-account-page.js            dry run
 *   node scripts/patch-phone-account-page.js --write    applies it (each changed file is saved as <file>.before-phone-account-page first)
 * Then: Ctrl+F5 on the phone. No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/app/account/page.tsx", "what": "phone: My account, Vehicles \u00b7 Orders \u00b7 Wishlist side by side, a shorter profile", "done": "max-md:size-14 ${photoBusy", "pairs": [["<li className=\"rounded-[14px] border border-line bg-white p-4 text-center\"><p className=\"text-3xl font-extrabold tabular-nums text-navy\">", "<li className=\"rounded-[14px] border border-line bg-white p-4 text-center max-md:rounded-[12px] max-md:px-1 max-md:py-2\"><p className=\"text-3xl font-extrabold tabular-nums text-navy max-md:text-xl max-md:leading-tight\">"], ["<p className=\"text-sm font-semibold text-muted\">{label}</p></li>", "<p className=\"text-sm font-semibold text-muted max-md:text-[11.5px]\">{label}</p></li>"], ["<section className=\"flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5 sm:p-6\" aria-labelledby=\"acc-h\">", "<section className=\"flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5 max-md:flex-nowrap max-md:gap-3 max-md:p-3 sm:p-6\" aria-labelledby=\"acc-h\">"], ["<label className={`relative block size-[84px] flex-none ${photoBusy", "<label className={`relative block size-[84px] flex-none max-md:size-14 ${photoBusy"], ["<span className=\"relative grid size-[84px] place-items-center overflow-hidden rounded-full bg-navy text-[34px] font-extrabold text-white\">", "<span className=\"relative grid size-[84px] place-items-center overflow-hidden rounded-full bg-navy text-[34px] font-extrabold text-white max-md:size-14 max-md:text-[22px]\">"], ["<span aria-hidden=\"true\" className=\"absolute -bottom-0.5 -end-0.5 grid size-8 place-items-center rounded-full border-[3px] border-white bg-signal text-navy\">", "<span aria-hidden=\"true\" className=\"absolute -bottom-0.5 -end-0.5 grid size-8 place-items-center rounded-full border-[3px] border-white bg-signal text-navy max-md:size-6 max-md:border-2 [&>svg]:max-md:size-3\">"], ["<p className=\"text-sm text-muted\">{t(\"welcome_back\")}</p>", "<p className=\"text-sm text-muted max-md:text-[12px] max-md:leading-tight\">{t(\"welcome_back\")}</p>"], ["{user.name && <p className=\"truncate text-muted\" dir=\"ltr\">{user.email}</p>}", "{user.name && <p className=\"truncate text-muted max-md:text-[13px] max-md:leading-tight\" dir=\"ltr\">{user.email}</p>}"], ["className=\"mt-1 text-sm font-bold text-navy underline underline-offset-4 disabled:opacity-50\">", "className=\"mt-1 text-sm font-bold text-navy underline underline-offset-4 disabled:opacity-50 max-md:mt-0.5 max-md:text-[12.5px]\">"], ["className=\"relative grid size-12 flex-none place-items-center rounded-xl border-[1.5px] border-line text-navy transition-colors hover:border-navy\">", "className=\"relative grid size-12 flex-none place-items-center rounded-xl border-[1.5px] border-line text-navy transition-colors hover:border-navy max-md:size-10\">"], ["<ul className=\"grid gap-4 sm:grid-cols-3\" aria-label={t(\"account_settings_header\")}>", "<ul className=\"grid grid-cols-3 gap-4 max-md:!gap-2\" aria-label={t(\"account_settings_header\")}>"]]}, {"file": "apps/web-storefront/components/LoyaltyCard.tsx", "what": "phone: a shorter tier card on My account", "done": "max-md:px-3 max-md:py-2.5\" aria-labelledby=\"loy-h\"", "pairs": [["<section className=\"rounded-[14px] border border-line bg-white p-5\" aria-labelledby=\"loy-h\">", "<section className=\"rounded-[14px] border border-line bg-white p-5 max-md:px-3 max-md:py-2.5\" aria-labelledby=\"loy-h\">"], ["<div className=\"flex items-center gap-4\">", "<div className=\"flex items-center gap-4 max-md:gap-2.5\">"], ["<h2 id=\"loy-h\" className=\"text-lg font-bold\">", "<h2 id=\"loy-h\" className=\"text-lg font-bold max-md:text-[15px] max-md:leading-tight\">"], ["<p className=\"text-sm text-muted\">{tier.discountPercentage", "<p className=\"text-sm text-muted max-md:text-[12.5px] max-md:leading-tight\">{tier.discountPercentage"], ["        <div className=\"mt-4\">\n", "        <div className=\"mt-4 max-md:mt-2\">\n"], ["<p className=\"mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted\">", "<p className=\"mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted max-md:mt-1 max-md:text-[11px]\">"]]}]};
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
