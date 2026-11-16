#!/usr/bin/env node
/**
 * Storefront product page: the name and the description, redesigned (option 6 "Navy title band", confirmed with the person via mockup).
 *  - The name in a navy band: the part's name large in white; the car it fits and the versions with the years under it in soft blue;
 *    the part number in a gold pill. English and Arabic.
 *  - The description: 3 lines, then "Read more" / "Show less" (اقرأ المزيد / عرض أقل); nothing extra when it fits in 3 lines.
 *  - The two page tests that list the column's blocks now expect "Read more" after the description.
 * Storefront only (no API change).
 *   node scripts/patch-product-name-band.js            dry run
 *   node scripts/patch-product-name-band.js --write    applies it
 */
const DATA = {"created": [{"file": "apps/web-storefront/components/ProductNameBand.tsx", "what": "the product name in a navy band", "text": "import type { Lang } from \"@/lib/i18n\";\n\n/**\n * The product page's name in a navy band (patch-product-name-band, option 6 \"Navy title band\", confirmed with the person via mockup):\n *   the part's name large in white; under it the car it fits and the versions with the years, in soft blue; the part number in a gold pill.\n * The parts come from the server's fitTitle (patch-name-car-part). Without it (an older server) the plain name is shown, with the part number\n * when the product has one.\n */\nexport interface NameBandTitle {\n  name: string;\n  partNumber?: string | null;\n  allCars?: boolean;\n  brand?: string | null;\n  model?: string | null;\n  allVersions?: boolean;\n  versions?: string[];\n  versionCount?: number;\n  yearFrom?: number | null;\n  yearTo?: number | null;\n  moreCars?: number;\n}\n\nconst WORDS = {\n  en: { allVersions: \"All versions\", allCars: \"All cars\", versions: (n: number) => `${n} versions`, more: (n: number) => (n === 1 ? \"+ 1 more car\" : `+ ${n} more cars`), pn: \"Part No.\" },\n  ar: { allVersions: \"جميع الفئات\", allCars: \"جميع السيارات\", versions: (n: number) => `${n} فئات`, more: (n: number) => (n === 1 ? \"+ سيارة أخرى\" : n === 2 ? \"+ سيارتان أخريان\" : `+ ${n} سيارات أخرى`), pn: \"رقم القطعة\" },\n};\n\nexport function nameBandParts(title: NameBandTitle | null | undefined, name: string, lang: Lang, fallbackPartNumber?: string | null) {\n  const w = WORDS[lang === \"ar\" ? \"ar\" : \"en\"];\n  const pn = (title ? title.partNumber : fallbackPartNumber)?.trim() || null;\n  if (!title) return { name, car: null as string | null, years: null as string | null, more: null as string | null, pn };\n  let car: string | null = null;\n  let years: string | null = null;\n  let more: string | null = null;\n  if (title.allCars) car = w.allCars;\n  else if (title.brand || title.model) {\n    const listed = title.versions ?? [];\n    const count = title.versionCount ?? listed.length;\n    const version = title.allVersions || count === 0 ? w.allVersions : count > listed.length ? w.versions(count) : listed.join(\" / \");\n    car = `${[title.brand, title.model].filter(Boolean).join(\" \")} · ${version}`;\n    if (title.yearFrom) years = title.yearTo && title.yearTo !== title.yearFrom ? `(${title.yearFrom}–${title.yearTo})` : `(${title.yearFrom})`;\n    if ((title.moreCars ?? 0) > 0) more = w.more(title.moreCars!);\n  }\n  return { name: title.name || name, car, years, more, pn };\n}\n\nexport default function ProductNameBand({ title, name, lang, partNumber }: { title?: NameBandTitle | null; name: string; lang: Lang; partNumber?: string | null }) {\n  const p = nameBandParts(title, name, lang, partNumber);\n  const w = WORDS[lang === \"ar\" ? \"ar\" : \"en\"];\n  return (\n    <>\n      <span data-testid=\"name-band-name\" className=\"block text-[22px] font-bold leading-[1.3] tracking-tight text-white lg:text-[27px]\">{p.name}</span>\n      {p.car && (\n        <span data-testid=\"name-band-car\" className=\"mt-1.5 block text-[15px] font-medium leading-snug text-[#9fb4c3]\">\n          {p.car}\n          {p.years && <> <bdi dir=\"ltr\" className=\"whitespace-nowrap\">{p.years}</bdi></>}\n          {p.more && <> · {p.more}</>}\n        </span>\n      )}\n      {p.pn && (\n        <span data-testid=\"name-band-pn\" className=\"mt-3 inline-flex items-center gap-1.5 rounded-full bg-signal px-3 py-1 text-[13px] font-bold leading-5 text-on-signal\">\n          <span>{w.pn}</span>\n          <bdi dir=\"ltr\" className=\"font-plate\">{p.pn}</bdi>\n        </span>\n      )}\n    </>\n  );\n}\n"}, {"file": "apps/web-storefront/components/DescriptionMore.tsx", "what": "\"Read more\" under the description", "text": "\"use client\";\n\nimport { useEffect, useState } from \"react\";\nimport type { Lang } from \"@/lib/i18n\";\n\n/**\n * \"Read more\" under the product's description (patch-product-name-band): the description shows 3 lines; when it is longer, this button opens\n * it in full and \"Show less\" closes it again. Nothing shows when the description fits in 3 lines.\n */\nconst WORDS = { en: { more: \"Read more\", less: \"Show less\" }, ar: { more: \"اقرأ المزيد\", less: \"عرض أقل\" } };\nconst CLAMP = \"line-clamp-3\";\n\nexport default function DescriptionMore({ targetId, lang }: { targetId: string; lang: Lang }) {\n  const [long, setLong] = useState(false);\n  const [open, setOpen] = useState(false);\n  useEffect(() => {\n    const el = document.getElementById(targetId);\n    if (!el) return;\n    const check = () => { if (el.classList.contains(CLAMP)) setLong(el.scrollHeight > el.clientHeight + 1); };\n    check();\n    const ro = typeof ResizeObserver !== \"undefined\" ? new ResizeObserver(check) : null;\n    ro?.observe(el);\n    return () => ro?.disconnect();\n  }, [targetId]);\n  if (!long) return null;\n  const w = WORDS[lang === \"ar\" ? \"ar\" : \"en\"];\n  const toggle = () => {\n    const el = document.getElementById(targetId);\n    if (!el) return;\n    const next = !open;\n    el.classList.toggle(CLAMP, !next);\n    setOpen(next);\n  };\n  return (\n    <button type=\"button\" data-testid=\"description-more\" aria-controls={targetId} aria-expanded={open} onClick={toggle}\n      className=\"mt-1 self-start text-[14px] font-bold text-navy underline decoration-signal decoration-2 underline-offset-4 hover:text-navy-deep md:!-mt-3\">\n      {open ? w.less : w.more}\n    </button>\n  );\n}\n"}], "replaced": [], "anchored": [{"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "Product page: the name in a navy band (part number in a gold pill); the description 3 lines with \"Read more\"", "done": "patch-product-name-band: the name in a navy band", "pairs": [[[["import ProductTitle from \"@/components/ProductTitle\";\n", "import ProductNameBand, { type NameBandTitle } from \"@/components/ProductNameBand\";\nimport DescriptionMore from \"@/components/DescriptionMore\";\n"], ["import ProductChips from \"@/components/ProductChips\";\n", "import ProductChips from \"@/components/ProductChips\";\nimport ProductNameBand, { type NameBandTitle } from \"@/components/ProductNameBand\";\nimport DescriptionMore from \"@/components/DescriptionMore\";\n"]], null, "alts"], [[["          <h1 className=\"font-display font-bold text-[20px] leading-[1.45] tracking-tight [overflow-wrap:anywhere] lg:text-[26px]\">\n            <ProductTitle title={product.fitTitle} name={product.name} lang={lang} variant=\"full\" />\n          </h1>", "          {/* patch-product-name-band: the name in a navy band (option 6, confirmed with the person via mockup): the part's name large in white, the car\n              and versions with the years under it, the part number in a gold pill. */}\n          <h1 title={product.name} className=\"font-display rounded-2xl bg-[linear-gradient(160deg,#1f5574_-30%,#0b3146_45%,#07202f_100%)] px-4 py-4 text-white shadow-[0_3px_6px_rgba(11,49,70,0.2),0_10px_24px_rgba(11,49,70,0.14)] [overflow-wrap:anywhere] sm:px-5 sm:py-[18px]\">\n            <ProductNameBand title={(product as { fitTitle?: NameBandTitle | null }).fitTitle} name={product.name} lang={lang} partNumber={product.oemNumber} />\n          </h1>"], ["          <h1 title={product.name} className=\"font-display line-clamp-2 font-bold text-[20px] leading-[1.45] tracking-tight [overflow-wrap:anywhere] lg:text-[26px]\">\n            {product.name}\n          </h1>", "          {/* patch-product-name-band: the name in a navy band (option 6, confirmed with the person via mockup): the part's name large in white, the car\n              and versions with the years under it, the part number in a gold pill. */}\n          <h1 title={product.name} className=\"font-display rounded-2xl bg-[linear-gradient(160deg,#1f5574_-30%,#0b3146_45%,#07202f_100%)] px-4 py-4 text-white shadow-[0_3px_6px_rgba(11,49,70,0.2),0_10px_24px_rgba(11,49,70,0.14)] [overflow-wrap:anywhere] sm:px-5 sm:py-[18px]\">\n            <ProductNameBand title={(product as { fitTitle?: NameBandTitle | null }).fitTitle} name={product.name} lang={lang} partNumber={product.oemNumber} />\n          </h1>"]], null, "alts"], ["            <p data-testid=\"product-summary\" className=\"mt-2 whitespace-pre-line text-base leading-relaxed text-ink/80 [overflow-wrap:anywhere]\">{product.description.trim()}</p>\n          )}", "            <p id=\"product-summary\" data-testid=\"product-summary\" className=\"mt-2 line-clamp-3 whitespace-pre-line text-base leading-relaxed text-ink/80 [overflow-wrap:anywhere]\">{product.description.trim()}</p>\n          )}\n          {/* 3 lines, then \"Read more\" (patch-product-name-band) */}\n          {product.description?.trim() && <DescriptionMore targetId=\"product-summary\" lang={lang} />}", false]]}, {"file": "apps/web-storefront/app/productDescription.test.tsx", "what": "Description test: \"Read more\" comes right after the description", "done": "DescriptionMore, \"div\", StockBanner", "optional": true, "pairs": [["import PriceBlock from \"@/components/PriceBlock\";\n", "import PriceBlock from \"@/components/PriceBlock\";\nimport DescriptionMore from \"@/components/DescriptionMore\";      // patch-product-name-band\n", false], ["expect(types).toEqual([\"h1\", \"p\", \"div\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", "expect(types).toEqual([\"h1\", \"p\", DescriptionMore, \"div\", StockBanner, SellerSignals, PriceBlock, \"div\"]);", false]]}, {"file": "apps/web-storefront/app/productFits.test.tsx", "what": "Fits test: \"Read more\" comes right after the description", "done": ".slice(0, 4)).toEqual([\"h1\", \"p\", DescriptionMore, \"div\"])", "optional": true, "pairs": [[".slice(0, 3)).toEqual([\"h1\", \"p\", \"div\"]); });", ".slice(0, 4)).toEqual([\"h1\", \"p\", DescriptionMore, \"div\"]); });", false], ["import { describe", "import DescriptionMore from \"@/components/DescriptionMore\";      // patch-product-name-band\nimport { describe", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-product-name-band`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log("\nDone. In apps\\web-storefront, restart npm run dev (or rebuild), then open a product page.");
