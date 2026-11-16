#!/usr/bin/env node
/**
 * Website on a PHONE: the quotation page fits the screen's width (confirmed with the person via mockup). Its parts table needed 560 px and pushed the whole
 * page wider than the phone. Now, on a phone, each part is a small card (name and total; OEM, seller, valid until, quantity x price); the boxes, the link,
 * the totals, the QR note and Who pays fit the width, and long text wraps. Copy the link and Share sit side by side, Download PDF under them.
 * The tablet, the PC and the printed PDF keep the table. Also fits the public check page (/q/...), which shows the same quotation.
 *
 *   node scripts/patch-web-quote-fit-phone.js            dry run
 *   node scripts/patch-web-quote-fit-phone.js --write    applies it (each changed file is saved as <file>.before-patch-web-quote-fit-phone first)
 * Then: website: Ctrl+F5
 */
const DATA = {"created": [], "anchored": [{"file": "apps/web-storefront/components/QuotationDocument.tsx", "what": "website, the quotation: on a phone each part is a small card, and every box fits the width (tablet, PC and the PDF keep the table)", "done": "data-testid=\"quotation-parts-cards\"", "pairs": [["        <div className=\"rounded-lg bg-[#f6f8fa] px-3 py-2\"><dt className=\"text-[11px] font-bold text-muted\">{t(\"quote_car\")}</dt><dd className=\"font-semibold\">", "        <div className=\"rounded-lg bg-[#f6f8fa] px-3 py-2\"><dt className=\"text-[11px] font-bold text-muted\">{t(\"quote_car\")}</dt><dd className=\"font-semibold [overflow-wrap:anywhere]\">", false], ["        <div className=\"rounded-lg bg-[#f6f8fa] px-3 py-2\"><dt className=\"text-[11px] font-bold text-muted\">{t(\"quote_for_label\")} · {t(PARTY_KEY[quote.party.type])}</dt><dd className=\"font-semibold\">", "        <div className=\"rounded-lg bg-[#f6f8fa] px-3 py-2\"><dt className=\"text-[11px] font-bold text-muted\">{t(\"quote_for_label\")} · {t(PARTY_KEY[quote.party.type])}</dt><dd className=\"font-semibold [overflow-wrap:anywhere]\">", false], ["      <div className=\"mt-4 overflow-x-auto\">\n        <table className=\"w-full min-w-[560px] border-collapse\">", "      {/* a phone (not the printed PDF): each part as a small card, so the quotation fits the screen's width */}\n      {!print && (\n        <ul data-testid=\"quotation-parts-cards\" className=\"mt-4 grid gap-2 sm:hidden\">\n          {quote.items.map((i) => (\n            <li key={i.productId} className=\"rounded-[10px] border border-[#eef0f3] px-3 py-2.5\">\n              <p className=\"flex items-start justify-between gap-3 font-bold\"><span className=\"min-w-0 [overflow-wrap:anywhere]\"><bdi>{i.name}</bdi></span><span className=\"whitespace-nowrap\">{money(i.totalUsd)}</span></p>\n              <p className=\"mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted\">\n                {i.oemNumber && <span dir=\"ltr\">OEM {i.oemNumber}</span>}\n                {i.seller && <span dir=\"ltr\">{i.seller}</span>}\n                <span>{t(\"quote_col_valid\")} {date(i.validUntil)}</span>\n                <span className=\"whitespace-nowrap\">{i.quantity} × {money(i.unitPriceUsd)}</span>\n              </p>\n              {!i.inStock && <p className=\"text-[11px] font-semibold text-[#a12a21]\">{t(\"quote_out_of_stock_day\")}</p>}\n            </li>\n          ))}\n        </ul>\n      )}\n      <div className={`mt-4 overflow-x-auto ${print ? \"\" : \"max-sm:hidden\"}`}>\n        <table className=\"w-full min-w-[560px] border-collapse\">", false], ["        <div className=\"flex max-w-[330px] items-center gap-3\">", "        <div className=\"flex min-w-0 max-w-[330px] items-center gap-3\">", false], ["<p className=\"text-[12px] text-muted\">{t(\"quote_verify_note\",", "<p className=\"min-w-0 text-[12px] text-muted [overflow-wrap:anywhere]\">{t(\"quote_verify_note\",", false], ["        <dl className=\"min-w-[250px] flex-1 sm:max-w-[320px]\">", "        <dl className=\"min-w-0 flex-1 basis-full sm:min-w-[250px] sm:basis-auto sm:max-w-[320px]\">", false]]}, {"file": "apps/web-storefront/app/quotations/[id]/page.tsx", "what": "website, a quotation (phone): nothing grows wider than the screen; the link, then Copy + Share side by side, then Download PDF", "done": "[&>*]:min-w-0: nothing in it may grow wider than the screen", "pairs": [["const outline = \"inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50\";", "const outline = \"inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50 max-sm:flex-1\";", false], ["    <div className=\"mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-8\">", "    // [&>*]:min-w-0: nothing in it may grow wider than the screen (a phone)\n    <div className=\"mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:px-8 [&>*]:min-w-0\">", false], ["<code data-testid=\"quotation-link\" className=\"min-w-0 flex-1 truncate rounded-lg bg-[#f4f6f8] px-3 py-2.5 text-sm\" dir=\"ltr\">", "<code data-testid=\"quotation-link\" className=\"min-w-0 flex-1 truncate rounded-lg bg-[#f4f6f8] px-3 py-2.5 text-sm max-sm:basis-full\" dir=\"ltr\">", false], ["<Link href={`/q/${encodeURIComponent(quote.code)}/print`} target=\"_blank\" className={outline}>", "<Link href={`/q/${encodeURIComponent(quote.code)}/print`} target=\"_blank\" className={`${outline} max-sm:basis-full`}>", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-quote-fit-phone`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
