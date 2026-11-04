#!/usr/bin/env node
/**
 * Website checkout: a way back to the basket. "Back to cart" (العودة إلى السلة) above the title, and an outlined "Back to cart" button under Place order.
 *
 *   node scripts/patch-back-to-cart.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-back-to-cart.js --write    applies it (each changed file is saved as <file>.before-back-to-cart first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/checkout/page.tsx", "what": "website checkout: \"Back to cart\" above the title and under Place order", "done": "data-testid=\"back-to-cart-top\"", "pairs": [["      <h1 className=\"mb-6 text-3xl font-bold tracking-tight text-navy\">{t(\"checkout\")}</h1>\n", "      {/* Back to the basket (to change what is in it, or what is ticked): above the title, and again under Place order. */}\n      <Link href=\"/cart\" data-testid=\"back-to-cart-top\" className=\"mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#e6edf2] pe-3 ps-1.5 text-sm font-bold text-navy hover:bg-[#d8e3ea]\"><svg aria-hidden=\"true\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.4\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className=\"rtl:rotate-180\"><path d=\"M15 6l-6 6 6 6\" /></svg>{t(\"back_to_cart\")}</Link>\n      <h1 className=\"mb-6 text-3xl font-bold tracking-tight text-navy\">{t(\"checkout\")}</h1>\n"], ["            {placing ? t(\"placing_order\") : t(\"place_order\")}\n          </button>\n", "            {placing ? t(\"placing_order\") : t(\"place_order\")}\n          </button>\n          <Link href=\"/cart\" data-testid=\"back-to-cart-bottom\" className=\"mt-3 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-navy text-[15px] font-bold text-navy hover:bg-chalk\"><svg aria-hidden=\"true\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.4\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className=\"rtl:rotate-180\"><path d=\"M15 6l-6 6 6 6\" /></svg>{t(\"back_to_cart\")}</Link>\n"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words (English and Arabic)", "done": "back_to_cart:", "pairs": [["  back_to_tickets: \"All tickets\",\n", "  back_to_tickets: \"All tickets\",\n  back_to_cart: \"Back to cart\",\n"], ["  back_to_tickets: \"\u0643\u0644 \u0627\u0644\u062a\u0630\u0627\u0643\u0631\",\n", "  back_to_tickets: \"\u0643\u0644 \u0627\u0644\u062a\u0630\u0627\u0643\u0631\",\n  back_to_cart: \"\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629\",\n"]]}], "created": [{"file": "apps/web-storefront/app/checkoutBack.test.tsx", "what": "the test for it", "text": "import { describe, it, expect } from \"vitest\";\nimport { readFileSync } from \"node:fs\";\nimport { join } from \"node:path\";\n\n// The checkout has a way back to the basket: a link above the title and a button under \"Place order\", both to /cart (the language prefix is added by Link).\nconst page = readFileSync(join(__dirname, \"checkout\", \"page.tsx\"), \"utf8\");\ndescribe(\"back to the basket from the checkout\", () => {\n  it(\"CRITICAL: a link above the title and a button under Place order, both to the basket\", () => {\n    expect(page.split('href=\"/cart\"').length - 1).toBeGreaterThanOrEqual(2);\n    expect(page.indexOf('data-testid=\"back-to-cart-top\"')).toBeLessThan(page.indexOf('{t(\"checkout\")}</h1>'));\n    expect(page.indexOf('{placing ? t(\"placing_order\") : t(\"place_order\")}')).toBeLessThan(page.indexOf('data-testid=\"back-to-cart-bottom\"'));\n  });\n  it(\"the arrow turns round in Arabic\", () => { expect(page).toContain(\"rtl:rotate-180\"); });\n});\n"}]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-back-to-cart`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
