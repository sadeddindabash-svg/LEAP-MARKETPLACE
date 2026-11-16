#!/usr/bin/env node
/**
 * Checkout and basket summary: show EVERY saving (confirmed with the person via mockup). Example: 2 x JOD 180, one held at JOD 144 ->
 * "Items before discounts JOD 360", "Discount on parts -JOD 36", loyalty -JOD 10, shipping free (JOD 21), total JOD 314, and a green
 * "You save JOD 67" (36 parts discount + 10 loyalty + 21 free shipping). The total never changes.
 * The API now gives a held part its price before the discount, so the app (which already adds parts + loyalty/promo + shipping) shows it too.
 * Run AFTER patch-discount-hold-rules.
 *   node scripts/patch-checkout-all-savings.js            dry run
 *   node scripts/patch-checkout-all-savings.js --write    applies it
 */
const DATA = {"created": [{"file": "apps/web-storefront/components/SavingsSummary.tsx", "what": "website: the savings lines and the \"You save\" box", "text": "\"use client\";\n\nimport { useT } from \"@/components/LangProvider\";\nimport { useCurrency } from \"@/components/CurrencyProvider\";\nimport { Price } from \"@/components/Price\";\n\n/**\n * Every saving in the order summary (confirmed with the person via mockup): the parts' own discount (a discount rule, or a price held at\n * checkout), the promo or loyalty discount, and the free shipping, added up in one \"You save\". The total itself never changes here.\n */\ntype Savings = { itemsBefore?: number; partsSaved?: number; discount: number; shippingSaved: number; saved: number; source: string };\n\n/** \"Items before discounts\" and \"Discount on parts\", only when a part is cheaper than its normal price. */\nexport function PartsDiscountRows({ summary }: { summary: Savings }) {\n  const t = useT();\n  if (!((summary.partsSaved ?? 0) > 0.004)) return null;\n  return (\n    <>\n      <div data-testid=\"items-before-discounts\" className=\"flex justify-between border-t border-line py-2\"><span>{t(\"items_before_discounts\")}</span><Price usd={summary.itemsBefore ?? 0} /></div>\n      <div data-testid=\"parts-discount\" className=\"flex justify-between py-2 font-semibold text-[#0f6b49]\"><span>{t(\"parts_discount\")}</span><span>−<Price usd={summary.partsSaved ?? 0} /></span></div>\n    </>\n  );\n}\n\n/** \"36 parts discount + 10 loyalty + 21 free shipping\" (in the buyer's currency). */\nexport function useSavedBreakdown(summary: Savings): string {\n  const t = useT();\n  const { format } = useCurrency();\n  const parts: string[] = [];\n  if ((summary.partsSaved ?? 0) > 0.004) parts.push(t(\"saved_part_parts\", { amount: format(summary.partsSaved ?? 0) }));\n  if (summary.discount > 0.004) parts.push(t(summary.source === \"loyalty\" ? \"saved_part_loyalty\" : \"saved_part_promo\", { amount: format(summary.discount) }));\n  if (summary.shippingSaved > 0.004) parts.push(t(\"saved_part_shipping\", { amount: format(summary.shippingSaved) }));\n  return parts.join(\" + \");\n}\n\n/** The basket: the line under \"You saved\", now with every saving. */\nexport function SavedDetail({ summary }: { summary: Savings }) {\n  const text = useSavedBreakdown(summary);\n  const pieces = [(summary.partsSaved ?? 0) > 0.004, summary.discount > 0.004, summary.shippingSaved > 0.004].filter(Boolean).length;\n  if (pieces < 2) return null;\n  return <p data-testid=\"you-saved-detail\" className=\"text-[12.5px] text-muted\">{text}</p>;\n}\n\n/** The checkout: a green \"You save\" box under the total, with what it is made of. */\nexport function YouSaveBox({ summary }: { summary: Savings }) {\n  const t = useT();\n  const text = useSavedBreakdown(summary);\n  if (!(summary.saved > 0.004)) return null;\n  return (\n    <div data-testid=\"you-save-box\" className=\"mt-3 rounded-[10px] border-[1.5px] border-[#9ed9b7] bg-[#e8f6ef] px-3 py-2.5 text-[#0f6b49]\">\n      <div className=\"flex justify-between text-[15px] font-extrabold\"><span>🎉 {t(\"you_save\")}</span><Price usd={summary.saved} /></div>\n      {text && <p className=\"mt-0.5 text-[12px] font-semibold opacity-90\">{text}</p>}\n    </div>\n  );\n}\n"}], "replaced": [], "anchored": [{"file": "services/api/src/modules/cart/routes.js", "what": "API, basket: a held part keeps its price before the discount (struck through, and counted in \"You save\")", "done": "beforeTotal", "pairs": [["      price = held.price;\n", "      price = held.price;\n      // the price before any discount for the whole part (its struck-through price and the \"You save\" of the summary): the lines' own prices before the discount\n      const beforeTotal = held.lines.reduce((s, l) => s + (l.originalPrice && l.originalPrice > l.price ? l.originalPrice : l.price) * l.quantity, 0);\n      originalPrice = beforeTotal > held.total + 0.004 ? beforeTotal / Number(r.quantity) : null;\n", false]]}, {"file": "apps/web-storefront/lib/cart.ts", "what": "website: the totals count the parts' own discount in \"You saved\"", "done": "partsSaved", "pairs": [["  const sh = cart.shipping;\n", "  // The parts' own discount (a discount rule, or a price held at checkout): their price before any discount minus what they cost now.\n  const itemsBefore = cart.items.reduce((sum, i) => sum + (i.originalPrice && i.originalPrice > i.price ? i.originalPrice : i.price) * i.quantity, 0);\n  const partsSaved = Math.max(0, itemsBefore - sub);\n  const sh = cart.shipping;\n", false], ["saved: discount + shippingSaved,", "itemsBefore,\n    partsSaved,\n    saved: partsSaved + discount + shippingSaved,      // every saving: the parts' discount, the promo or loyalty discount, and the free shipping", false]]}, {"file": "apps/web-storefront/app/checkout/page.tsx", "what": "website, checkout: \"Items before discounts\", \"Discount on parts\" and the green \"You save\" box", "done": "YouSaveBox", "pairs": [["import { ShippingRow } from \"@/components/FreeShipping\";", "import { ShippingRow } from \"@/components/FreeShipping\";\nimport { PartsDiscountRows, YouSaveBox } from \"@/components/SavingsSummary\";", false], ["<Price usd={i.price * i.quantity} className=\"font-semibold\" /></li>", "<span className=\"shrink-0 text-end\">{i.originalPrice && i.originalPrice > i.price ? <span className=\"me-1.5 text-[12px] text-muted line-through\"><Price usd={i.originalPrice * i.quantity} /></span> : null}<Price usd={i.price * i.quantity} className=\"font-semibold\" /></span></li>", false], ["          <div className=\"flex justify-between border-t border-line py-2\"><span>{t(\"subtotal\")}</span><Price usd={summary.subtotal} /></div>", "          <PartsDiscountRows summary={summary} />\n          <div className=\"flex justify-between border-t border-line py-2\"><span>{t(\"subtotal\")}</span><Price usd={summary.subtotal} /></div>", false], ["          <div className=\"mt-1 flex justify-between border-t-2 border-line pt-3 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>", "          <div className=\"mt-1 flex justify-between border-t-2 border-line pt-3 text-[22px] font-extrabold\"><span>{t(\"total\")}</span><Price usd={summary.total} /></div>\n          <YouSaveBox summary={summary} />", false]]}, {"file": "apps/web-storefront/app/cart/page.tsx", "what": "website, basket: the same lines and the full \"You saved\" breakdown", "done": "SavedDetail", "pairs": [["import { ShippingRow, FreeShippingHint, FreeShippingBadge } from \"@/components/FreeShipping\";", "import { ShippingRow, FreeShippingHint, FreeShippingBadge } from \"@/components/FreeShipping\";\nimport { PartsDiscountRows, SavedDetail } from \"@/components/SavingsSummary\";", false], ["          <div className=\"flex justify-between py-2\"><span>{t(\"subtotal\")}</span><Price usd={summary.subtotal} /></div>", "          <PartsDiscountRows summary={summary} />\n          <div className=\"flex justify-between py-2\"><span>{t(\"subtotal\")}</span><Price usd={summary.subtotal} /></div>", false], ["              {summary.shippingSaved > 0 && <p data-testid=\"you-saved-detail\" className=\"text-[12.5px] text-muted\">{summary.discount > 0 ? t(\"saved_breakdown\", { discount: format(summary.discount), shipping: format(summary.shippingSaved) }) : t(\"saved_free_shipping\")}</p>}", "              {/* every saving: parts discount + promo or loyalty + free shipping */}\n              <SavedDetail summary={summary} />", false]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "website: English and Arabic words", "done": "saved_part_parts", "pairs": [["  saved_free_shipping: \"Free shipping\",", "  saved_free_shipping: \"Free shipping\",\n  items_before_discounts: \"Items before discounts\",\n  parts_discount: \"Discount on parts\",\n  you_save: \"You save\",\n  saved_part_parts: \"{amount} parts discount\",\n  saved_part_loyalty: \"{amount} loyalty\",\n  saved_part_promo: \"{amount} promo code\",\n  saved_part_shipping: \"{amount} free shipping\",", false], ["  saved_free_shipping: \"الشحن المجاني\",", "  saved_free_shipping: \"الشحن المجاني\",\n  items_before_discounts: \"السعر قبل الخصومات\",\n  parts_discount: \"خصم القطع\",\n  you_save: \"وفّرت\",\n  saved_part_parts: \"{amount} خصم القطع\",\n  saved_part_loyalty: \"{amount} الولاء\",\n  saved_part_promo: \"{amount} رمز الخصم\",\n  saved_part_shipping: \"{amount} شحن مجاني\",", false]]}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-checkout-all-savings`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: API window: Ctrl+C, npm run dev; website: Ctrl+F5; app: R');
