#!/usr/bin/env node
/**
 * Website product cards on a phone (confirmed with the person via mockup); tablet and PC stay as they are. Under the photo, each in its own place, at the same
 * height in every card: the name (two lines, then "..."), the stars only (no number of reviews; none = five grey stars), the stock in its green or red box, the
 * delivery date, the price with the add-to-cart icon on the same line, the discount (-% and the old price struck through; off the photo). A line a card does not
 * have keeps its place. The OEM number is not shown on a phone. Smaller text and padding: each card about a quarter shorter.
 *
 *   node scripts/patch-web-product-card-phone.js            dry run
 *   node scripts/patch-web-product-card-phone.js --write    applies it (the changed file is saved as <file>.before-patch-web-product-card-phone first)
 * Then: website: Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/components/ProductCard.tsx", "what": "website product cards on a phone: compact, every line in its own place (name, stars, stock box, delivery, price with add-to-cart, discount)", "done": "every line in its own place, the same in every card", "pairs": [["          {percent !== null && <span data-testid=\"discount-tag\" aria-label={t(lang, \"percent_off\", { n: percent })} className={`absolute end-2.5 top-2.5 rounded-lg", "          {percent !== null && <span data-testid=\"discount-tag\" aria-label={t(lang, \"percent_off\", { n: percent })} className={`absolute end-2.5 top-2.5 max-md:hidden rounded-lg", false], ["        <div className=\"flex flex-1 flex-col gap-2 p-4\">\n          <h3 className=\"line-clamp-2 text-base font-bold leading-snug\">{p.name}</h3>\n          {p.oemNumber && <p className=\"font-plate text-[13px] text-muted\">{p.oemNumber}</p>}\n          <CardReviews rating={p.rating} count={p.reviewCount} lang={lang} />\n          <p className=\"flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted\">\n            <span data-testid=\"stock-box\" data-stock={inStock ? \"in\" : \"out\"} className={`rounded-md px-2.5 py-0.5 text-[12.5px] font-bold text-white ${inStock ? \"bg-[#0f6b49]\" : \"bg-[#c62f26]\"}`}>{t(lang, inStock ? \"in_stock\" : \"out_of_stock\")}</span>\n            {delivery ? <span>{delivery}</span> : null}\n          </p>\n          <p className=\"mt-auto flex flex-wrap items-baseline gap-x-2 pt-3 pe-14\">\n            <span className=\"text-[22px] font-extrabold text-navy\"><Price usd={p.price} /></span>\n            {percent !== null && p.originalPrice != null && <del className=\"text-sm text-muted\"><Price usd={p.originalPrice} /></del>}\n          </p>\n        </div>", "        {/* a phone (confirmed with the person via mockup): every line in its own place, the same in every card: the name (2 lines), the stars, the stock box,\n            the delivery date, the price with the add-to-cart icon, the discount; a line a card does not have keeps its place, so the cards line up */}\n        <div className=\"flex flex-1 flex-col gap-2 p-4 max-md:grid max-md:flex-none max-md:grid-rows-[33px_16px_20px_16px_32px_16px] max-md:gap-[3px] max-md:p-2\">\n          <h3 className=\"line-clamp-2 text-base font-bold leading-snug max-md:text-[13px] max-md:leading-[16.5px]\">{p.name}</h3>\n          {p.oemNumber && <p className=\"font-plate text-[13px] text-muted max-md:hidden\">{p.oemNumber}</p>}\n          <CardReviews rating={p.rating} count={p.reviewCount} lang={lang} />\n          <p className=\"flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted max-md:contents\">\n            <span data-testid=\"stock-box\" data-stock={inStock ? \"in\" : \"out\"} className={`rounded-md px-2.5 py-0.5 text-[12.5px] font-bold text-white max-md:self-center max-md:justify-self-start max-md:rounded-[5px] max-md:px-[7px] max-md:text-[11px] ${inStock ? \"bg-[#0f6b49]\" : \"bg-[#c62f26]\"}`}>{t(lang, inStock ? \"in_stock\" : \"out_of_stock\")}</span>\n            {delivery ? <span className=\"max-md:truncate max-md:text-[11.5px] max-md:leading-4\">{delivery}</span> : <span aria-hidden=\"true\" className=\"md:hidden\">&nbsp;</span>}\n          </p>\n          <p className=\"mt-auto flex flex-wrap items-baseline gap-x-2 pt-3 pe-14 max-md:contents\">\n            <span className=\"text-[22px] font-extrabold text-navy max-md:self-center max-md:pe-10 max-md:text-base\"><Price usd={p.price} /></span>\n            {percent !== null && p.originalPrice != null ? (\n              <span className=\"inline-flex items-baseline gap-1.5 max-md:items-center max-md:text-[11.5px]\">\n                <span aria-hidden=\"true\" className={`rounded-[5px] px-[5px] text-[11px] font-extrabold leading-4 md:hidden ${cardDiscountTagClasses(percent)}`}><bdi dir=\"ltr\">-{percent}%</bdi></span>\n                <del className=\"text-sm text-muted max-md:text-[11.5px]\"><Price usd={p.originalPrice} /></del>\n              </span>\n            ) : <span aria-hidden=\"true\" className=\"md:hidden\">&nbsp;</span>}\n          </p>\n        </div>", false], ["      <div className=\"absolute bottom-4 end-4\"><CardAddToCart", "      <div className=\"absolute bottom-4 end-4 max-md:bottom-[27px] max-md:end-2 max-md:[&_button]:size-8 max-md:[&_button]:rounded-[9px] max-md:[&_svg]:size-4\"><CardAddToCart", false], ["    return (\n      <p data-testid=\"card-reviews\" className=\"flex items-center gap-1.5 text-[13px] text-muted\">\n        <CardStar filled={false} />\n        <span>{t(lang, \"card_no_reviews\")}</span>\n      </p>\n    );", "    return (\n      <p data-testid=\"card-reviews\" className=\"flex items-center gap-1.5 text-[13px] text-muted max-md:h-4\">\n        <span className=\"contents max-md:hidden\"><CardStar filled={false} /></span>\n        <span className=\"max-md:hidden\">{t(lang, \"card_no_reviews\")}</span>\n        {/* a phone: five grey stars, no words */}\n        <span className=\"flex md:hidden\" aria-hidden=\"true\">{[0, 1, 2, 3, 4].map((i) => <CardStar key={i} filled={false} />)}</span>\n      </p>\n    );", false], ["    <p data-testid=\"card-reviews\" className=\"flex items-center gap-1.5 text-[13px] text-muted\">\n      <span className=\"flex\" aria-hidden=\"true\">{[0, 1, 2, 3, 4].map((i) => <CardStar key={i} filled={i < r.fullStars} />)}</span>\n      <bdi dir=\"ltr\" className=\"font-bold text-navy\">{r.average}</bdi>\n      <span>(", "    <p data-testid=\"card-reviews\" className=\"flex items-center gap-1.5 text-[13px] text-muted max-md:h-4\">\n      <span className=\"flex\" aria-hidden=\"true\">{[0, 1, 2, 3, 4].map((i) => <CardStar key={i} filled={i < r.fullStars} />)}</span>\n      {/* a phone: the stars only */}\n      <bdi dir=\"ltr\" className=\"font-bold text-navy max-md:hidden\">{r.average}</bdi>\n      <span className=\"max-md:hidden\">(", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-product-card-phone`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
