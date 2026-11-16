#!/usr/bin/env node
/**
 * Website basket on a tablet and a PC (asked by the person): the order summary (total, Checkout) sits beside the parts from 768 px wide (a tablet too, before only
 * from 1024) and stays in view, 8 px under the header, while the parts scroll; it is released where the parts end. To fit beside it, a tablet shows
 * the parts as compact rows (as on a phone). Phone: as before. Run after patch-web-cart-gaps.
 *
 *   node scripts/patch-web-cart-summary-pin.js            dry run
 *   node scripts/patch-web-cart-summary-pin.js --write    applies it (the changed file is saved as <file>.before-patch-web-cart-summary-pin first)
 * Then: website: Ctrl+F5
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/cart/page.tsx", "what": "website basket on a tablet and a PC: the order summary beside the parts, staying in view while they scroll (compact part rows on a tablet)", "done": "stays in view while the parts scroll", "pairs": [["<div className=\"mb-2 flex items-center justify-between gap-2 lg:w-[calc((100%-0.5rem)*1.6/2.6)]\">", "<div className=\"mb-2 flex items-center justify-between gap-2 md:w-[calc((100%-0.5rem)*1.6/2.6)]\">", false], ["<div className=\"grid items-start gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]\">", "<div className=\"grid items-start gap-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]\">          {/* tablet and PC: the summary beside the parts */}", false], ["<aside className=\"rounded-[14px] border border-line bg-white p-3 sm:p-6\" aria-labelledby=\"cart-summary\">", "<aside className=\"rounded-[14px] border border-line bg-white p-3 sm:p-6 md:sticky md:top-[calc(var(--header-h,0px)+0.5rem)]\" aria-labelledby=\"cart-summary\">          {/* tablet and PC: stays in view while the parts scroll, 8 px under the header */}", false], ["const stepper = \"grid size-8 place-items-center text-base font-bold text-navy hover:bg-chalk sm:size-11 sm:text-lg disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent\";\n\nfunction Line({ item, onChange, onRemove, busy, selected, onToggle }: { item: CartItem; onChange: (q: number) => void; onRemove: (photo: HTMLElement | null, row: HTMLElement | null) => void; busy: boolean; selected: boolean; onToggle: () => void }) {\n  const t = useT();\n  const hint = stockHint(item);\n  const photo = useRef<HTMLAnchorElement>(null);\n  const fit = useCartFit(item.productId);          // does it fit the buyer's car: the ribbon on the photo and the line under the name\n  const row = useRef<HTMLLIElement>(null);\n  return (\n    <li ref={row} data-selected={selected} className={`grid grid-cols-[20px_64px_minmax(0,1fr)] items-start gap-2.5 border-b border-line py-2 transition-opacity last:border-b-0 sm:grid-cols-[24px_104px_minmax(0,1fr)_auto] sm:gap-4 sm:py-5 ${selected ? \"\" : \"opacity-55\"}`}>\n      <span className=\"self-center max-sm:col-start-1 max-sm:row-start-1\"><Tick checked={selected} label={`${t(\"cart_select_item\")}: ${item.name}`} onChange={onToggle} /></span>\n      <Link ref={photo} href={`/products/${item.productId}`} className=\"relative block h-16 overflow-hidden max-sm:col-start-2 max-sm:row-start-1 rounded-[10px] bg-[#e6edf2] sm:h-24 sm:rounded-xl\">\n        {item.imageUrl && <SafeImage src={resolveImageUrl(item.imageUrl)} alt=\"\" fill sizes=\"104px\" className=\"object-cover\" unoptimized />}\n        <FitRibbon fit={fit} />\n      </Link>\n      {/* On a phone: everything small, and the quantity, the bin and the price on one line (the price is drawn over the end of that line, see below). */}\n      <div className=\"flex min-w-0 flex-col max-sm:col-start-3 max-sm:row-start-1\">\n        <Link href={`/products/${item.productId}`} className=\"line-clamp-2 text-[13.5px] font-bold leading-tight hover:underline sm:text-[17px] sm:leading-snug\">{item.name}</Link>\n        {item.supplierName && <p className=\"truncate text-[11.5px] text-muted sm:mt-0.5 sm:text-sm\">{supplierLabel(item.supplierName, t(\"supplier_word\"))}</p>}\n        <div className=\"max-sm:[&_*]:text-[11.5px] max-sm:[&>*]:mt-0 max-sm:[&>p]:truncate\"><CartFitLine fit={fit} /></div>\n        {item.priceChanged && <p role=\"status\" className=\"text-[11.5px] font-semibold text-[#7a4e00] sm:mt-2 sm:text-sm\">{t(\"price_updated_since_added\")}</p>}\n        <div className=\"mt-1 flex items-center gap-1.5 max-sm:order-last sm:mt-3 sm:flex-wrap sm:gap-4\">\n          <div role=\"group\" aria-label={String(item.quantity)} className=\"inline-flex items-center rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white\">\n            <button type=\"button\" className={stepper} disabled={busy || item.quantity <= 1} onClick={() => onChange(item.quantity - 1)} aria-label={t(\"decrease_quantity\")}>−</button>\n            <span className=\"min-w-6 text-center text-sm font-bold sm:min-w-9 sm:text-base\" aria-live=\"polite\">{item.quantity}</span>\n            <button type=\"button\" className={stepper} disabled={busy || atStockLimit(item)} onClick={() => onChange(item.quantity + 1)} aria-label={t(\"increase_quantity\")}>+</button>\n          </div>\n          <button type=\"button\" onClick={() => onRemove(photo.current, row.current)} disabled={busy} aria-label={t(\"remove\")} title={t(\"remove\")} className=\"grid size-8 place-items-center rounded-lg text-[#a12a21] hover:bg-[#fbeceb] disabled:opacity-50 sm:size-11\">{TRASH}</button>\n        </div>\n        {hint && <p className=\"text-[11.5px] font-semibold text-[#7a4e00] sm:mt-2 sm:text-sm\">{hint.kind === \"limit\" ? t(\"cart_at_stock_limit\") : t(\"cart_only_left\", { n: hint.left })}</p>}\n      </div>\n      {/* phone: at the bottom end of the part, on the line of the quantity (the old price small above it); tablet and PC: its own column, as before */}\n      <div className=\"text-end max-sm:col-start-3 max-sm:row-start-1 max-sm:flex max-sm:flex-col-reverse max-sm:self-end max-sm:justify-self-end max-sm:pb-1 max-sm:leading-tight sm:col-span-1\">\n        <Price usd={lineTotal(item)} className=\"text-[15.5px] font-extrabold text-navy sm:text-xl\" />\n        {isOnSale(item) && <p className=\"text-[11px] text-muted line-through sm:text-sm\"><Price usd={(item.originalPrice as number) * item.quantity} /></p>}\n      </div>\n    </li>\n  );\n}\n\n// On a phone every part is a compact row (tablet and PC: as before); on every screen each quotation and the other parts are separate boxes (confirmed via mockups).\n", "const stepper = \"grid size-8 place-items-center text-base font-bold text-navy hover:bg-chalk lg:size-11 lg:text-lg disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent\";\n\nfunction Line({ item, onChange, onRemove, busy, selected, onToggle }: { item: CartItem; onChange: (q: number) => void; onRemove: (photo: HTMLElement | null, row: HTMLElement | null) => void; busy: boolean; selected: boolean; onToggle: () => void }) {\n  const t = useT();\n  const hint = stockHint(item);\n  const photo = useRef<HTMLAnchorElement>(null);\n  const fit = useCartFit(item.productId);          // does it fit the buyer's car: the ribbon on the photo and the line under the name\n  const row = useRef<HTMLLIElement>(null);\n  return (\n    <li ref={row} data-selected={selected} className={`grid grid-cols-[20px_64px_minmax(0,1fr)] items-start gap-2.5 border-b border-line py-2 transition-opacity last:border-b-0 lg:grid-cols-[24px_104px_minmax(0,1fr)_auto] lg:gap-4 lg:py-5 ${selected ? \"\" : \"opacity-55\"}`}>\n      <span className=\"self-center max-lg:col-start-1 max-lg:row-start-1\"><Tick checked={selected} label={`${t(\"cart_select_item\")}: ${item.name}`} onChange={onToggle} /></span>\n      <Link ref={photo} href={`/products/${item.productId}`} className=\"relative block h-16 overflow-hidden max-lg:col-start-2 max-lg:row-start-1 rounded-[10px] bg-[#e6edf2] lg:h-24 lg:rounded-xl\">\n        {item.imageUrl && <SafeImage src={resolveImageUrl(item.imageUrl)} alt=\"\" fill sizes=\"104px\" className=\"object-cover\" unoptimized />}\n        <FitRibbon fit={fit} />\n      </Link>\n      {/* On a phone and a tablet (the summary is beside the parts there): everything small, and the quantity, the bin and the price on one line (the price is drawn over the end of that line, see below). */}\n      <div className=\"flex min-w-0 flex-col max-lg:col-start-3 max-lg:row-start-1\">\n        <Link href={`/products/${item.productId}`} className=\"line-clamp-2 text-[13.5px] font-bold leading-tight hover:underline lg:text-[17px] lg:leading-snug\">{item.name}</Link>\n        {item.supplierName && <p className=\"truncate text-[11.5px] text-muted lg:mt-0.5 lg:text-sm\">{supplierLabel(item.supplierName, t(\"supplier_word\"))}</p>}\n        <div className=\"max-lg:[&_*]:text-[11.5px] max-lg:[&>*]:mt-0 max-lg:[&>p]:truncate\"><CartFitLine fit={fit} /></div>\n        {item.priceChanged && <p role=\"status\" className=\"text-[11.5px] font-semibold text-[#7a4e00] lg:mt-2 lg:text-sm\">{t(\"price_updated_since_added\")}</p>}\n        <div className=\"mt-1 flex items-center gap-1.5 max-lg:order-last lg:mt-3 lg:flex-wrap lg:gap-4\">\n          <div role=\"group\" aria-label={String(item.quantity)} className=\"inline-flex items-center rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white\">\n            <button type=\"button\" className={stepper} disabled={busy || item.quantity <= 1} onClick={() => onChange(item.quantity - 1)} aria-label={t(\"decrease_quantity\")}>−</button>\n            <span className=\"min-w-6 text-center text-sm font-bold lg:min-w-9 lg:text-base\" aria-live=\"polite\">{item.quantity}</span>\n            <button type=\"button\" className={stepper} disabled={busy || atStockLimit(item)} onClick={() => onChange(item.quantity + 1)} aria-label={t(\"increase_quantity\")}>+</button>\n          </div>\n          <button type=\"button\" onClick={() => onRemove(photo.current, row.current)} disabled={busy} aria-label={t(\"remove\")} title={t(\"remove\")} className=\"grid size-8 place-items-center rounded-lg text-[#a12a21] hover:bg-[#fbeceb] disabled:opacity-50 lg:size-11\">{TRASH}</button>\n        </div>\n        {hint && <p className=\"text-[11.5px] font-semibold text-[#7a4e00] lg:mt-2 lg:text-sm\">{hint.kind === \"limit\" ? t(\"cart_at_stock_limit\") : t(\"cart_only_left\", { n: hint.left })}</p>}\n      </div>\n      {/* phone: at the bottom end of the part, on the line of the quantity (the old price small above it); tablet and PC: its own column, as before */}\n      <div className=\"text-end max-lg:col-start-3 max-lg:row-start-1 max-lg:flex max-lg:flex-col-reverse max-lg:self-end max-lg:justify-self-end max-lg:pb-1 max-lg:leading-tight lg:col-span-1\">\n        <Price usd={lineTotal(item)} className=\"text-[15.5px] font-extrabold text-navy lg:text-xl\" />\n        {isOnSale(item) && <p className=\"text-[11px] text-muted line-through lg:text-sm\"><Price usd={(item.originalPrice as number) * item.quantity} /></p>}\n      </div>\n    </li>\n  );\n}\n\n// On a phone every part is a compact row (tablet and PC: as before); on every screen each quotation and the other parts are separate boxes (confirmed via mockups).\n", false], ["// On a phone every part is a compact row (tablet and PC: as before)", "// On a phone and a tablet every part is a compact row (PC: as before)", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-cart-summary-pin`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
