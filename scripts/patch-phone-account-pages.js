#!/usr/bin/env node
/**
 * Storefront on a phone (under 768 px), six My account pages (confirmed with the person via mockup). Tablets and computers are unchanged.
 *  1. Orders & returns: Active shipments and the year's spend side by side.
 *  2. Addresses: each address in 2 columns (the street over both).
 *  3. My garage: only the ring (2/5) in the title box; "2 of 5 · cars saved" is not shown on a phone.
 *  4. Wishlist, Compare: "Share" beside the Saved parts | Compare tabs (computers keep "Share comparison" in the title box).
 *  5. Refer a friend: every box shorter; People referred and Rewards earned side by side.
 *  6. Contact us: the icon beside the words in both cards.
 *
 *   node scripts/patch-phone-account-pages.js            dry run
 *   node scripts/patch-phone-account-pages.js --write    applies it (each changed file is saved as <file>.before-phone-account-pages first)
 * Then: Ctrl+F5 on the phone. No server change.
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/app/orders/page.tsx", "what": "phone: Orders & returns, Active shipments and spend side by side", "done": "<div className=\"mb-6 grid grid-cols-2 gap-4 max-md:gap-2\">", "pairs": [["<div className=\"mb-6 grid gap-4 sm:grid-cols-2\">", "<div className=\"mb-6 grid grid-cols-2 gap-4 max-md:gap-2\">"], ["<div className=\"rounded-[14px] border border-line bg-white p-5\"><p className=\"text-3xl font-extrabold", "<div className=\"rounded-[14px] border border-line bg-white p-5 max-md:p-3\"><p className=\"text-3xl font-extrabold max-md:text-xl", true], ["<p className=\"text-sm font-semibold text-muted\">{t(\"active_shipments\")}</p>", "<p className=\"text-sm font-semibold text-muted max-md:text-[12px]\">{t(\"active_shipments\")}</p>", "maybe"], ["<p className=\"text-sm font-semibold uppercase text-muted\">", "<p className=\"text-sm font-semibold uppercase text-muted max-md:text-[12px]\">", "maybe"]]}, {"file": "apps/web-storefront/app/addresses/page.tsx", "what": "phone: each address in 2 columns", "done": "<dl className=\"grid grid-cols-2", "pairs": [["<div className={wide ? \"md:col-span-2\" : undefined}>", "<div className={wide ? \"col-span-2\" : undefined}>"], ["<dl className=\"grid gap-x-5 gap-y-3 px-4 py-4 sm:grid-cols-2 md:grid-cols-3\">", "<dl className=\"grid grid-cols-2 gap-x-5 gap-y-3 px-4 py-4 max-md:gap-x-3 md:grid-cols-3\">"]]}, {"file": "apps/web-storefront/components/GarageMeter.tsx", "what": "phone: My garage shows only its ring", "done": "<span aria-hidden=\"true\" className=\"max-md:hidden\">", "pairs": [["<span className=\"relative block size-16\">", "<span className=\"relative block size-16 max-md:size-11\">"], ["className=\"rtl:-scale-x-100\">", "className=\"rtl:-scale-x-100 max-md:size-11\">"], ["absolute inset-0 flex items-center justify-center text-base font-extrabold", "absolute inset-0 flex items-center justify-center text-base font-extrabold max-md:text-[11.5px]"], ["      <span aria-hidden=\"true\">\n        <span className=\"block font-extrabold", "      <span aria-hidden=\"true\" className=\"max-md:hidden\">\n        <span className=\"block font-extrabold"]]}, {"file": "apps/web-storefront/app/compare/page.tsx", "what": "phone: a place for Share beside the Wishlist tabs", "done": "id=\"compare-tab-actions\"", "pairs": [["<div className=\"mb-3\"><WishlistTabs active=\"compare\" compareCount={found.length} /></div>", "<div className=\"mb-3 flex flex-wrap items-center gap-2\"><WishlistTabs active=\"compare\" compareCount={found.length} /><div id=\"compare-tab-actions\" className=\"contents md:hidden\" /></div>"]]}, {"file": "apps/web-storefront/components/CompareActions.tsx", "what": "phone: Share beside the Wishlist tabs", "done": "getElementById(\"compare-tab-actions\")", "pairs": [["  useEffect(() => { setSlot(document.getElementById(\"account-header-actions\")); }, []);", "  // a phone: beside the Wishlist tabs; a computer: in the navy box at the top\n  useEffect(() => { const phone = typeof window.matchMedia === \"function\" && window.matchMedia(\"(max-width: 767px)\").matches; setSlot((phone && document.getElementById(\"compare-tab-actions\")) || document.getElementById(\"account-header-actions\")); }, []);"], ["<button type=\"button\" onClick={share} className=\"inline-flex min-h-10 items-center rounded-[10px] bg-signal px-4 text-sm font-bold text-on-signal hover:bg-signal-dark\">{copied ? `\u2713 ${t(\"link_copied\")}` : t(\"compare_share\")}</button>", "<button type=\"button\" onClick={share} aria-label={t(\"compare_share\")} className=\"inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-signal px-4 text-sm font-bold text-on-signal hover:bg-signal-dark max-md:px-3\">{copied ? `\u2713 ${t(\"link_copied\")}` : <><svg aria-hidden=\"true\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className=\"md:hidden\"><path d=\"M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13\" /></svg><span className=\"max-md:hidden\">{t(\"compare_share\")}</span><span className=\"md:hidden\">{t(\"share\")}</span></>}</button>"]]}, {"file": "apps/web-storefront/components/WishlistTabs.tsx", "what": "phone: the Wishlist tabs a little narrower", "done": "font-extrabold max-md:px-3 ${on", "pairs": [["rounded-[9px] px-4 text-[13.5px] font-extrabold ${on", "rounded-[9px] px-4 text-[13.5px] font-extrabold max-md:px-3 ${on"]]}, {"file": "apps/web-storefront/app/referrals/page.tsx", "what": "phone: Refer a friend, every box shorter", "done": "max-md:border-t-4 max-md:p-3.5", "pairs": [["<section className=\"rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6\" aria-labelledby=\"ref-code\">", "<section className=\"rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6 max-md:border-t-4 max-md:p-3.5\" aria-labelledby=\"ref-code\">"], ["<p className=\"my-2 font-plate text-3xl font-bold tracking-widest text-navy\" dir=\"ltr\">", "<p className=\"my-2 font-plate text-3xl font-bold tracking-widest text-navy max-md:my-1 max-md:text-2xl\" dir=\"ltr\">"], ["<p aria-live=\"polite\" className=\"mt-3 min-h-5 text-sm font-semibold text-[#0f6b49]\">", "<p aria-live=\"polite\" className=\"mt-3 min-h-5 text-sm font-semibold text-[#0f6b49] max-md:mt-1 max-md:min-h-0\">"], ["<ul className=\"grid gap-4 sm:grid-cols-2\">", "<ul className=\"grid grid-cols-2 gap-4\">"], ["<li className=\"rounded-[14px] border border-line bg-white p-5\"><p className=\"text-3xl font-extrabold text-navy\">", "<li className=\"rounded-[14px] border border-line bg-white p-5 max-md:p-3\"><p className=\"text-3xl font-extrabold text-navy max-md:text-xl\">", true], ["<span className=\"text-lg font-semibold text-muted\"> / ", "<span className=\"text-lg font-semibold text-muted max-md:text-sm\"> / "], ["<section aria-labelledby=\"ref-history\" className=\"rounded-[14px] border border-line bg-white p-5\">", "<section aria-labelledby=\"ref-history\" className=\"rounded-[14px] border border-line bg-white p-5 max-md:p-3.5\">"], ["<h2 id=\"ref-history\" className=\"mb-3 text-lg font-bold\">", "<h2 id=\"ref-history\" className=\"mb-3 text-lg font-bold max-md:mb-2 max-md:text-base\">"]]}, {"file": "apps/web-storefront/app/contact/page.tsx", "what": "phone: Contact us, the icon beside the words", "done": "max-md:flex-row max-md:items-center", "pairs": [["className=\"group flex w-full flex-col items-start gap-2 rounded-[16px] border border-line bg-white p-5 transition-colors hover:border-navy\"", "className=\"group flex w-full flex-col items-start gap-2 rounded-[16px] border border-line bg-white p-5 transition-colors hover:border-navy max-md:flex-row max-md:items-center max-md:gap-3 max-md:p-4\""], ["className=\"mb-1 mt-0.5 grid size-12 place-items-center rounded-full bg-white text-navy ring-[3px] ring-signal\"", "className=\"mb-1 mt-0.5 grid size-12 flex-none place-items-center rounded-full bg-white text-navy ring-[3px] ring-signal max-md:m-0 max-md:size-11\""], ["<span className=\"block text-[17px] font-bold text-navy\">", "<span className=\"flex w-full min-w-0 flex-1 flex-col items-start gap-2 max-md:gap-0.5\"><span className=\"block text-[17px] font-bold text-navy max-md:text-[15.5px]\">"], ["<span className=\"block text-sm text-muted\">", "<span className=\"block text-sm text-muted max-md:text-[13px] max-md:leading-snug\">"], ["<span className=\"mt-auto pt-1 text-sm font-extrabold text-[#8a6100] group-hover:underline\">", "<span className=\"mt-auto pt-1 text-sm font-extrabold text-[#8a6100] group-hover:underline max-md:pt-0.5\">"], ["rtl:rotate-180\">\u2192</span></span>\n", "rtl:rotate-180\">\u2192</span></span></span>\n"]]}]};
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
    for (const [a, b, all] of e.pairs) { if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; } if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
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
