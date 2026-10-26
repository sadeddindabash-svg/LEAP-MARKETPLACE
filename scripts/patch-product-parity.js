#!/usr/bin/env node
/**
 * Storefront product page like the mobile app: a green stock box with the DELIVERY DATE ("Delivery: Oct. 29"), "Only N left" when 5 or fewer are left, "Verified seller" and "Ships from X Warehouse", the price with the old price struck
 * through and a "-N% off" tag, a "Technical Specifications" card (every row, "Not specified" when empty, the product's own attributes, the description), and "Add to cart . total" with the quantity stopping at the stock. The delivery
 * date also replaces "N days" on product cards, the compare page and the other-listings table. Run it AFTER scripts/patch-search-sticky.js.
 *
 *   node scripts/patch-product-parity.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-product-parity.js --write    applies it (each changed file is saved as <file>.before-product-parity first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/api.ts", "what": "the product type carries the original price and the product's own attributes", "done": "Sent when a discount applies: the price before the discount", "pairs": [["  shipsFromCountryAr?: string | null;\n}\n\nexport interface ProductDetail extends ProductSummary {", "  shipsFromCountryAr?: string | null;\n  /** Sent when a discount applies: the price before the discount (the price above is the one to pay). */\n  originalPrice?: number | null;\n}\n\nexport interface ProductDetail extends ProductSummary {"], ["  fitKeys?: string[];", "  fitKeys?: string[];\n  /** The part's own attributes (material, colour...), as entered for this product. */\n  attributes?: Array<{ name: string; value: string }>;"]]}, {"file": "apps/web-storefront/components/ProductCard.tsx", "what": "the product card shows the delivery date", "done": "deliveryLine", "pairs": [["import { Price } from \"./Price\";", "import { Price } from \"./Price\";\nimport { deliveryLine } from \"@/lib/delivery\";"], ["{p.estimatedDeliveryDays ? <span>· {t(lang, \"delivery_in_days\", { n: p.estimatedDeliveryDays })}</span> : null}", "{deliveryLine(p.estimatedDeliveryDays, lang) ? <span>· {deliveryLine(p.estimatedDeliveryDays, lang)}</span> : null}"]]}, {"file": "apps/web-storefront/app/compare/page.tsx", "what": "the compare page shows the delivery date", "done": "deliveryDateLabel", "pairs": [["import { getLang } from \"@/lib/lang\";", "import { getLang } from \"@/lib/lang\";\nimport { deliveryDateLabel } from \"@/lib/delivery\";"], ["(p) => (p.estimatedDeliveryDays ? t(lang, \"delivery_in_days\", { n: p.estimatedDeliveryDays }) : dash)", "(p) => deliveryDateLabel(p.estimatedDeliveryDays, lang) ?? dash"]]}, {"file": "apps/web-storefront/components/OemComparison.tsx", "what": "the other-listings table shows the delivery date", "done": "deliveryLine", "pairs": [["import { t, type Lang } from \"@/lib/i18n\";", "import { t, type Lang } from \"@/lib/i18n\";\nimport { deliveryLine } from \"@/lib/delivery\";"], ["{p.estimatedDeliveryDays ? <span>{t(lang, \"delivery_in_days\", { n: p.estimatedDeliveryDays })}</span> : null}", "{deliveryLine(p.estimatedDeliveryDays, lang) ? <span>{deliveryLine(p.estimatedDeliveryDays, lang)}</span> : null}"]]}, {"file": "apps/web-storefront/app/products/[id]/page.tsx", "what": "the product page: stock box with the delivery date, verified seller and ships-from, price with the old price and discount, Add to cart with the total", "done": "StockBanner", "pairs": [["import { Price } from \"@/components/Price\";", "import StockBanner from \"@/components/StockBanner\";\nimport SellerSignals from \"@/components/SellerSignals\";\nimport PriceBlock from \"@/components/PriceBlock\";"], ["          <p className=\"mt-6 font-display font-bold text-4xl\">\n            <Price usd={product.price} />\n          </p>\n          <p\n            className={`mt-1 text-sm font-medium ${\n              product.stockQuantity > 0 ? \"text-gauge\" : \"text-muted\"\n            }`}\n          >\n            {t(lang, product.stockQuantity > 0 ? \"in_stock\" : \"out_of_stock\")}\n            {product.estimatedDeliveryDays\n              ? ` · ${t(lang, \"est_delivery_in\", { n: product.estimatedDeliveryDays })}`\n              : \"\"}\n          </p>\n\n          {product.description && (\n            <p className=\"mt-6 text-muted leading-relaxed\">\n              {product.description}\n            </p>\n          )}\n\n          {product.oemNumber && (\n            <p className=\"mt-6 text-sm text-muted\">\n              {t(lang, \"oem_number\")}:{\" \"}\n              <span className=\"font-plate font-semibold text-ink\">\n                {product.oemNumber}\n              </span>\n            </p>\n          )}\n\n", "          {/* Like the mobile app: the stock box with the delivery date, who ships it, then the price (with the old price and the discount when there is one). The description and the part number are in the specifications card. */}\n          <StockBanner stockQuantity={product.stockQuantity} estimatedDeliveryDays={product.estimatedDeliveryDays} lang={lang} />\n          <SellerSignals isVerifiedSeller={product.isVerifiedSeller} shipsFromCountry={product.shipsFromCountry} shipsFromCountryAr={product.shipsFromCountryAr} lang={lang} />\n          <PriceBlock price={product.price} originalPrice={product.originalPrice} lang={lang} />\n\n"], ["            <AddToCartButton productId={product.id} inStock={product.stockQuantity > 0} />", "            <AddToCartButton productId={product.id} inStock={product.stockQuantity > 0} unitPrice={product.price} maxQuantity={product.stockQuantity} />"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the wording of the delivery date, low stock, seller lines, discount tag, specifications and Add to cart total (English and Arabic)", "done": "delivery_date", "pairs": [["  product_details_title: \"Product details\",", "  product_details_title: \"Technical Specifications\",\n  delivery_date: \"Delivery: {date}\",\n  only_n_left: \"Only {n} left\",\n  stock_none_now: \"Currently out of stock\",\n  ships_from_warehouse: \"Ships from {country} Warehouse\",\n  percent_off: \"-{n}% off\",\n  detail_not_specified: \"Not specified\",\n  detail_description: \"Description\",\n  add_to_cart_total: \"Add to cart · {total}\","], ["  product_details_title: \"تفاصيل المنتج\",", "  product_details_title: \"المواصفات الفنية\",\n  delivery_date: \"التسليم: {date}\",\n  only_n_left: \"متبقٍ {n} فقط\",\n  stock_none_now: \"غير متوفر حاليًا\",\n  ships_from_warehouse: \"يشحن من مستودع {country}\",\n  percent_off: \"خصم {n}%\",\n  detail_not_specified: \"غير محدد\",\n  detail_description: \"الوصف\",\n  add_to_cart_total: \"أضف إلى السلة · {total}\","]]}], "whole": [{"file": "apps/web-storefront/components/ProductDetails.tsx", "what": "the specifications card shows every row (\"Not specified\" when empty), the part's own attributes and the description", "sha": "bf2f45658670acc184730cc107d672fc59fd5ca39e44cb788e697edce964503e"}, {"file": "apps/web-storefront/components/AddToCartButton.tsx", "what": "Add to cart shows the total and the quantity stops at the stock", "sha": "0daccadad4dcecae027e5f852765effc8c02dd4cda475ab81f4674cc0a0dadd0"}], "tests": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'product-parity-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'product-parity-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-product-parity`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
